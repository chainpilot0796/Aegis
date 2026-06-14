/**
 * LLM Gateway — the single switch point for all chat-completion calls.
 *
 * Both aiAdvisorService and complianceService route through this gateway instead
 * of duplicating the NIM/OpenAI fallback inline. The gateway:
 *   - Reads the active provider + model from a cached Mongo setting (AppSetting,
 *     key 'llm'). Default: mistral / mistral-medium-latest.
 *   - Resolves each provider's API key from the admin-stored key (Mongo) first,
 *     then the env var.
 *   - Calls the active provider first, then falls through the remaining
 *     configured providers (mistral -> nim -> openai) so a single provider
 *     outage never hard-breaks inference. The caller still keeps its own
 *     deterministic heuristic as the final safety net.
 *
 * Runtime config (provider/model and API keys) is managed via routes/admin.js.
 */

const AppSetting = require('../models/AppSetting');
const nimFallbackService = require('./nimFallbackService');
const mistralService = require('./mistralService');

const DEFAULTS = { provider: 'mistral', model: 'mistral-medium-latest' };
const FALLBACK_ORDER = ['mistral', 'nim', 'openai'];

async function openaiCall({ systemPrompt, userPrompt, model, apiKey }) {
  const oa = require('openai');
  const OpenAICtor = oa.OpenAI || oa.default || oa;
  const client = new OpenAICtor({ apiKey });
  const completion = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
  });
  return {
    content: completion?.choices?.[0]?.message?.content || '',
    model: completion?.model || model,
  };
}

const PROVIDER_DEFS = {
  mistral: {
    label: 'Mistral',
    envKey: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-medium-latest',
    models: ['mistral-medium-latest', 'mistral-small-latest', 'mistral-large-latest'],
    call: (args) => mistralService.chatCompletion(args),
  },
  nim: {
    label: 'NVIDIA NIM',
    envKey: 'NIM_API_KEY',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-70b-instruct'],
    call: (args) => nimFallbackService.chatCompletion(args),
  },
  openai: {
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    call: (args) => openaiCall(args),
  },
};

// In-memory cache of the active config. Refreshed on write + on startup.
let cache = null;

function getCache() {
  if (!cache) cache = { ...DEFAULTS, apiKeys: {} };
  return cache;
}

function hasProvider(p) {
  return Object.prototype.hasOwnProperty.call(PROVIDER_DEFS, p);
}

function resolveKey(provider, apiKeys) {
  const def = PROVIDER_DEFS[provider];
  if (!def) return null;
  return (apiKeys && apiKeys[provider]) || process.env[def.envKey] || null;
}

/** Load the persisted config into the cache (call once on startup). */
async function loadConfig() {
  try {
    const doc = await AppSetting.findOne({ key: 'llm' }).lean();
    if (doc) {
      cache = {
        provider: doc.provider || DEFAULTS.provider,
        model: doc.model || DEFAULTS.model,
        apiKeys: doc.apiKeys || {},
      };
    } else {
      cache = { ...DEFAULTS, apiKeys: {} };
    }
  } catch (e) {
    cache = { ...DEFAULTS, apiKeys: {} };
    console.warn('[llmGateway] loadConfig failed — using defaults:', e.message);
  }
  console.log(`[llmGateway] active LLM: ${cache.provider} / ${cache.model}`);
  return cache;
}

async function persist() {
  const c = getCache();
  try {
    await AppSetting.findOneAndUpdate(
      { key: 'llm' },
      { key: 'llm', provider: c.provider, model: c.model, apiKeys: c.apiKeys },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.warn('[llmGateway] persist failed (in-memory only):', e.message);
  }
}

async function setActiveConfig({ provider, model } = {}) {
  const c = getCache();
  if (provider) {
    if (!hasProvider(provider)) throw new Error(`unknown provider: ${provider}`);
    c.provider = provider;
  }
  if (model) c.model = model;
  await persist();
  return publicConfig();
}

async function setApiKey(provider, apiKey) {
  if (!hasProvider(provider)) throw new Error(`unknown provider: ${provider}`);
  const c = getCache();
  c.apiKeys = { ...(c.apiKeys || {}), [provider]: apiKey };
  await persist();
  return publicConfig();
}

async function clearApiKey(provider) {
  if (!hasProvider(provider)) throw new Error(`unknown provider: ${provider}`);
  const c = getCache();
  const next = { ...(c.apiKeys || {}) };
  delete next[provider];
  c.apiKeys = next;
  await persist();
  return publicConfig();
}

function mask(key) {
  if (!key) return null;
  const s = String(key);
  return s.length <= 4 ? '••••' : '••••' + s.slice(-4);
}

/** Non-sensitive view of the config — never returns raw API keys. */
function publicConfig() {
  const c = getCache();
  return {
    active: { provider: c.provider, model: c.model },
    providers: FALLBACK_ORDER.map((id) => {
      const def = PROVIDER_DEFS[id];
      const stored = c.apiKeys && c.apiKeys[id];
      const resolved = resolveKey(id, c.apiKeys);
      return {
        id,
        label: def.label,
        models: def.models,
        defaultModel: def.defaultModel,
        configured: !!resolved,
        keySource: stored ? 'admin' : process.env[def.envKey] ? 'env' : null,
        keyHint: mask(stored || process.env[def.envKey]),
        hasAdminKey: !!stored,
      };
    }),
  };
}

function isConfigured() {
  const c = getCache();
  return FALLBACK_ORDER.some((p) => !!resolveKey(p, c.apiKeys));
}

function getInfo() {
  const c = getCache();
  return { active: { provider: c.provider, model: c.model }, configured: isConfigured() };
}

/**
 * Run a chat completion against the active provider, falling through the rest of
 * the waterfall on failure. Throws only if every configured provider fails.
 * @returns {Promise<{content: string, model: string, provider: string}>}
 */
async function chatCompletion({ systemPrompt, userPrompt }) {
  const c = getCache();
  const order = [c.provider, ...FALLBACK_ORDER.filter((p) => p !== c.provider)];
  let lastErr = null;
  for (const provider of order) {
    const def = PROVIDER_DEFS[provider];
    if (!def) continue;
    const apiKey = resolveKey(provider, c.apiKeys);
    if (!apiKey) continue;
    const model = provider === c.provider ? c.model : def.defaultModel;
    try {
      const r = await def.call({ systemPrompt, userPrompt, model, apiKey });
      return { content: r.content, model: r.model || model, provider };
    } catch (err) {
      lastErr = err;
      console.warn(`[llmGateway] ${provider} failed: ${err.message || err}`);
    }
  }
  throw new Error(
    `All LLM providers failed${lastErr ? ': ' + (lastErr.message || lastErr) : ' (none configured)'}`
  );
}

module.exports = {
  loadConfig,
  chatCompletion,
  setActiveConfig,
  setApiKey,
  clearApiKey,
  publicConfig,
  getInfo,
  isConfigured,
  hasProvider,
};
