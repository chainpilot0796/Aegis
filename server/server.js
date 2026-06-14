require('dotenv').config();

// On some Windows setups Node's default DNS resolver refuses SRV queries with
// ECONNREFUSED even though `nslookup` resolves cleanly. Pinning to public DNS
// resolvers and preferring IPv4 sidesteps the issue — observed with MongoDB
// Atlas mongodb+srv:// connection strings during local dev.
try {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '1.1.1.1', '9.9.9.9']);
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {
  // older Node versions may not expose setDefaultResultOrder
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Config
const { connectDB } = require('./config/db');
const { vaultContract } = require('./config/blockchain');

// Engines
const priceEngine = require('./engine/priceEngine');
const perpEngine = require('./engine/perpEngine');
const yieldShieldEngine = require('./engine/yieldShieldEngine');
const feeEngine = require('./engine/feeEngine');
const vaultEngine = require('./engine/vaultEngine');
const epochEngine = require('./engine/epochEngine');

// Services
const chainService = require('./services/chainService');
const bitgoService = require('./services/bitgoService');
const fileverseService = require('./services/fileverseService');
const heyelsaService = require('./services/heyelsaService');
const bitgoCustodyService = require('./services/bitgoCustodyService');
const usdcBalanceService = require('./services/usdcBalanceService');
const zeroGStorageService = require('./services/zeroGStorageService');
const zeroGComputeService = require('./services/zeroGComputeService');
const nimFallbackService = require('./services/nimFallbackService');
const aiAdvisorService = require('./services/aiAdvisorService');
const complianceService = require('./services/complianceService');
const shieldEnvelopeService = require('./services/shieldEnvelopeService');
const mantle = require('./config/mantle');

// Loop
const mainLoop = require('./loop/mainLoop');

// Routes
const marketsRouter = require('./routes/markets');
const tradeRouter = require('./routes/trade');
const yieldShieldRouter = require('./routes/yieldShield');
const userRouter = require('./routes/user');
const vaultRouter = require('./routes/vault');
const leaderboardRouter = require('./routes/leaderboard');
const aiRouter = require('./routes/ai');
const whatsappRouter = require('./routes/whatsapp');
const elsaRouter = require('./routes/elsa');
const custodyRouter = require('./routes/custody');
const agentsRouter = require('./routes/agents');
const skillsRouter = require('./routes/skills');

const PORT = process.env.PORT || 3001;

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  // Setup Express
  const app = express();
  app.use(cors());
  app.use(express.json());
  // Required for Twilio webhook (application/x-www-form-urlencoded)
  app.use(express.urlencoded({ extended: true }));

  // Setup HTTP server and Socket.IO
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Mount routes
  app.use('/api/markets', marketsRouter);
  app.use('/api/trade', tradeRouter);
  app.use('/api/yield-shield', yieldShieldRouter);
  app.use('/api/user', userRouter);
  app.use('/api/vault', vaultRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/whatsapp', whatsappRouter);
  app.use('/api/elsa', elsaRouter);
  app.use('/api/custody', custodyRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/skills', skillsRouter);

  // Health check
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Aegis API', timestamp: Date.now() });
  });

  // BitGo custody endpoints
  app.get('/api/sponsors/bitgo', (req, res) => {
    res.json({
      initialized: bitgoService.isInitialized(),
      ...bitgoService.getInfo(),
    });
  });

  app.get('/api/sponsors/bitgo/audit', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ transactions: bitgoService.getAuditLog(limit) });
  });

  // HeyElsa x402 + OpenClaw sponsor endpoints
  app.get('/api/sponsors/heyelsa', (req, res) => {
    res.json({
      sponsor: 'HeyElsa',
      x402: heyelsaService.getInfo(),
      endpoints: {
        whatsapp: 'POST /api/whatsapp',
        elsaChat: 'POST /api/elsa/chat',
        elsaStatus: 'GET /api/elsa/status',
      },
    });
  });

  // 0G stack health — judges hit this to verify integration
  app.get('/api/sponsors/zerog', (req, res) => {
    const network = (process.env.ZG_NETWORK || 'testnet').toLowerCase();
    res.json({
      sponsor: '0G Labs',
      network,
      chain: {
        label: network === 'mainnet' ? '0G Aristotle Mainnet' : '0G Galileo Testnet',
        chainId: network === 'mainnet' ? 16661 : 16602,
        rpc:
          network === 'mainnet'
            ? process.env.ZG_MAINNET_RPC || 'https://evmrpc.0g.ai'
            : process.env.ZG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai',
        explorer:
          network === 'mainnet'
            ? 'https://chainscan.0g.ai'
            : 'https://chainscan-galileo.0g.ai',
        vault: process.env.VAULT_CONTRACT_ADDRESS || null,
        ausdc: process.env.USDC_ADDRESS || null,
      },
      storage: zeroGStorageService.getInfo(),
      compute: zeroGComputeService.getInfo(),
      nimFallback: nimFallbackService.getInfo(),
    });
  });

  // Mantle stack health — judges hit this to verify the Mantle integration.
  // Also aliased at /api/sponsors/mantle.
  const mantleHealth = async (req, res) => {
    let rpcReachable = false;
    let blockNumber = null;
    let vaultReachable = false;
    let vaultOwner = null;
    let protocolFeeBps = null;
    try {
      if (mantle.provider) {
        blockNumber = await mantle.provider.getBlockNumber();
        rpcReachable = true;
      }
    } catch (e) {
      rpcReachable = false;
    }
    try {
      if (mantle.vaultContract) {
        vaultOwner = await mantle.vaultContract.owner();
        protocolFeeBps = Number(await mantle.vaultContract.protocolFeeBps());
        vaultReachable = true;
      }
    } catch (e) {
      vaultReachable = false;
    }
    res.json({
      chain: 'Mantle',
      network: mantle.network,
      chainId: mantle.chainId,
      rpc: mantle.rpc,
      explorer: mantle.explorerBase,
      rpcReachable,
      blockNumber,
      vault: {
        address: process.env.VAULT_CONTRACT_ADDRESS || null,
        reachable: vaultReachable,
        owner: vaultOwner,
        protocolFeeBps,
      },
      tokens: {
        usdy: process.env.USDY_ADDRESS || null,
        meth: process.env.METH_ADDRESS || null,
      },
      relayer: mantle.relayer ? mantle.relayer.address : null,
      aiAdvisor: aiAdvisorService.getInfo(),
      compliance: complianceService.getInfo(),
      storage: shieldEnvelopeService.getInfo(),
    });
  };
  app.get('/api/health/mantle', mantleHealth);
  app.get('/api/sponsors/mantle', mantleHealth);

  // Initialize engines
  await priceEngine.init();
  await epochEngine.checkEpoch();

  // Initialize BitGo
  await bitgoService.init();

  // Initialize Fileverse
  await fileverseService.init();

  // Initialize 0G Storage + 0G Compute
  await zeroGStorageService.init();
  await zeroGComputeService.init();

  // Initialize HeyElsa x402
  await heyelsaService.init();

  // Initialize BitGo custodial wallets
  bitgoCustodyService.init();

  // Start USDC deposit detection polling
  usdcBalanceService.start();

  // Initialize chain service
  chainService.init(vaultContract);

  // Start main loop
  mainLoop.start(io, priceEngine, perpEngine, yieldShieldEngine, feeEngine, vaultEngine);

  // Socket.IO connections
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', (address) => {
      if (address) {
        socket.join(address.toLowerCase());
        console.log(`[Socket] ${socket.id} joined room ${address.toLowerCase()}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`[Server] Aegis API running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});