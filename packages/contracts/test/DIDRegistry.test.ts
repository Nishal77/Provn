import { expect } from 'chai'
import { ethers } from 'hardhat'
import type { DIDRegistry } from '../artifacts/types'
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

const VerificationTier = {
  None: 0,
  Self: 1,
  AI: 2,
  Peer: 3,
  Institution: 4,
  Employer: 5,
  Government: 6,
}

describe('DIDRegistry', () => {
  let registry: DIDRegistry
  let owner: HardhatEthersSigner
  let user1: HardhatEthersSigner
  let user2: HardhatEthersSigner

  const DID_1 = 'did:polygon:0xabc123'
  const CID_1 = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
  const CID_2 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'

  beforeEach(async () => {
    ;[owner, user1, user2] = await ethers.getSigners()
    const Factory = await ethers.getContractFactory('DIDRegistry')
    registry = (await Factory.deploy(owner.address)) as DIDRegistry
    await registry.waitForDeployment()
  })

  describe('register', () => {
    it('registers a DID and emits event', async () => {
      await expect(
        registry.register(DID_1, user1.address, CID_1, VerificationTier.Government)
      )
        .to.emit(registry, 'DIDRegistered')
        .withArgs(DID_1, user1.address, CID_1, VerificationTier.Government, await latestTimestamp())

      const doc = await registry.resolve(DID_1)
      expect(doc.did).to.equal(DID_1)
      expect(doc.controller).to.equal(user1.address)
      expect(doc.documentCid).to.equal(CID_1)
      expect(doc.tier).to.equal(VerificationTier.Government)
      expect(doc.active).to.be.true
    })

    it('creates reverse address→DID mapping', async () => {
      await registry.register(DID_1, user1.address, CID_1, VerificationTier.Government)
      expect(await registry.didOf(user1.address)).to.equal(DID_1)
    })

    it('reverts if DID already registered', async () => {
      await registry.register(DID_1, user1.address, CID_1, VerificationTier.Self)
      await expect(
        registry.register(DID_1, user2.address, CID_2, VerificationTier.Self)
      ).to.be.revertedWithCustomError(registry, 'DIDAlreadyRegistered')
    })

    it('reverts if address already has a DID', async () => {
      await registry.register(DID_1, user1.address, CID_1, VerificationTier.Self)
      await expect(
        registry.register('did:polygon:0xother', user1.address, CID_2, VerificationTier.Self)
      ).to.be.revertedWithCustomError(registry, 'AddressAlreadyHasDID')
    })

    it('reverts for non-owner caller', async () => {
      await expect(
        registry.connect(user1).register(DID_1, user1.address, CID_1, VerificationTier.Self)
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount')
    })

    it('reverts for empty DID string', async () => {
      await expect(
        registry.register('', user1.address, CID_1, VerificationTier.Self)
      ).to.be.revertedWithCustomError(registry, 'EmptyDID')
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      await registry.register(DID_1, user1.address, CID_1, VerificationTier.Self)
    })

    it('updates document CID and tier', async () => {
      await expect(
        registry.update(DID_1, CID_2, VerificationTier.Government)
      )
        .to.emit(registry, 'DIDUpdated')
        .withArgs(DID_1, CID_2, VerificationTier.Government, await latestTimestamp())

      const doc = await registry.resolve(DID_1)
      expect(doc.documentCid).to.equal(CID_2)
      expect(doc.tier).to.equal(VerificationTier.Government)
    })

    it('reverts for non-owner', async () => {
      await expect(
        registry.connect(user1).update(DID_1, CID_2, VerificationTier.Government)
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount')
    })
  })

  describe('deactivate', () => {
    beforeEach(async () => {
      await registry.register(DID_1, user1.address, CID_1, VerificationTier.Government)
    })

    it('owner can deactivate', async () => {
      await expect(registry.deactivate(DID_1))
        .to.emit(registry, 'DIDDeactivated')
        .withArgs(DID_1, user1.address, await latestTimestamp())

      expect(await registry.isActive(DID_1)).to.be.false
    })

    it('controller can deactivate their own DID', async () => {
      await registry.connect(user1).deactivate(DID_1)
      expect(await registry.isActive(DID_1)).to.be.false
    })

    it('frees address slot after deactivation', async () => {
      await registry.deactivate(DID_1)
      expect(await registry.didOf(user1.address)).to.equal('')
    })

    it('reverts if caller is neither owner nor controller', async () => {
      await expect(
        registry.connect(user2).deactivate(DID_1)
      ).to.be.revertedWithCustomError(registry, 'NotController')
    })

    it('reverts on double deactivation', async () => {
      await registry.deactivate(DID_1)
      await expect(registry.deactivate(DID_1)).to.be.revertedWithCustomError(
        registry,
        'DIDAlreadyDeactivated'
      )
    })
  })

  describe('pause', () => {
    it('paused registry rejects register', async () => {
      await registry.pause()
      await expect(
        registry.register(DID_1, user1.address, CID_1, VerificationTier.Self)
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause')
    })

    it('unpausing allows writes again', async () => {
      await registry.pause()
      await registry.unpause()
      await expect(
        registry.register(DID_1, user1.address, CID_1, VerificationTier.Self)
      ).to.not.be.reverted
    })
  })
})

async function latestTimestamp() {
  const block = await ethers.provider.getBlock('latest')
  return block!.timestamp
}
