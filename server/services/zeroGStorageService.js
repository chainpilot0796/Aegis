/**
 * 0G Storage Service
 *
 * Uploads Aegis.0G shield agreement documents (markdown + JSON tarball) to 0G Storage
 * and surfaces a `rootHash` + `txHash` pair. Reads are served back through the
 * indexer; there is no public HTTP gateway, so all reads route through this service.
 *
 * SDK: @0gfoundation/0g-ts-sdk (NOT 0g-storage-ts-sdk — that package does not exist).
 * SDK exposes both ESM and CJS builds; we load it via dynamic import() so that an
 * ESM-only future build wouldn't break the server.
 *
 * Verified against https://github.com/0gfoundation/0g-storage-ts-starter-kit (2026-05-16).
 */

const { ethers } = require("ethers");

let MemData = null;
let Indexer = null;

let provider = null;
let signer = null;
let indexer = null;
let initialized = false;
let initError = null;

const DEFAULT_INDEXER_URL = "https://indexer-storage-testnet-turbo.0g.ai";
const DEFAULT_TESTNET_RPC = "https://evmrpc-testnet.0g.ai";
const DEFAULT_MAINNET_RPC = "https://evmrpc.0g.ai";

function rpcForNetwork(net) {
  if (net === "mainnet") return process.env.ZG_MAINNET_RPC || DEFAULT_MAINNET_RPC;
  return process.env.ZG_TESTNET_RPC || DEFAULT_TESTNET_RPC;
}

async function loadSdk() {
  if (MemData && Indexer) return;
  const mod = await import("@0gfoundation/0g-ts-sdk");
  MemData = mod.MemData;
  Indexer = mod.Indexer;
  if (!MemData || !Indexer) {
    throw new Error(
      "0G TS SDK loaded but MemData/Indexer not exported - SDK shape changed"
    );
  }
}

async function init() {
  // Storage runs against a separate network from the chain when ZG_STORAGE_NETWORK is set.
  // Reason: 0G has no published mainnet Indexer URL we can rely on yet, so even if the
  // dapp's contracts live on Aristotle mainnet we run the Storage SDK against testnet
  // turbo. README documents this. To force Storage onto mainnet later, set
  // ZG_STORAGE_NETWORK=mainnet.
  const network = (
    process.env.ZG_STORAGE_NETWORK ||
    process.env.ZG_NETWORK ||
    "testnet"
  ).toLowerCase();
  const rpc = rpcForNetwork(network);
  const indexerUrl = process.env.ZG_INDEXER_URL || DEFAULT_INDEXER_URL;
  const rawKey = process.env.ZG_STORAGE_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;

  if (!rawKey || rawKey === "YOUR_KEY_HERE") {
    initError = "Missing ZG_STORAGE_PRIVATE_KEY / RELAYER_PRIVATE_KEY";
    console.warn(`[0G Storage] ${initError} - service will fall back`);
    return false;
  }

  try {
    await loadSdk();
    provider = new ethers.JsonRpcProvider(rpc);
    const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    signer = new ethers.Wallet(key, provider);
    indexer = new Indexer(indexerUrl);
    initialized = true;
    initError = null;
    console.log(
      `[0G Storage] Initialized (${network}, indexer=${indexerUrl}, signer=${signer.address})`
    );
    return true;
  } catch (err) {
    initError = err.message || String(err);
    console.error(`[0G Storage] Init failed: ${initError}`);
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
    network: (
      process.env.ZG_STORAGE_NETWORK ||
      process.env.ZG_NETWORK ||
      "testnet"
    ).toLowerCase(),
    indexer: process.env.ZG_INDEXER_URL || DEFAULT_INDEXER_URL,
    signer: signer ? signer.address : null,
  };
}

/**
 * Build the markdown + JSON payload for a shield, return the bytes to upload.
 * @param {object} shieldData {address, asset, depositAmount, durationMonths, exposureBudget, entryPrice, yieldApy, yieldSource}
 * @returns {{ bytes: Uint8Array, markdown: string, json: object }}
 */
function buildShieldPayload(shieldData) {
  const deposit = Number(shieldData.depositAmount) || 0;
  const entry = Number(shieldData.entryPrice) || 0;
  const budget = Number(shieldData.exposureBudget) || 0;
  const dur = Number(shieldData.durationMonths) || 0;
  const apy = Number(shieldData.yieldApy) || 0;

  const json = {
    schema: "aegis.0g.shield/1",
    chain: {
      label: process.env.ZG_NETWORK === "mainnet" ? "0G Aristotle" : "0G Galileo Testnet",
      chainId: process.env.ZG_NETWORK === "mainnet" ? 16661 : 16602,
    },
    user: String(shieldData.address || ""),
    asset: String(shieldData.asset || ""),
    deposit: deposit,
    durationMonths: dur,
    entryPrice: entry,
    exposureBudget: budget,
    yieldApy: apy,
    yieldSource: String(shieldData.yieldSource || ""),
    teeInferenceSignature: shieldData.teeInferenceSignature || null,
    teeInferenceProvider: shieldData.teeInferenceProvider || null,
    createdAt: new Date().toISOString(),
  };

  const markdown = [
    "# Aegis.0G Shield Agreement",
    "",
    "## Shield Details",
    `- **User**: ${json.user}`,
    `- **Asset**: ${json.asset}`,
    `- **Deposit**: $${deposit.toFixed(2)} A-USDC`,
    `- **Duration**: ${dur} months`,
    `- **Entry Price**: $${entry.toFixed(2)}`,
    `- **Exposure Budget**: $${budget.toFixed(2)} (yield-derived)`,
    `- **Yield Source**: ${json.yieldSource || "Best available"}`,
    `- **APY**: ${apy.toFixed(2)}%`,
    `- **Created**: ${json.createdAt}`,
    "",
    "## Principal Protection Guarantee",
    `The deposited principal of $${deposit.toFixed(2)} is mathematically protected.`,
    `Only the yield-derived exposure budget of $${budget.toFixed(2)} is at risk.`,
    `Maximum loss = $0 on principal. Minimum return at maturity = $${deposit.toFixed(2)}.`,
    "",
    "## On-Chain & Off-Chain References",
    `- **Chain**: ${json.chain.label} (${json.chain.chainId})`,
    `- **Vault**: ${process.env.VAULT_CONTRACT_ADDRESS || "see deployment.json"}`,
    `- **A-USDC**: ${process.env.USDC_ADDRESS || "see deployment.json"}`,
    json.teeInferenceProvider
      ? `- **TEE Inference Provider**: ${json.teeInferenceProvider}`
      : "",
    json.teeInferenceSignature
      ? `- **TEE Signature**: ${String(json.teeInferenceSignature).slice(0, 32)}…`
      : "",
    "",
    "---",
    "*This document is stored on 0G Storage. Read via `GET /api/yield-shield/doc/:rootHash`.*",
    "*Generated by Aegis.0G Protocol.*",
  ]
    .filter(Boolean)
    .join("\n");

  const envelope = {
    markdown,
    json,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  return { bytes, markdown, json };
}

/**
 * Upload a shield agreement document to 0G Storage.
 * @returns {Promise<{rootHash: string, txHash: string, markdown: string, json: object} | null>}
 */
async function uploadShieldDoc(shieldData) {
  if (!initialized) {
    console.warn("[0G Storage] Not initialized - skipping upload");
    return null;
  }

  const { bytes, markdown, json } = buildShieldPayload(shieldData);

  try {
    const memData = new MemData(bytes);
    const tree = await memData.merkleTree();
    // SDK returns Go-style [value, err] tuples on some calls and plain values on others.
    const treeErr = Array.isArray(tree) ? tree[1] : null;
    if (treeErr) {
      throw new Error(`merkleTree error: ${treeErr}`);
    }

    const network = (
      process.env.ZG_STORAGE_NETWORK ||
      process.env.ZG_NETWORK ||
      "testnet"
    ).toLowerCase();
    const rpc = rpcForNetwork(network);
    const result = await indexer.upload(memData, rpc, signer);

    // upload returns [tx, err] tuple in starter kit; tx may be union shape
    const [tx, uploadErr] = Array.isArray(result) ? result : [result, null];
    if (uploadErr) {
      throw new Error(`upload error: ${uploadErr}`);
    }
    if (!tx) {
      throw new Error("upload returned no tx");
    }

    const rootHash =
      "rootHash" in tx ? tx.rootHash : tx.rootHashes && tx.rootHashes[0];
    const txHash =
      "txHash" in tx ? tx.txHash : tx.txHashes && tx.txHashes[0];

    if (!rootHash) {
      throw new Error(`upload returned no rootHash (shape=${Object.keys(tx).join(",")})`);
    }

    console.log(
      `[0G Storage] Uploaded shield doc: rootHash=${rootHash} txHash=${txHash || "?"}`
    );
    return { rootHash, txHash: txHash || null, markdown, json };
  } catch (err) {
    console.error(`[0G Storage] Upload failed: ${err.message || err}`);
    throw err;
  }
}

/**
 * Fetch and decode a shield doc by rootHash.
 * @returns {Promise<{markdown: string, json: object} | null>}
 */
async function fetchShieldDoc(rootHash) {
  if (!initialized) {
    console.warn("[0G Storage] Not initialized - cannot fetch");
    return null;
  }
  if (!rootHash || typeof rootHash !== "string") {
    throw new Error("rootHash required");
  }

  try {
    const result = await indexer.downloadToBlob(rootHash, { proof: true });
    const [blob, err] = Array.isArray(result) ? result : [result, null];
    if (err) {
      throw new Error(`downloadToBlob error: ${err}`);
    }
    if (!blob) {
      throw new Error("downloadToBlob returned no blob");
    }

    const buf = await blob.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(buf));
    const envelope = JSON.parse(text);
    if (envelope && envelope.markdown && envelope.json) {
      return { markdown: envelope.markdown, json: envelope.json };
    }
    return { markdown: text, json: null };
  } catch (err) {
    console.error(`[0G Storage] Fetch failed: ${err.message || err}`);
    throw err;
  }
}

module.exports = {
  init,
  isConfigured,
  getInfo,
  uploadShieldDoc,
  fetchShieldDoc,
  // exposed for tests
  buildShieldPayload,
};
