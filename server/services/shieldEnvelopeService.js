/**
 * Shield Envelope Service — auditable on-chain commitment + chain-neutral storage.
 *
 * The "shield envelope" bundles everything the AI decided: the hedge
 * recommendation, the AI-derived risk params, and the compliance verdict. We
 * canonicalize it (recursively sorted keys -> stable JSON) and take its
 * keccak256. That hash is what goes on-chain as AegisVault.createShield's
 * `storageRootHash`. Anyone can fetch the published envelope, re-hash it the
 * same way, and confirm it matches the on-chain commitment.
 *
 * Storage is chain-neutral:
 *   - STORAGE_PROVIDER=pinata + PINATA_JWT  -> pin JSON to IPFS, return cid/uri
 *   - STORAGE_PROVIDER=hash (or no JWT)     -> hash-only mode, returns just the hash
 * store() NEVER throws — any upload error degrades to hash-only.
 */

const { ethers } = require('ethers');
const axios = require('axios');

const ENVELOPE_VERSION = 'aegis-mantle-1';
const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

/**
 * Recursively sort object keys so JSON.stringify output is reproducible.
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeysDeep(value[k]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(obj) {
  return JSON.stringify(sortKeysDeep(obj));
}

/**
 * Build the envelope object + its canonical JSON + keccak256 root hash.
 *
 * @returns {{ envelope: object, canonicalJson: string, rootHash: string }}
 */
function buildEnvelope({
  user,
  concern,
  recommendation,
  riskParams,
  compliance,
  deposit,
  durationSeconds,
  entryPrice,
}) {
  const envelope = {
    version: ENVELOPE_VERSION,
    network: (process.env.MANTLE_NETWORK || 'testnet').toLowerCase(),
    user: String(user || '').toLowerCase(),
    concern: String(concern || ''),
    recommendation: recommendation || {},
    riskParams: riskParams || {},
    compliance: compliance || {},
    deposit: deposit != null ? String(deposit) : null,
    durationSeconds: durationSeconds != null ? Number(durationSeconds) : null,
    entryPrice: entryPrice != null ? Number(entryPrice) : null,
    createdAt: new Date().toISOString(),
  };

  const canonicalJson = stableStringify(envelope);
  const rootHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

  return { envelope, canonicalJson, rootHash };
}

function storageMode() {
  const provider = (process.env.STORAGE_PROVIDER || 'hash').toLowerCase();
  if (provider === 'pinata' && process.env.PINATA_JWT) return 'pinata';
  return 'hash';
}

function getInfo() {
  return {
    mode: storageMode(),
    provider: (process.env.STORAGE_PROVIDER || 'hash').toLowerCase(),
    pinataConfigured: !!process.env.PINATA_JWT,
    gateway: process.env.PINATA_GATEWAY || DEFAULT_GATEWAY,
    version: ENVELOPE_VERSION,
  };
}

/**
 * Persist the envelope. Pins to IPFS via Pinata when configured, else hash-only.
 * Never throws — falls back to hash-only on any error.
 *
 * @param {object} envelope
 * @param {string} canonicalJson
 * @returns {Promise<{ cid: string|null, uri: string|null, rootHash: string, provider: string }>}
 */
async function store(envelope, canonicalJson) {
  // Recompute the rootHash from canonicalJson so it's authoritative even if the
  // caller passes a stale envelope object.
  const rootHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

  if (storageMode() !== 'pinata') {
    return { cid: null, uri: null, rootHash, provider: 'hash' };
  }

  try {
    const gateway = (process.env.PINATA_GATEWAY || DEFAULT_GATEWAY).replace(/\/$/, '');
    const res = await axios.post(
      PINATA_PIN_URL,
      {
        pinataContent: envelope,
        pinataMetadata: {
          name: `aegis-shield-${rootHash.slice(0, 18)}`,
          keyvalues: { rootHash, version: ENVELOPE_VERSION },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          'Content-Type': 'application/json',
        },
        timeout: Number(process.env.PINATA_TIMEOUT_MS) || 15000,
      }
    );
    const cid = res.data?.IpfsHash || null;
    if (!cid) throw new Error('Pinata returned no IpfsHash');
    const uri = `${gateway}/${cid}`;
    console.log(`[ShieldEnvelope] Pinned to IPFS: cid=${cid} rootHash=${rootHash}`);
    return { cid, uri, rootHash, provider: 'pinata' };
  } catch (err) {
    console.warn(`[ShieldEnvelope] Pinata upload failed: ${err.message || err} — hash-only`);
    return { cid: null, uri: null, rootHash, provider: 'hash' };
  }
}

/**
 * Verify a published canonical JSON re-hashes to the given rootHash.
 * @returns {boolean}
 */
function verify(canonicalJson, rootHash) {
  if (typeof canonicalJson !== 'string' || typeof rootHash !== 'string') return false;
  try {
    const computed = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));
    return computed.toLowerCase() === rootHash.toLowerCase();
  } catch {
    return false;
  }
}

module.exports = {
  buildEnvelope,
  store,
  verify,
  getInfo,
  stableStringify,
  sortKeysDeep,
  ENVELOPE_VERSION,
};
