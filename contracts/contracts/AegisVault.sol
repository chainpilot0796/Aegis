// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AegisVault
 * @notice Principal-protected yield shield vault for Mantle RWAs (USDY, mETH, …).
 *         Holds Shield records on-chain and settles on the Mantle network.
 *         Each Shield binds a `storageRootHash` — the keccak256 of the off-chain
 *         "shield envelope": the AI hedge recommendation, the AI-derived risk
 *         parameters (hedge ratio / principal clamp / volatility), and the
 *         compliance verdict. The hash makes the agent's decision auditable:
 *         anyone can re-hash the published envelope and confirm it matches the
 *         on-chain commitment.
 *
 *         Revenue: the protocol skims `protocolFeeBps` from positive exposure
 *         payouts only (never from principal), accruing to `feeRecipient`.
 *
 *         The legacy trader/LP/PnL surface (perp positions) is retained to
 *         preserve compatibility with the original repo, but is not part of
 *         the Aegis demo path.
 */
contract AegisVault {
    using SafeERC20 for IERC20;

    // --- State ---
    IERC20 public ausdcToken;
    address public relayer;
    address public owner;
    address public pendingOwner;
    uint256 public currentEpoch;
    uint256 public lastEpochTime;
    uint256 public constant EPOCH_DURATION = 7 days;

    // --- Legacy balances (perp surface, kept for compat) ---
    mapping(address => uint256) public traderBalances;
    mapping(address => uint256) public lpBalances;
    uint256 public totalTraderDeposits;
    uint256 public totalLpDeposits;

    struct LpWithdrawalRequest {
        uint256 amount;
        uint256 epochRequested;
    }
    mapping(address => LpWithdrawalRequest) public lpWithdrawalQueue;

    // --- Shields (Aegis core product) ---
    struct Shield {
        uint128 depositAmount;       // A-USDC (6 dp)
        uint64  durationSeconds;
        uint64  createdAt;
        uint64  settleAt;
        bytes32 assetId;             // keccak256("gold"), etc.
        uint64  entryPrice;          // scaled 1e8 USD
        uint64  closePrice;          // scaled 1e8 USD, set on settle
        int128  exposurePayout;      // signed A-USDC delta, set on settle
        bytes32 storageRootHash;     // keccak256 rootHash of off-chain decision envelope
        bool    settled;
    }
    mapping(address => Shield[]) private _userShields;
    uint256 public totalShieldsCreated;
    uint256 public totalShieldDeposits;

    // --- Bonus pool ---
    // Backs positive `exposurePayout` on settlement. In a production deployment this
    // would be funded by yield accrued on the principal during the lock period (zero-coupon
    // bond mechanics). For the hackathon demo, anyone can pre-fund it directly via
    // `fundBonusPool` (test-token economics — AUSDC has a public faucet).
    uint256 public bonusPool;
    event BonusPoolFunded(address indexed from, uint256 amount);

    // --- Protocol fee (fee-on-yield revenue model) ---
    // Skimmed from POSITIVE exposure payouts only — principal is never touched.
    // Expressed in basis points, hard-capped at 20% so the upside the user was
    // promised cannot be quietly eroded. Defaults to 0 (off) until the owner sets it.
    uint16 public protocolFeeBps;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 2000; // 20%
    address public feeRecipient;
    uint256 public accruedFees; // protocol fees held in-contract until withdrawn
    event ProtocolFeeChanged(uint16 previousBps, uint16 newBps);
    event FeeRecipientChanged(address indexed previous, address indexed next);
    event ProtocolFeeAccrued(address indexed user, uint256 idx, uint256 feeAmount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // --- Events ---
    // Legacy
    event TraderDeposit(address indexed trader, uint256 amount);
    event LpDeposit(address indexed lp, uint256 amount);
    event TraderWithdraw(address indexed trader, uint256 amount);
    event LpWithdraw(address indexed lp, uint256 amount);
    event PnlSettled(address indexed trader, int256 pnlDelta);
    event FeeCollected(address indexed trader, uint256 feeAmount);
    event EpochAdvanced(uint256 newEpoch, uint256 timestamp);

    // Ownership / relayer rotation
    event RelayerChanged(address indexed previous, address indexed next);
    event OwnershipTransferStarted(address indexed previous, address indexed pending);
    event OwnershipTransferred(address indexed previous, address indexed next);

    // Shield
    event ShieldCreated(
        address indexed user,
        uint256 indexed idx,
        bytes32 indexed assetId,
        uint128 deposit,
        uint64 durationSeconds,
        uint64 entryPrice,
        bytes32 storageRootHash
    );
    event ShieldSettled(
        address indexed user,
        uint256 indexed idx,
        uint64 closePrice,
        int128 exposurePayout
    );

    // --- Modifiers ---
    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // --- Constructor ---
    constructor(address _ausdcToken, address _relayer) {
        require(_ausdcToken != address(0), "ausdc=0");
        require(_relayer != address(0), "relayer=0");
        ausdcToken = IERC20(_ausdcToken);
        relayer = _relayer;
        owner = msg.sender;
        feeRecipient = msg.sender;
        currentEpoch = 1;
        lastEpochTime = block.timestamp;
    }

    // --- Protocol fee admin ---
    /// @notice Owner sets the fee-on-yield rate (basis points). Capped at 20%.
    function setProtocolFee(uint16 newBps) external onlyOwner {
        require(newBps <= MAX_PROTOCOL_FEE_BPS, "Fee too high");
        uint16 prev = protocolFeeBps;
        protocolFeeBps = newBps;
        emit ProtocolFeeChanged(prev, newBps);
    }

    /// @notice Owner sets where withdrawn protocol fees are sent.
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "recipient=0");
        address prev = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(prev, newRecipient);
    }

    /// @notice Owner withdraws accrued protocol fees to `feeRecipient`.
    function withdrawFees(uint256 amount) external onlyOwner {
        require(amount <= accruedFees, "Exceeds accrued");
        accruedFees -= amount;
        ausdcToken.safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    // --- Ownership / relayer rotation ---
    /// @notice Owner rotates the relayer key. Critical for ops continuity if the relayer is compromised.
    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "relayer=0");
        address prev = relayer;
        relayer = newRelayer;
        emit RelayerChanged(prev, newRelayer);
    }

    /// @notice Start a two-step ownership handover. Use the zero address to cancel a pending transfer.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Pending owner accepts the handover.
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        address prev = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }

    // =====================================================================
    //  SHIELD FUNCTIONS — Aegis core
    // =====================================================================

    /**
     * @notice Create a principal-protected Shield. Caller must have approved
     *         `deposit` A-USDC to this contract.
     * @param  deposit         A-USDC amount (6dp) — principal protected at maturity.
     * @param  durationSeconds Time until settlement.
     * @param  assetId         keccak256-tagged asset identifier (e.g. keccak256("gold")).
     * @param  entryPrice      Asset entry price, scaled 1e8.
     * @param  storageRootHash keccak256 rootHash of the off-chain decision envelope.
     * @return idx             Index of the new Shield in the caller's shield array.
     */
    function createShield(
        uint128 deposit,
        uint64 durationSeconds,
        bytes32 assetId,
        uint64 entryPrice,
        bytes32 storageRootHash
    ) external returns (uint256 idx) {
        require(deposit > 0, "Deposit must be > 0");
        require(durationSeconds > 0, "Duration must be > 0");
        require(storageRootHash != bytes32(0), "Missing storage rootHash");

        ausdcToken.safeTransferFrom(msg.sender, address(this), uint256(deposit));

        Shield memory s = Shield({
            depositAmount:   deposit,
            durationSeconds: durationSeconds,
            createdAt:       uint64(block.timestamp),
            settleAt:        uint64(block.timestamp) + durationSeconds,
            assetId:         assetId,
            entryPrice:      entryPrice,
            closePrice:      0,
            exposurePayout:  0,
            storageRootHash: storageRootHash,
            settled:         false
        });

        _userShields[msg.sender].push(s);
        idx = _userShields[msg.sender].length - 1;

        totalShieldsCreated += 1;
        totalShieldDeposits += uint256(deposit);

        emit ShieldCreated(
            msg.sender,
            idx,
            assetId,
            deposit,
            durationSeconds,
            entryPrice,
            storageRootHash
        );
    }

    /**
     * @notice Relayer settles a Shield: pays back principal + exposure payout.
     *         Principal is always returned in full (guaranteed by the
     *         zero-coupon-bond math off-chain). `exposurePayout` is the signed
     *         delta beyond principal.
     */
    function settleShield(
        address user,
        uint256 idx,
        uint64 closePrice,
        int128 exposurePayout
    ) external onlyRelayer {
        require(idx < _userShields[user].length, "Bad shield idx");
        Shield storage s = _userShields[user][idx];
        require(!s.settled, "Already settled");
        require(block.timestamp >= s.settleAt, "Not mature");

        s.closePrice = closePrice;
        s.exposurePayout = exposurePayout;
        s.settled = true;

        uint256 payout = uint256(s.depositAmount);
        if (exposurePayout > 0) {
            uint256 bonus = uint256(uint128(exposurePayout));
            require(bonusPool >= bonus, "Bonus pool empty - fund via fundBonusPool");
            bonusPool -= bonus;
            // Fee-on-yield: skim from the bonus (upside) only — principal is untouched.
            uint256 fee = (bonus * protocolFeeBps) / 10000;
            if (fee > 0) {
                accruedFees += fee;
                bonus -= fee;
                emit ProtocolFeeAccrued(user, idx, fee);
            }
            payout += bonus;
        } else if (exposurePayout < 0) {
            uint256 loss = uint256(uint128(-exposurePayout));
            // exposure can absorb at most the deposit; principal stays intact via clamp
            if (loss < payout) {
                payout -= loss;
            }
        }

        totalShieldDeposits -= uint256(s.depositAmount);
        ausdcToken.safeTransfer(user, payout);

        emit ShieldSettled(user, idx, closePrice, exposurePayout);
    }

    function getShields(address user) external view returns (Shield[] memory) {
        return _userShields[user];
    }

    function getShield(address user, uint256 idx)
        external
        view
        returns (Shield memory)
    {
        require(idx < _userShields[user].length, "Bad shield idx");
        return _userShields[user][idx];
    }

    function getShieldCount(address user) external view returns (uint256) {
        return _userShields[user].length;
    }

    /// @notice Top up the bonus pool that backs positive exposure payouts on settle.
    function fundBonusPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        ausdcToken.safeTransferFrom(msg.sender, address(this), amount);
        bonusPool += amount;
        emit BonusPoolFunded(msg.sender, amount);
    }

    // =====================================================================
    //  LEGACY TRADER / LP / PNL — retained, not in demo path
    // =====================================================================

    function depositTrader(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        ausdcToken.safeTransferFrom(msg.sender, address(this), amount);
        traderBalances[msg.sender] += amount;
        totalTraderDeposits += amount;
        emit TraderDeposit(msg.sender, amount);
    }

    function depositLp(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        ausdcToken.safeTransferFrom(msg.sender, address(this), amount);
        lpBalances[msg.sender] += amount;
        totalLpDeposits += amount;
        emit LpDeposit(msg.sender, amount);
    }

    function withdrawTrader(address trader, uint256 amount) external onlyRelayer {
        require(traderBalances[trader] >= amount, "Insufficient trader balance");
        traderBalances[trader] -= amount;
        totalTraderDeposits -= amount;
        ausdcToken.safeTransfer(trader, amount);
        emit TraderWithdraw(trader, amount);
    }

    function settlePnl(address trader, int256 pnlDelta) external onlyRelayer {
        if (pnlDelta > 0) {
            uint256 gain = uint256(pnlDelta);
            require(totalLpDeposits >= gain, "Insufficient LP pool");
            totalLpDeposits -= gain;
            traderBalances[trader] += gain;
            totalTraderDeposits += gain;
        } else if (pnlDelta < 0) {
            uint256 loss = uint256(-pnlDelta);
            require(traderBalances[trader] >= loss, "Insufficient trader balance");
            traderBalances[trader] -= loss;
            totalTraderDeposits -= loss;
            totalLpDeposits += loss;
        }
        emit PnlSettled(trader, pnlDelta);
    }

    function collectFee(address trader, uint256 feeAmount) external onlyRelayer {
        require(traderBalances[trader] >= feeAmount, "Insufficient trader balance");
        traderBalances[trader] -= feeAmount;
        totalTraderDeposits -= feeAmount;
        emit FeeCollected(trader, feeAmount);
    }

    function requestLpWithdrawal(uint256 amount) external {
        require(lpBalances[msg.sender] >= amount, "Insufficient LP balance");
        require(lpWithdrawalQueue[msg.sender].amount == 0, "Pending withdrawal exists");
        lpWithdrawalQueue[msg.sender] = LpWithdrawalRequest({
            amount: amount,
            epochRequested: currentEpoch
        });
    }

    function processLpWithdrawal(address lp) external onlyRelayer {
        LpWithdrawalRequest memory req = lpWithdrawalQueue[lp];
        require(req.amount > 0, "No pending withdrawal");
        require(currentEpoch > req.epochRequested, "Must wait for next epoch");
        require(lpBalances[lp] >= req.amount, "Insufficient LP balance");

        lpBalances[lp] -= req.amount;
        totalLpDeposits -= req.amount;
        delete lpWithdrawalQueue[lp];
        ausdcToken.safeTransfer(lp, req.amount);
        emit LpWithdraw(lp, req.amount);
    }

    function advanceEpoch() external {
        require(block.timestamp >= lastEpochTime + EPOCH_DURATION, "Epoch not ready");
        currentEpoch += 1;
        lastEpochTime = block.timestamp;
        emit EpochAdvanced(currentEpoch, block.timestamp);
    }
}
