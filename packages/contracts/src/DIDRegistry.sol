// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DIDRegistry
 * @notice Anchors W3C Decentralized Identifiers (DIDs) on Polygon PoS.
 *
 * Each ATTESTA user gets a DID: "did:attesta:{userId}" (Phase 2, off-chain)
 * that migrates to "did:polygon:{walletAddress}" (Phase 3, on-chain here).
 *
 * The registry stores:
 *   - A pointer to the DID document on IPFS (documentCid)
 *   - The verification tier the user has achieved (T1-T6)
 *   - Timestamps for audit and TTL enforcement
 *
 * Only the contract owner (ATTESTA backend) can register or update DIDs on
 * behalf of users. This keeps gas costs off the user entirely (gasless via
 * EIP-4337 account abstraction in production). Users retain sovereignty via
 * the deactivation function which they call with their own wallet.
 *
 * Security:
 *   - Pausable: owner can halt all writes during an incident
 *   - No PII ever stored — only IPFS CIDs and cryptographic hashes
 *   - DID documents themselves are stored on IPFS (content-addressed)
 */
contract DIDRegistry is Ownable, Pausable {
    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    enum VerificationTier {
        None,   // 0 — not registered
        Self,   // 1 — T6 self-attested (score 1/10)
        AI,     // 2 — T5 AI-inferred (score 5/10)
        Peer,   // 3 — T4 peer co-attested (score 6/10)
        Institution, // 4 — T3 institution (score 8/10)
        Employer,    // 5 — T2 employer co-signed (score 9/10)
        Government   // 6 — T1 government ID (score 10/10)
    }

    struct DIDDocument {
        string did;            // "did:polygon:0x..."
        string documentCid;    // IPFS CID of the DID document JSON
        address controller;    // wallet address that controls this DID
        VerificationTier tier; // highest achieved verification tier
        uint256 registeredAt;  // block.timestamp at registration
        uint256 updatedAt;     // block.timestamp of last update
        bool active;           // false after deactivation (GDPR erasure)
    }

    // ─────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────

    // did string → document
    mapping(string => DIDDocument) private _documents;

    // wallet address → did string (for reverse lookup)
    mapping(address => string) private _addressToDid;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event DIDRegistered(
        string indexed did,
        address indexed controller,
        string documentCid,
        VerificationTier tier,
        uint256 timestamp
    );

    event DIDUpdated(
        string indexed did,
        string newDocumentCid,
        VerificationTier newTier,
        uint256 timestamp
    );

    event DIDDeactivated(
        string indexed did,
        address indexed controller,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────

    error DIDAlreadyRegistered(string did);
    error DIDNotFound(string did);
    error DIDAlreadyDeactivated(string did);
    error NotController(string did, address caller);
    error AddressAlreadyHasDID(address controller);
    error EmptyDID();
    error EmptyCID();

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─────────────────────────────────────────────
    // Write functions (owner-only — gasless for users)
    // ─────────────────────────────────────────────

    /**
     * @notice Register a new DID for a user.
     * @dev Called by the ATTESTA backend after KYC passes. The backend
     *      pays gas so the user experience is fully gasless.
     * @param did        The DID string, e.g. "did:polygon:0x1234..."
     * @param controller The user's wallet address (they own the DID)
     * @param documentCid IPFS CID pointing to the DID document JSON
     * @param tier       The verification tier achieved at registration time
     */
    function register(
        string calldata did,
        address controller,
        string calldata documentCid,
        VerificationTier tier
    ) external onlyOwner whenNotPaused {
        if (bytes(did).length == 0) revert EmptyDID();
        if (bytes(documentCid).length == 0) revert EmptyCID();
        if (_documents[did].registeredAt != 0) revert DIDAlreadyRegistered(did);
        if (bytes(_addressToDid[controller]).length != 0) revert AddressAlreadyHasDID(controller);

        _documents[did] = DIDDocument({
            did: did,
            documentCid: documentCid,
            controller: controller,
            tier: tier,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            active: true
        });

        _addressToDid[controller] = did;

        emit DIDRegistered(did, controller, documentCid, tier, block.timestamp);
    }

    /**
     * @notice Update an existing DID's document CID and/or tier.
     * @dev Called when the user completes a higher verification tier
     *      (e.g. upgrades from T6 Self to T2 Employer co-signed).
     */
    function update(
        string calldata did,
        string calldata newDocumentCid,
        VerificationTier newTier
    ) external onlyOwner whenNotPaused {
        DIDDocument storage doc = _getActiveDocument(did);
        if (bytes(newDocumentCid).length == 0) revert EmptyCID();

        doc.documentCid = newDocumentCid;
        doc.tier = newTier;
        doc.updatedAt = block.timestamp;

        emit DIDUpdated(did, newDocumentCid, newTier, block.timestamp);
    }

    /**
     * @notice Deactivate a DID. Irreversible on-chain.
     * @dev Can be called by either the contract owner (ATTESTA, on GDPR
     *      erasure request) or by the controller wallet directly.
     *      Sets active=false. The IPFS document is unpinned off-chain separately.
     */
    function deactivate(string calldata did) external whenNotPaused {
        DIDDocument storage doc = _getActiveDocument(did);

        bool callerIsOwner = msg.sender == owner();
        bool callerIsController = msg.sender == doc.controller;

        if (!callerIsOwner && !callerIsController) {
            revert NotController(did, msg.sender);
        }

        doc.active = false;
        doc.updatedAt = block.timestamp;

        // Free the address slot so the user could register a new DID later
        delete _addressToDid[doc.controller];

        emit DIDDeactivated(did, doc.controller, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Read functions (public)
    // ─────────────────────────────────────────────

    /**
     * @notice Resolve a DID to its on-chain document record.
     */
    function resolve(string calldata did) external view returns (DIDDocument memory) {
        if (_documents[did].registeredAt == 0) revert DIDNotFound(did);
        return _documents[did];
    }

    /**
     * @notice Look up the DID registered for a wallet address.
     * @return did The DID string, or empty string if none registered.
     */
    function didOf(address controller) external view returns (string memory) {
        return _addressToDid[controller];
    }

    /**
     * @notice Check whether a DID is currently active.
     */
    function isActive(string calldata did) external view returns (bool) {
        return _documents[did].active;
    }

    /**
     * @notice Return the IPFS CID for the DID document.
     */
    function documentCidOf(string calldata did) external view returns (string memory) {
        DIDDocument storage doc = _documents[did];
        if (doc.registeredAt == 0) revert DIDNotFound(did);
        return doc.documentCid;
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────

    function _getActiveDocument(string calldata did) internal view returns (DIDDocument storage) {
        DIDDocument storage doc = _documents[did];
        if (doc.registeredAt == 0) revert DIDNotFound(did);
        if (!doc.active) revert DIDAlreadyDeactivated(did);
        return doc;
    }
}
