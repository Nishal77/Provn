import { createPublicClient, createWalletClient, http, parseAbi, type Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { polygon, polygonMumbai } from 'viem/chains'

// DIDRegistry ABI — only the functions the API needs to call
const DID_REGISTRY_ABI = parseAbi([
  'function register(string did, address controller, string documentCid, uint8 tier) external',
  'function update(string did, string newDocumentCid, uint8 tier) external',
  'function deactivate(string did) external',
  'function resolve(string did) external view returns (tuple(string did, string documentCid, address controller, uint8 tier, uint256 registeredAt, uint256 updatedAt, bool active))',
  'function didOf(address controller) external view returns (string)',
  'function isActive(string did) external view returns (bool)',
  'event DIDRegistered(string indexed did, address indexed controller, string documentCid, uint8 tier, uint256 timestamp)',
  'event DIDUpdated(string indexed did, string newDocumentCid, uint8 tier, uint256 timestamp)',
])

// Maps our VerificationTier enum strings to the Solidity enum uint8 values
const TIER_TO_UINT8: Record<string, number> = {
  NONE: 0,
  T6_SELF: 1,
  T5_AI: 2,
  T4_PEER: 3,
  T3_INSTITUTION: 4,
  T2_EMPLOYER: 5,
  T1_GOVERNMENT: 6,
}

interface BlockchainConfig {
  rpcUrl: string
  privateKey: `0x${string}`
  contractAddress: `0x${string}`
  isMainnet: boolean
}

interface AnchorResult {
  txHash: Hash
  blockNumber: bigint
}

export function createBlockchainService(config: BlockchainConfig) {
  const chain = config.isMainnet ? polygon : polygonMumbai

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  })

  const account = privateKeyToAccount(config.privateKey)

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  })

  /**
   * Anchor a new DID on Polygon. Called after KYC passes.
   * Returns the transaction hash stored in the user's profile for audit.
   */
  async function anchorDID(params: {
    did: string
    controllerAddress: string
    documentCid: string
    tier: string
  }): Promise<AnchorResult> {
    const tierValue = TIER_TO_UINT8[params.tier] ?? 0

    const txHash = await walletClient.writeContract({
      address: config.contractAddress,
      abi: DID_REGISTRY_ABI,
      functionName: 'register',
      args: [
        params.did,
        params.controllerAddress as `0x${string}`,
        params.documentCid,
        tierValue,
      ],
    })

    // Wait for 1 confirmation before returning — fast enough for UX,
    // safe enough that the tx won't be dropped
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    }
  }

  /**
   * Update an existing DID's document CID and tier on-chain.
   * Called when user achieves a higher verification tier.
   */
  async function updateDID(params: {
    did: string
    newDocumentCid: string
    newTier: string
  }): Promise<AnchorResult> {
    const tierValue = TIER_TO_UINT8[params.newTier] ?? 0

    const txHash = await walletClient.writeContract({
      address: config.contractAddress,
      abi: DID_REGISTRY_ABI,
      functionName: 'update',
      args: [params.did, params.newDocumentCid, tierValue],
    })

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    }
  }

  /**
   * Deactivate a DID — called on GDPR erasure requests.
   */
  async function deactivateDID(did: string): Promise<AnchorResult> {
    const txHash = await walletClient.writeContract({
      address: config.contractAddress,
      abi: DID_REGISTRY_ABI,
      functionName: 'deactivate',
      args: [did],
    })

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    }
  }

  /**
   * Read-only: resolve a DID document from the chain.
   */
  async function resolveDID(did: string) {
    return publicClient.readContract({
      address: config.contractAddress,
      abi: DID_REGISTRY_ABI,
      functionName: 'resolve',
      args: [did],
    })
  }

  /**
   * Check whether the contract is reachable (used in health checks).
   */
  async function ping(): Promise<boolean> {
    try {
      await publicClient.getBlockNumber()
      return true
    } catch {
      return false
    }
  }

  return { anchorDID, updateDID, deactivateDID, resolveDID, ping }
}

export type BlockchainService = ReturnType<typeof createBlockchainService>
