const { ethers } = require('ethers');

// ENS NameWrapper ABI - only the functions we need
const NAME_WRAPPER_ABI = [
  'function setSubnodeOwner(bytes32 parentNode, string label, address owner, uint32 fuses, uint64 expiry) returns (bytes32 node)',
  'function setSubnodeRecord(bytes32 parentNode, string label, address owner, address resolver, uint64 ttl, uint32 fuses, uint64 expiry) returns (bytes32 node)',
  'function ownerOf(uint256 id) view returns (address)',
];

// ENS Public Resolver on Sepolia
const RESOLVER_ADDRESS = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';
const PARENT_DOMAIN = 'aegis.eth';

let provider = null;
let signer = null;
let nameWrapper = null;
let parentNode = null;

function init() {
  const rpc = process.env.ENS_SEPOLIA_RPC;
  const privateKey = process.env.ENS_REGISTRAR_PRIVATE_KEY;
  const nameWrapperAddress = process.env.ENS_REGISTRAR_ADDRESS;

  if (!rpc || !privateKey || !nameWrapperAddress || nameWrapperAddress === 'YOUR_ADDRESS') {
    console.warn('[ENS] Missing ENS config - subname registration will be mocked');
    return false;
  }

  try {
    provider = new ethers.JsonRpcProvider(rpc);
    signer = new ethers.Wallet(privateKey, provider);
    nameWrapper = new ethers.Contract(nameWrapperAddress, NAME_WRAPPER_ABI, signer);
    parentNode = ethers.namehash(PARENT_DOMAIN);
    console.log(`[ENS] Initialized - parent: ${PARENT_DOMAIN} (${parentNode})`);
    console.log(`[ENS] Signer: ${signer.address}`);
    return true;
  } catch (error) {
    console.error('[ENS] Init error:', error.message);
    return false;
  }
}

async function registerEnsSubname(asset, userAddressShort, ownerAddress) {
  const label = `${asset}-${userAddressShort}`.toLowerCase();
  const fullName = `${label}.${PARENT_DOMAIN}`;

  if (!nameWrapper) {
    console.log(`[ENS] Mock subname: ${fullName}`);
    return fullName;
  }

  try {
    const owner = ownerAddress || signer.address;
    const fuses = 0;
    const expiry = BigInt('18446744073709551615');

    console.log(`[ENS] Registering subname: ${fullName} -> ${owner}`);

    const tx = await nameWrapper.setSubnodeRecord(
      parentNode,
      label,
      owner,
      RESOLVER_ADDRESS,
      0,
      fuses,
      expiry
    );

    console.log(`[ENS] Tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[ENS] Subname registered: ${fullName} (block ${receipt.blockNumber})`);

    return fullName;
  } catch (error) {
    console.error(`[ENS] Error registering ${fullName}:`, error.message);
    return fullName;
  }
}

/**
 * Create a shield agreement document.
 *
 * Storage provider precedence (set via STORAGE_PROVIDER env, default 'zerog'):
 *   1. 'zerog'      - 0G Storage (canonical). Returns {rootHash, txHash, markdown, json, provider:'zerog'}.
 *   2. 'fileverse'  - Legacy Fileverse/IPFS path. Returns {fileId, txHash, provider:'fileverse'}.
 *   3. fallback     - Deterministic content hash (no off-chain persistence). Returns {hash, provider:'hash'}.
 *
 * Each provider gracefully degrades to the next on failure, with a hard 12-second timeout
 * per attempt so a hanging indexer cannot stall the API.
 */
async function createShieldDoc(shieldData) {
  const fileverseService = require('./fileverseService');
  const zeroGStorageService = require('./zeroGStorageService');

  const preferred = (process.env.STORAGE_PROVIDER || 'zerog').toLowerCase();

  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);

  // 0G Storage testnet uploads include an on-chain submit + a sync wait. Observed
  // p95 is ~25-45 seconds on Galileo; configurable via STORAGE_UPLOAD_TIMEOUT_MS.
  const storageTimeoutMs = Number(process.env.STORAGE_UPLOAD_TIMEOUT_MS) || 75_000;

  // 1. 0G Storage (preferred)
  if (preferred === 'zerog' && zeroGStorageService.isConfigured()) {
    try {
      const result = await withTimeout(
        zeroGStorageService.uploadShieldDoc(shieldData),
        storageTimeoutMs,
        '0G Storage upload'
      );
      if (result && result.rootHash) {
        console.log(`[Storage] 0G rootHash=${result.rootHash}`);
        return {
          provider: 'zerog',
          rootHash: result.rootHash,
          txHash: result.txHash,
          markdown: result.markdown,
          json: result.json,
        };
      }
    } catch (err) {
      console.warn(`[Storage] 0G upload failed: ${err.message} - falling back`);
    }
  }

  // 2. Fileverse / IPFS (legacy)
  if (fileverseService.isInitialized()) {
    try {
      const result = await withTimeout(
        fileverseService.createShieldDoc(shieldData),
        12000,
        'Fileverse upload'
      );
      if (result) {
        const hash = result.txHash || result.fileId;
        console.log(`[Storage] Fileverse hash=${hash}`);
        return {
          provider: 'fileverse',
          fileId: result.fileId,
          txHash: hash,
        };
      }
    } catch (err) {
      console.warn(`[Storage] Fileverse upload failed: ${err.message} - falling back`);
    }
  }

  // 3. Deterministic content hash fallback
  const content = JSON.stringify(shieldData);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(content));
  console.warn(`[Storage] No storage backend - using content hash: ${hash}`);
  return { provider: 'hash', hash };
}

init();

module.exports = { registerEnsSubname, createShieldDoc, init };
