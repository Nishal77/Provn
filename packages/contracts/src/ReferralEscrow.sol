// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReferralEscrow
 * @notice Holds bounty ETH/MATIC for a TrustChain referral and releases
 *         in three tranches: 33% at hire, 33% at 90 days, 34% at 180 days.
 *
 * @dev Deploy one contract per referral (created by BountyRegistry).
 *      Certik audit required before mainnet.
 */
contract ReferralEscrow is Ownable, ReentrancyGuard {
    address public immutable referrer;
    address public immutable candidate;
    address public immutable employer;

    uint256 public immutable bountyTotal;
    uint256 public immutable hireTimestamp;

    bool public tranche1Released;
    bool public tranche2Released;
    bool public tranche3Released;

    // 33 / 33 / 34 basis-point split (out of 100)
    uint8[3] public tranchePercents = [33, 33, 34];

    // Unlock windows after hire
    uint256 public constant TRANCHE2_DELAY = 90 days;
    uint256 public constant TRANCHE3_DELAY = 180 days;

    event TrancheReleased(uint8 indexed tranche, uint256 amount, address to);
    event RefundIssued(uint256 amount, address to);

    error TrancheAlreadyReleased(uint8 tranche);
    error TrancheLocked(uint8 tranche, uint256 unlockTime);
    error ZeroBalance();

    constructor(
        address _referrer,
        address _candidate,
        address _employer
    ) payable Ownable(msg.sender) {
        require(msg.value > 0, "ReferralEscrow: must fund on deploy");
        referrer = _referrer;
        candidate = _candidate;
        employer = _employer;
        bountyTotal = msg.value;
        hireTimestamp = block.timestamp;
    }

    // ─── Tranche releases ────────────────────────────────────────────────────

    /// @notice Release tranche 1 (33%) immediately at hire. Callable by owner (ATTESTA).
    function releaseTranche1() external onlyOwner nonReentrant {
        if (tranche1Released) revert TrancheAlreadyReleased(1);
        tranche1Released = true;
        uint256 amount = (bountyTotal * tranchePercents[0]) / 100;
        _send(referrer, amount);
        emit TrancheReleased(1, amount, referrer);
    }

    /// @notice Release tranche 2 (33%) after 90 days.
    function releaseTranche2() external onlyOwner nonReentrant {
        if (tranche2Released) revert TrancheAlreadyReleased(2);
        if (block.timestamp < hireTimestamp + TRANCHE2_DELAY)
            revert TrancheLocked(2, hireTimestamp + TRANCHE2_DELAY);
        tranche2Released = true;
        uint256 amount = (bountyTotal * tranchePercents[1]) / 100;
        _send(referrer, amount);
        emit TrancheReleased(2, amount, referrer);
    }

    /// @notice Release tranche 3 (34%) after 180 days.
    function releaseTranche3() external onlyOwner nonReentrant {
        if (tranche3Released) revert TrancheAlreadyReleased(3);
        if (block.timestamp < hireTimestamp + TRANCHE3_DELAY)
            revert TrancheLocked(3, hireTimestamp + TRANCHE3_DELAY);
        tranche3Released = true;
        uint256 amount = address(this).balance; // remainder covers rounding
        _send(referrer, amount);
        emit TrancheReleased(3, amount, referrer);
    }

    /// @notice Refund remaining balance to employer (e.g., candidate leaves before 180d).
    function refundEmployer() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert ZeroBalance();
        _send(employer, bal);
        emit RefundIssued(bal, employer);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ReferralEscrow: transfer failed");
    }

    receive() external payable {}
}
