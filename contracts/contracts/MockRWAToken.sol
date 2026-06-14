// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockRWAToken
 * @notice Testnet stand-in for a Mantle real-world asset (USDY, mETH, …).
 *         Real USDY/mETH only exist on Mantle mainnet; on Mantle Sepolia we mint
 *         a faucet-backed mock so the full Aegis shield flow can be demonstrated
 *         end-to-end. Name / symbol / decimals are set at construction so one
 *         contract serves every asset class.
 *
 *         Decimals are kept at 6 to match the Aegis settlement math (the vault
 *         treats deposits as plain integer units). On mainnet the vault is
 *         pointed at the canonical USDY address instead of this mock.
 */
contract MockRWAToken is ERC20, Ownable {
    uint8 private immutable _decimals;
    uint256 public immutable faucetCap;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _decimals = decimals_;
        faucetCap = 1_000_000 * 10 ** decimals_;
        _mint(msg.sender, 1_000_000_000_000 * 10 ** decimals_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Open faucet so any judge/wallet can pull test RWA tokens.
    function faucet(address to, uint256 amount) external {
        require(amount <= faucetCap, "Exceeds faucet cap");
        _mint(to, amount);
    }
}
