/**
 * Agent-key bearer auth + action logging.
 *
 * Express middleware factory. Wrap any route the agents can call:
 *
 *   router.post('/something', agentBearerAuth({ action: 'recommend' }), handler);
 *
 * Behaviour:
 *   - If no `Authorization: Bearer aegis_sk_…` header is present, the request
 *     passes through unchanged (browser/wallet path).
 *   - If a bearer is present:
 *       * It MUST resolve to an unrevoked AgentSessionKey, else 401.
 *       * `req.agent` is populated with { sessionKeyId, walletAddress, slug,
 *         model, name } from headers + DB.
 *       * `req.user` is set so downstream handlers can treat the agent's
 *         wallet as the acting user (mirrors the browser flow).
 *   - On response finish, write one AgentAction row with the resolved
 *     params/result for the configured `action`. Errors during logging are
 *     swallowed so they cannot break the live request.
 */

const agentKeyService = require('../services/agentKeyService');
const AgentAction = require('../models/AgentAction');

const HEADER_KEYS = {
  slug:  'x-agent-slug',
  model: 'x-agent-model',
  name:  'x-agent-name',
};

function trimForLog(obj, maxLen = 2000) {
  if (obj == null) return null;
  try {
    const s = JSON.stringify(obj);
    return s.length > maxLen ? JSON.parse(s.slice(0, maxLen) + '"') : JSON.parse(s);
  } catch {
    return null;
  }
}

function extractAsset(req) {
  return (
    (req.body && (req.body.asset || req.body?.intent?.asset)) ||
    req.params?.assetId ||
    req.query?.asset ||
    null
  );
}

module.exports = function agentBearerAuth({ action } = {}) {
  if (!action) throw new Error('agentBearerAuth: action label required');

  return async function agentBearerAuthMiddleware(req, res, next) {
    const authz = req.headers.authorization || req.headers.Authorization;
    if (!authz || !/^Bearer\s+aegis_sk_/i.test(authz)) {
      return next(); // no bearer, browser/wallet path — pass through silently
    }

    const raw = authz.split(/\s+/, 2)[1];
    try {
      const keyDoc = await agentKeyService.findByRawKey(raw);
      if (!keyDoc) return res.status(401).json({ error: 'Invalid session key' });
      if (keyDoc.revokedAt) return res.status(401).json({ error: 'Session key revoked' });

      const agent = {
        sessionKeyId: keyDoc._id,
        walletAddress: keyDoc.walletAddress,
        slug:  req.headers[HEADER_KEYS.slug]  || null,
        model: req.headers[HEADER_KEYS.model] || null,
        name:  req.headers[HEADER_KEYS.name]  || null,
      };
      req.agent = agent;
      // Mirror the wallet onto req.user for downstream handlers that look there
      req.user = req.user || { address: keyDoc.walletAddress };

      // touch lastUsedAt (fire-and-forget)
      agentKeyService.touchLastUsed(keyDoc._id).catch(() => {});

      // capture body for logging, sanitise scary fields
      const paramsSnapshot = trimForLog(req.body);

      // Hook end of response to write the audit row
      const origJson = res.json.bind(res);
      res.json = (body) => {
        try {
          const status = res.statusCode >= 400 ? 'error' : 'ok';
          const asset = extractAsset(req) ||
            (body?.recommendation?.asset) ||
            (body?.shield?.asset) ||
            (body?.prepare && body?.prepare.assetName) ||
            null;

          AgentAction.create({
            sessionKeyId: agent.sessionKeyId,
            walletAddress: agent.walletAddress,
            agentSlug:  agent.slug,
            agentModel: agent.model,
            agentName:  agent.name,
            action,
            asset,
            params: paramsSnapshot,
            result: trimForLog(body),
            invested:      Number(body?.shield?.depositAmount) || 0,
            onChainTxHash: body?.shield?.onChainTxHash || null,
            storageRootHash: body?.shield?.storageRootHash || body?.prepare?.rootHash || null,
            status,
            errorMessage: status === 'error' ? (body?.error || null) : null,
          }).catch((err) => {
            console.warn('[agentBearerAuth] AgentAction.create failed:', err.message);
          });
        } catch (logErr) {
          console.warn('[agentBearerAuth] log hook error:', logErr.message);
        }
        return origJson(body);
      };

      next();
    } catch (err) {
      console.error('[agentBearerAuth] error', err);
      res.status(500).json({ error: 'Agent auth failed' });
    }
  };
};
