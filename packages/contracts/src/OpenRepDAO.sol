// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OpenRepDAO
 * @notice Community governance for the OpenRep protocol.
 *
 * Design (Red Hat/Linux model):
 *   - ATTESTA Inc = reference implementation; protocol governed by DAO
 *   - Token-weighted voting: 1 REP = 1 vote (ERC-20 gov token)
 *   - Timelock: 48h delay before proposal execution (safety buffer)
 *   - Quorum: 4% of total supply must vote FOR
 *   - Majority: >50% of votes cast must be FOR
 *
 * Scope of proposals:
 *   - Protocol parameter changes (e.g. tier weights)
 *   - Issuer registry additions / removals
 *   - Fee model changes for OpenRep API
 *   - OpenRep SDK version adoptions
 *   - Treasury spending (if treasury added later)
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract OpenRepDAO is Ownable, ReentrancyGuard {
    // ──────────────────────────── STATE ────────────────────────────

    IERC20 public immutable repToken;

    uint256 public constant VOTING_PERIOD  = 7 days;
    uint256 public constant TIMELOCK_DELAY = 48 hours;
    uint256 public constant QUORUM_BPS     = 400;   // 4% of total supply
    uint256 public constant BPS_DENOM      = 10_000;

    enum ProposalState { Pending, Active, Defeated, Succeeded, Queued, Executed, Cancelled }

    struct Proposal {
        uint256 id;
        address proposer;
        string  title;
        string  description;       // IPFS CID preferred for long descriptions
        bytes   callData;          // encoded target call (optional on-chain action)
        address target;
        uint256 startAt;
        uint256 endAt;
        uint256 executionAvailableAt;
        uint256 forVotes;
        uint256 againstVotes;
        bool    executed;
        bool    cancelled;
    }

    uint256 private _nextProposalId = 1;
    mapping(uint256 => Proposal) public proposals;
    // proposalId → voter → hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // List of all proposal IDs for enumeration
    uint256[] private _proposalIds;

    // ──────────────────────────── EVENTS ───────────────────────────

    event ProposalCreated(uint256 indexed id, address indexed proposer, string title, uint256 startAt, uint256 endAt);
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event ProposalQueued(uint256 indexed id, uint256 executionAvailableAt);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);

    // ──────────────────────────── CONSTRUCTOR ──────────────────────

    constructor(address _repToken) Ownable(msg.sender) {
        repToken = IERC20(_repToken);
    }

    // ──────────────────────────── PROPOSE ──────────────────────────

    /**
     * @notice Create a new governance proposal.
     * @param title       Short title (max 100 chars recommended)
     * @param description IPFS CID or inline text (max 2000 chars)
     * @param target      Contract address for on-chain execution (address(0) = signal-only)
     * @param callData    ABI-encoded call to execute after timelock (bytes("") = no action)
     */
    function propose(
        string calldata title,
        string calldata description,
        address target,
        bytes  calldata callData
    ) external returns (uint256 proposalId) {
        require(bytes(title).length > 0, "DAO: empty title");
        require(repToken.balanceOf(msg.sender) > 0, "DAO: must hold REP to propose");

        proposalId = _nextProposalId++;
        uint256 startAt = block.timestamp;
        uint256 endAt   = startAt + VOTING_PERIOD;

        proposals[proposalId] = Proposal({
            id:                     proposalId,
            proposer:               msg.sender,
            title:                  title,
            description:            description,
            callData:               callData,
            target:                 target,
            startAt:                startAt,
            endAt:                  endAt,
            executionAvailableAt:   0,
            forVotes:               0,
            againstVotes:           0,
            executed:               false,
            cancelled:              false
        });

        _proposalIds.push(proposalId);
        emit ProposalCreated(proposalId, msg.sender, title, startAt, endAt);
    }

    // ──────────────────────────── VOTE ─────────────────────────────

    /**
     * @notice Cast a vote on an active proposal.
     * @param proposalId ID of the proposal
     * @param support    true = FOR, false = AGAINST
     */
    function castVote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "DAO: proposal not found");
        require(block.timestamp >= p.startAt, "DAO: voting not started");
        require(block.timestamp <= p.endAt,   "DAO: voting ended");
        require(!p.cancelled,                 "DAO: cancelled");
        require(!hasVoted[proposalId][msg.sender], "DAO: already voted");

        uint256 weight = repToken.balanceOf(msg.sender);
        require(weight > 0, "DAO: no voting weight");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    // ──────────────────────────── QUEUE ────────────────────────────

    /**
     * @notice Queue a succeeded proposal for execution (starts timelock).
     */
    function queue(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Succeeded, "DAO: proposal not succeeded");
        Proposal storage p = proposals[proposalId];
        p.executionAvailableAt = block.timestamp + TIMELOCK_DELAY;
        emit ProposalQueued(proposalId, p.executionAvailableAt);
    }

    // ──────────────────────────── EXECUTE ──────────────────────────

    /**
     * @notice Execute a queued proposal after the timelock expires.
     */
    function execute(uint256 proposalId) external nonReentrant {
        require(state(proposalId) == ProposalState.Queued, "DAO: not queued");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.executionAvailableAt, "DAO: timelock not expired");

        p.executed = true;

        // Execute on-chain action if specified
        if (p.target != address(0) && p.callData.length > 0) {
            (bool success, ) = p.target.call(p.callData);
            require(success, "DAO: execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    // ──────────────────────────── CANCEL ───────────────────────────

    /**
     * @notice Cancel a proposal (proposer only, or owner for emergencies).
     */
    function cancel(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "DAO: not found");
        require(!p.executed, "DAO: already executed");
        require(msg.sender == p.proposer || msg.sender == owner(), "DAO: not authorized");
        p.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    // ──────────────────────────── STATE VIEW ───────────────────────

    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "DAO: not found");

        if (p.cancelled) return ProposalState.Cancelled;
        if (p.executed)  return ProposalState.Executed;

        if (block.timestamp < p.startAt) return ProposalState.Pending;
        if (block.timestamp <= p.endAt)  return ProposalState.Active;

        // Voting ended — check quorum + majority
        uint256 totalSupply = repToken.totalSupply();
        uint256 quorum      = (totalSupply * QUORUM_BPS) / BPS_DENOM;
        bool    quorumMet   = p.forVotes >= quorum;
        bool    majority    = p.forVotes > p.againstVotes;

        if (!quorumMet || !majority) return ProposalState.Defeated;

        if (p.executionAvailableAt == 0) return ProposalState.Succeeded;
        return ProposalState.Queued;
    }

    // ──────────────────────────── VIEWS ────────────────────────────

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function proposalCount() external view returns (uint256) {
        return _proposalIds.length;
    }

    function listProposalIds() external view returns (uint256[] memory) {
        return _proposalIds;
    }
}
