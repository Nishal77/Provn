// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockREPToken
 * @notice Governance token for OpenRepDAO.
 *
 * REP = Reputation token. Minted by ATTESTA to verified users.
 * 1 REP = 1 vote in OpenRep DAO governance.
 *
 * Distribution model (Phase 12):
 *   - Verified professionals: earn REP per attestation tier
 *   - Employers: earn REP per successful hire via platform
 *   - University issuers: earn REP per credential issued
 *   - DAO treasury: 20% of total supply for grants
 *
 * This contract is "Mock" for testnet only.
 * Production: replace with non-mintable token + vesting schedule.
 */
contract MockREPToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M REP

    constructor() ERC20("OpenRep Governance Token", "REP") Ownable(msg.sender) {
        // Mint 10M to deployer for testing / initial distribution
        _mint(msg.sender, 10_000_000 * 1e18);
    }

    /**
     * @notice Mint REP to an address (owner only — ATTESTA backend).
     * @param to      Recipient wallet
     * @param amount  Amount in wei (1e18 = 1 REP)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "REP: max supply exceeded");
        _mint(to, amount);
    }

    /**
     * @notice Burn REP from caller's balance.
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
