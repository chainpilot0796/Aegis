/**
 * Aegis.0G agent session-key service.
 *
 * - Keys are 24-byte random hex with the `aegis_sk_` prefix.
 * - Only a SHA-256 hash is stored. The raw key is returned exactly once at
 *   create/rotate time.
 * - Mutations (create / revoke / rotate / list) require a wallet signature
 *   over a server-issued nonce to prove the caller controls the wallet.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const AgentSessionKey = require('../models/AgentSessionKey');

const KEY_PREFIX = 'aegis_sk_';
const NONCE_TTL_MS = 5 * 60 * 1000;
const issuedNonces = new Map(); // nonce -> { walletAddress, expiresAt }

/* ─── Nonce management ────────────────────────────────────────────────── */

function issueNonce(walletAddress) {
  const addr = String(walletAddress || '').toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    throw new Error('Invalid walletAddress');
  }
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + NONCE_TTL_MS;
  issuedNonces.set(nonce, { walletAddress: addr, expiresAt });
  cleanExpiredNonces();
  return { nonce, expiresAt: new Date(expiresAt).toISOString(), walletAddress: addr };
}

function cleanExpiredNonces() {
  const now = Date.now();
  for (const [n, v] of issuedNonces.entries()) {
    if (v.expiresAt < now) issuedNonces.delete(n);
  }
}

function buildSignableMessage({ action, walletAddress, nonce, expiresAt }) {
  return [
    'Aegis.0G Agent Keys Management',
    `Action: ${action}`,
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
  ].join('\n');
}

function verifySignedRequest({ action, walletAddress, nonce, signature, expiresAt }) {
  const stored = issuedNonces.get(nonce);
  if (!stored) throw new Error('Unknown or expired nonce');
  if (stored.expiresAt < Date.now()) {
    issuedNonces.delete(nonce);
    throw new Error('Nonce expired');
  }
  const addr = String(walletAddress || '').toLowerCase();
  if (stored.walletAddress !== addr) throw new Error('Wallet mismatch on nonce');

  const message = buildSignableMessage({ action, walletAddress: addr, nonce, expiresAt });
  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature).toLowerCase();
  } catch (err) {
    throw new Error(`Bad signature: ${err.message}`);
  }
  if (recovered !== addr) throw new Error('Signature does not match wallet');

  issuedNonces.delete(nonce); // burn nonce so it can't be replayed
  return true;
}

/* ─── Key generation ──────────────────────────────────────────────────── */

function generateRawKey() {
  const raw = `${KEY_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = `${raw.slice(0, 16)}…${raw.slice(-4)}`;
  return { raw, hashed, prefix };
}

function hashKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/* ─── CRUD operations ─────────────────────────────────────────────────── */

async function createKey({ walletAddress, label, scopes }) {
  const { raw, hashed, prefix } = generateRawKey();
  const doc = await AgentSessionKey.create({
    walletAddress: walletAddress.toLowerCase(),
    hashedKey: hashed,
    keyPrefix: prefix,
    label: label || 'untitled',
    scopes: Array.isArray(scopes) && scopes.length ? scopes : undefined,
  });
  return {
    id: doc._id.toString(),
    key: raw, // returned ONCE
    keyPrefix: doc.keyPrefix,
    label: doc.label,
    scopes: doc.scopes,
    createdAt: doc.createdAt,
  };
}

async function listKeys(walletAddress) {
  const docs = await AgentSessionKey.find({
    walletAddress: walletAddress.toLowerCase(),
  })
    .sort({ createdAt: -1 })
    .lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    keyPrefix: d.keyPrefix,
    label: d.label,
    scopes: d.scopes,
    createdAt: d.createdAt,
    lastUsedAt: d.lastUsedAt,
    revokedAt: d.revokedAt,
    status: d.revokedAt ? 'revoked' : d.lastUsedAt ? 'live' : 'idle',
  }));
}

async function revokeKey({ walletAddress, id }) {
  const doc = await AgentSessionKey.findOneAndUpdate(
    { _id: id, walletAddress: walletAddress.toLowerCase(), revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!doc) throw new Error('Key not found or already revoked');
  return { id: doc._id.toString(), revokedAt: doc.revokedAt };
}

async function rotateKey({ walletAddress, id }) {
  const existing = await AgentSessionKey.findOne({
    _id: id,
    walletAddress: walletAddress.toLowerCase(),
  });
  if (!existing) throw new Error('Key not found');
  if (existing.revokedAt) throw new Error('Cannot rotate a revoked key');

  // Revoke old, create new with same label + scopes
  existing.revokedAt = new Date();
  await existing.save();

  return createKey({
    walletAddress,
    label: existing.label,
    scopes: existing.scopes,
  });
}

async function findByRawKey(rawKey) {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;
  const hashed = hashKey(rawKey);
  if (!hashed) return null;
  return AgentSessionKey.findOne({ hashedKey: hashed }).lean();
}

async function touchLastUsed(id) {
  return AgentSessionKey.updateOne(
    { _id: id },
    { $set: { lastUsedAt: new Date() } }
  );
}

module.exports = {
  KEY_PREFIX,
  issueNonce,
  buildSignableMessage,
  verifySignedRequest,
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  findByRawKey,
  touchLastUsed,
  hashKey,
};
