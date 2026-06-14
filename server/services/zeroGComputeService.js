/**
 * 0G Compute Service
 *
 * Routes AI inference (shield recommendation, intent parsing) through 0G Compute
 * with TEE-verified responses. Falls back silently to NIM, then OpenAI, so the
 * outward `recommendShield` interface is provider-agnostic and resilient.
 *
 * SDK: @0gfoundation/0g-compute-ts-sdk (legacy @0glabs/0g-serving-broker DEPRECATED).
 * Requires Node >=20.
 *
 * Verified against https://github.com/0gfoundation/0g-compute-ts-starter-kit (2026-05-16).
 */

const { ethers } = require("ethers");
const { MARKETS } = require("../config/markets");

// Compute SDK loaded lazily (dynamic import keeps the service usable even if the
// SDK is missing — we just degrade to the NIM/OpenAI fallbacks).
let createZGComputeNetworkBroker = null;
let OpenAIDefault = null;

// Official provider addresses from the 0G compute starter kit.
// Source: github.com/0gfoundation/0g-compute-ts-starter-kit/src/services/brokerService.ts
const OFFICIAL_PROVIDERS = {
  "llama-3.3-70b-instruct":  "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "deepseek-r1-70b":         "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3",
  "qwen2.5-vl-72b-instruct": "0x6D233D2610c32f630ED53E8a7Cbf759568041f8f",
};

const DEFAULT_TESTNET_RPC = "https://evmrpc-testnet.0g.ai";
const DEFAULT_MAINNET_RPC = "https://evmrpc.0g.ai";

let broker = null;
let provider = null;
let wallet = null;
let initialized = false;
let initError = null;
let acknowledgedProviders = new Set();
let lastProviderUsed = null; // 'zerog' | 'nim' | 'openai' | null
let lastModelUsed = null;

const ASSET_IDS = MARKETS.map((m) => m.id);

function rpcForNetwork(net) {
  if (net === "mainnet") return process.env.ZG_MAINNET_RPC || DEFAULT_MAINNET_RPC;
  return process.env.ZG_TESTNET_RPC || DEFAULT_TESTNET_RPC;
}

async function loadDeps() {
  if (!createZGComputeNetworkBroker) {
    const mod = await import("@0gfoundation/0g-compute-ts-sdk");
    createZGComputeNetworkBroker =
      mod.createZGComputeNetworkBroker || mod.default?.createZGComputeNetworkBroker;
    if (!createZGComputeNetworkBroker) {
      throw new Error(
        "0G Compute SDK loaded but createZGComputeNetworkBroker not exported - SDK shape changed"
      );
    }
  }
  if (!OpenAIDefault) {
    // SDK pattern uses the openai npm package as the HTTP client
    const oa = require("openai");
    OpenAIDefault = oa.OpenAI || oa.default || oa;
  }
}

async function init() {
  const rawKey = process.env.ZG_COMPUTE_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;

  if (!rawKey || rawKey === "YOUR_KEY_HERE") {
    initError = "Missing ZG_COMPUTE_PRIVATE_KEY / RELAYER_PRIVATE_KEY";
    console.warn(`[0G Compute] ${initError} - will use fallbacks only`);
    return false;
  }

  try {
    await loadDeps();
    const network = (process.env.ZG_NETWORK || "testnet").toLowerCase();
    const rpc = rpcForNetwork(network);
    provider = new ethers.JsonRpcProvider(rpc);
    const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    wallet = new ethers.Wallet(key, provider);
    broker = await createZGComputeNetworkBroker(wallet);
    initialized = true;
    initError = null;
    console.log(
      `[0G Compute] Initialized (${network}, wallet=${wallet.address})`
    );
    return true;
  } catch (err) {
    initError = err.message || String(err);
    console.error(`[0G Compute] Init failed: ${initError}`);
    return false;
  }
}

function isConfigured() {
  return initialized;
}

function getInfo() {
  return {
    initialized,
    error: initError,
    network: (process.env.ZG_NETWORK || "testnet").toLowerCase(),
    wallet: wallet ? wallet.address : null,
    providers: Object.keys(OFFICIAL_PROVIDERS),
    lastProviderUsed,
    lastModelUsed,
  };
}

function getLastProviderUsed() {
  return lastProviderUsed;
}

/**
 * Ensure the chosen provider is acknowledged. Idempotent in our cache.
 */
async function ensureAcknowledged(providerAddress) {
  if (!broker) return;
  if (acknowledgedProviders.has(providerAddress)) return;
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    acknowledgedProviders.add(providerAddress);
  } catch (err) {
    // Already-acknowledged errors are silently absorbed
    if (!/already/i.test(err.message || "")) {
      console.warn(`[0G Compute] acknowledgeProviderSigner: ${err.message || err}`);
    }
    acknowledgedProviders.add(providerAddress);
  }
}

const SYSTEM_PROMPT = `You are an Aegis.0G shield recommender. Given a user's financial concern, recommend ONE asset to hedge with.

You must return ONLY valid JSON. No prose, no markdown fences. The JSON object must have exactly two keys:
- "asset": one of the valid asset IDs listed below (string)
- "reason": one short sentence (under 30 words) explaining the recommendation in plain language

Valid asset IDs (you MUST pick one of these exactly):
${ASSET_IDS.join(", ")}

Mapping hints:
- inflation / currency devaluation / fiat -> gold or silver
- crude / energy / oil prices -> wti_oil or natural_gas
- bitcoin / btc / crypto in general -> bitcoin
- ethereum / eth / defi -> ethereum
- solana / sol -> solana
- housing / rent / property / real estate / specific US city -> the matching re_* id (re_nyc, re_miami, re_la, re_sf, etc.)
- rupee / india -> usd_inr
- euro / europe -> eur_usd
- pound / uk / britain -> gbp_usd

If nothing matches cleanly, default to "gold".`;

/**
 * Pick a provider/service. Prefers env-pinned `ZG_COMPUTE_PROVIDER_PIN`, else
 * filters listService() for a TeeML-verifiable service and picks the first.
 */
async function pickService() {
  const pinned = process.env.ZG_COMPUTE_PROVIDER_PIN;
  if (pinned) {
    return {
      providerAddress: pinned,
      modelHint: process.env.ZG_COMPUTE_MODEL_HINT || "",
    };
  }

  if (!broker) throw new Error("Broker not initialized");

  let services = [];
  try {
    services = await broker.inference.listService();
  } catch (err) {
    throw new Error(`listService failed: ${err.message || err}`);
  }

  if (!Array.isArray(services) || services.length === 0) {
    throw new Error("No services returned by listService");
  }

  // Prefer TeeML-verifiable services
  const teeServices = services.filter((s) =>
    String(s.verifiability || "").toLowerCase().includes("tee")
  );
  const pool = teeServices.length > 0 ? teeServices : services;

  // Prefer known official providers if any are present
  const officialAddrs = new Set(
    Object.values(OFFICIAL_PROVIDERS).map((a) => a.toLowerCase())
  );
  const official = pool.find((s) =>
    s.provider && officialAddrs.has(String(s.provider).toLowerCase())
  );
  const chosen = official || pool[0];
  return {
    providerAddress: chosen.provider,
    modelHint: chosen.model || "",
    serviceMeta: chosen,
  };
}

/**
 * Run a chat completion against 0G Compute with TEE verification.
 * @returns {Promise<{content: string, model: string, providerAddress: string, verified: boolean, chatId: string}>}
 */
async function chatCompletion({ systemPrompt, userPrompt }) {
  if (!initialized) {
    throw new Error("0G Compute not initialized");
  }

  const { providerAddress } = await pickService();
  await ensureAcknowledged(providerAddress);

  const meta = await broker.inference.getServiceMetadata(providerAddress);
  const { endpoint, model } = meta;
  if (!endpoint || !model) {
    throw new Error(`Bad service metadata: ${JSON.stringify(meta)}`);
  }

  // Headers are single-use — generate fresh per request, billing proof bound to query
  const headers = await broker.inference.getRequestHeaders(providerAddress, userPrompt);
  const requestHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") requestHeaders[k] = v;
  }

  const openai = new OpenAIDefault({ baseURL: endpoint, apiKey: "" });
  const completion = await openai.chat.completions.create(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
    },
    { headers: requestHeaders }
  );

  const content = completion?.choices?.[0]?.message?.content || "";
  const chatId = completion?.id || "";

  // Verify TEE signature. processResponse returns boolean; throws on payment/header error.
  let verified = false;
  try {
    verified = await broker.inference.processResponse(providerAddress, chatId, content);
  } catch (err) {
    console.warn(`[0G Compute] processResponse threw: ${err.message || err}`);
  }

  return { content, model, providerAddress, verified, chatId };
}

function parseRecommendationJson(text) {
  if (!text || typeof text !== "string") return null;
  // Strip code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  // Extract first {...} block to tolerate prose around it
  const m = cleaned.match(/\{[\s\S]*\}/);
  const blob = m ? m[0] : cleaned;
  try {
    const j = JSON.parse(blob);
    if (j && typeof j.asset === "string" && typeof j.reason === "string") {
      const asset = ASSET_IDS.includes(j.asset) ? j.asset : null;
      return { asset, reason: j.reason };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Public API — recommend a shield asset for a natural-language concern.
 *
 * Returns shape:
 *   {
 *     asset:               string (validated against MARKETS, null if invalid),
 *     reason:              string,
 *     providerUsed:        'zerog' | 'nim' | 'openai' | 'fallback',
 *     teeVerified:         boolean,           // true only when 0G Compute served + sig verified
 *     teeProviderAddress:  string | null,
 *     teeModel:            string | null,
 *     teeChatId:           string | null,
 *     raw:                 string,
 *   }
 */
async function recommendShield(concern) {
  if (!concern || typeof concern !== "string") {
    throw new Error("concern (string) required");
  }

  const userPrompt = concern;

  // 1. Try 0G Compute
  if (initialized) {
    try {
      const result = await chatCompletion({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });
      const parsed = parseRecommendationJson(result.content);
      if (parsed && parsed.asset) {
        lastProviderUsed = "zerog";
        lastModelUsed = result.model;
        return {
          asset: parsed.asset,
          reason: parsed.reason,
          providerUsed: "zerog",
          teeVerified: result.verified === true,
          teeProviderAddress: result.providerAddress || null,
          teeModel: result.model,
          teeChatId: result.chatId || null,
          raw: result.content,
        };
      }
      console.warn(
        `[0G Compute] Recommendation parse failed - raw: ${String(result.content).slice(0, 120)}`
      );
    } catch (err) {
      console.warn(`[0G Compute] recommendShield failed: ${err.message || err}`);
    }
  }

  // 2. Fall back to NIM
  const nim = require("./nimFallbackService");
  if (nim.isConfigured()) {
    try {
      const result = await nim.chatCompletion({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });
      const parsed = parseRecommendationJson(result.content);
      if (parsed && parsed.asset) {
        lastProviderUsed = "nim";
        lastModelUsed = result.model;
        return {
          asset: parsed.asset,
          reason: parsed.reason,
          providerUsed: "nim",
          teeVerified: false,
          teeProviderAddress: null,
          teeModel: result.model,
          teeChatId: null,
          raw: result.content,
        };
      }
    } catch (err) {
      console.warn(`[NIM Fallback] recommendShield failed: ${err.message || err}`);
    }
  }

  // 3. Fall back to OpenAI if configured
  if (process.env.OPENAI_API_KEY) {
    try {
      const oa = require("openai");
      const OpenAICtor = oa.OpenAI || oa.default || oa;
      const client = new OpenAICtor({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      const content = completion?.choices?.[0]?.message?.content || "";
      const parsed = parseRecommendationJson(content);
      if (parsed && parsed.asset) {
        lastProviderUsed = "openai";
        lastModelUsed = completion?.model || "openai";
        return {
          asset: parsed.asset,
          reason: parsed.reason,
          providerUsed: "openai",
          teeVerified: false,
          teeProviderAddress: null,
          teeModel: completion?.model || null,
          teeChatId: completion?.id || null,
          raw: content,
        };
      }
    } catch (err) {
      console.warn(`[OpenAI Fallback] recommendShield failed: ${err.message || err}`);
    }
  }

  // 4. Deterministic keyword fallback so the endpoint never 500s
  const lower = concern.toLowerCase();
  let asset = "gold";
  if (/oil|energy|gas/.test(lower)) asset = "wti_oil";
  else if (/housing|rent|real estate|property/.test(lower)) asset = "re_nyc";
  else if (/bitcoin|btc/.test(lower)) asset = "bitcoin";
  else if (/ethereum|eth|defi/.test(lower)) asset = "ethereum";
  else if (/solana|sol/.test(lower)) asset = "solana";
  else if (/rupee|india|inr/.test(lower)) asset = "usd_inr";
  else if (/euro|europe/.test(lower)) asset = "eur_usd";
  else if (/silver|precious metal/.test(lower)) asset = "silver";

  lastProviderUsed = "fallback";
  lastModelUsed = "rule-based";
  return {
    asset,
    reason: `Recommending ${asset} based on your concern keywords (deterministic fallback - no inference provider available).`,
    providerUsed: "fallback",
    teeVerified: false,
    teeProviderAddress: null,
    teeModel: null,
    teeChatId: null,
    raw: "",
  };
}

module.exports = {
  init,
  isConfigured,
  getInfo,
  getLastProviderUsed,
  recommendShield,
  chatCompletion,
  OFFICIAL_PROVIDERS,
};
