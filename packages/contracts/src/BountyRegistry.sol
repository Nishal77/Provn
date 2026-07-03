// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ReferralEscrow.sol";

/**
 * @title BountyRegistry
 * @notice Open bounty board for TrustChain Talent.
 *         Employers post bounties; ATTESTA creates ReferralEscrow on successful referral.
 *
 * @dev Certik audit required before mainnet.
 */
contract BountyRegistry is Ownable, ReentrancyGuard {
    struct Bounty {
        address employer;
        uint256 amount;       // MATIC (wei)
        bytes32 roleHash;     // keccak256(roleId) — no PII on-chain
        bool active;
        address escrowAddress;
    }

    mapping(bytes32 => Bounty) public bounties; // roleHash → Bounty
    address[] public activeBountyRoleHashes;     // for iteration (off-chain indexer preferred)

    // 5% platform fee
    uint256 public constant PLATFORM_FEE_BPS = 500;
    address public feeRecipient;

    event BountyPosted(bytes32 indexed roleHash, address indexed employer, uint256 amount);
    event EscrowCreated(bytes32 indexed roleHash, address escrowAddress, address referrer, address candidate);
    event BountyWithdrawn(bytes32 indexed roleHash, address employer);

    error BountyAlreadyExists(bytes32 roleHash);
    error BountyNotFound(bytes32 roleHash);
    error BountyNotActive(bytes32 roleHash);
    error InsufficientFunds();

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
    }

    // ─── Employer: post bounty ────────────────────────────────────────────────

    /// @param roleHash keccak256(abi.encodePacked(roleId)) — caller computes off-chain
    function postBounty(bytes32 roleHash) external payable nonReentrant {
        if (bounties[roleHash].active) revert BountyAlreadyExists(roleHash);
        if (msg.value == 0) revert InsufficientFunds();

        bounties[roleHash] = Bounty({
            employer: msg.sender,
            amount: msg.value,
            roleHash: roleHash,
            active: true,
            escrowAddress: address(0)
        });

        emit BountyPosted(roleHash, msg.sender, msg.value);
    }

    // ─── ATTESTA: create escrow on hire ──────────────────────────────────────

    function createEscrow(
        bytes32 roleHash,
        address referrer,
        address candidate
    ) external onlyOwner nonReentrant returns (address escrow) {
        Bounty storage b = bounties[roleHash];
        if (b.amount == 0) revert BountyNotFound(roleHash);
        if (!b.active) revert BountyNotActive(roleHash);

        // Deduct platform fee
        uint256 fee = (b.amount * PLATFORM_FEE_BPS) / 10_000;
        uint256 net = b.amount - fee;
        _send(feeRecipient, fee);

        // Deploy escrow funded with net bounty
        ReferralEscrow e = new ReferralEscrow{value: net}(referrer, candidate, b.employer);
        b.active = false;
        b.escrowAddress = address(e);

        emit EscrowCreated(roleHash, address(e), referrer, candidate);
        return address(e);
    }

    // ─── Employer: withdraw if not yet filled ─────────────────────────────────

    function withdrawBounty(bytes32 roleHash) external nonReentrant {
        Bounty storage b = bounties[roleHash];
        if (!b.active) revert BountyNotActive(roleHash);
        require(msg.sender == b.employer, "BountyRegistry: not employer");

        uint256 amt = b.amount;
        b.active = false;
        b.amount = 0;
        _send(b.employer, amt);

        emit BountyWithdrawn(roleHash, b.employer);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "BountyRegistry: transfer failed");
    }

    function setFeeRecipient(address _fr) external onlyOwner { feeRecipient = _fr; }

    receive() external payable {}
}
