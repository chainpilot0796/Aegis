// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Aegis USD", "A-USDC") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000_000_000 * 10 ** DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function faucet(address to, uint256 amount) external {
        require(amount <= 1_000_000 * 10 ** DECIMALS, "Max 1M per faucet");
        _mint(to, amount);
    }
}
