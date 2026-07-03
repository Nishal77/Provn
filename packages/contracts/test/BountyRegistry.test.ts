import { expect } from 'chai'
import { ethers } from 'hardhat'
import type { BountyRegistry } from '../typechain-types'
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('BountyRegistry', () => {
  let registry: BountyRegistry
  let owner: SignerWithAddress
  let employer: SignerWithAddress
  let referrer: SignerWithAddress
  let candidate: SignerWithAddress

  const ROLE_HASH = ethers.keccak256(ethers.toUtf8Bytes('role-abc-123'))
  const ONE_MATIC  = ethers.parseEther('1')
  const TEN_MATIC  = ethers.parseEther('10')

  beforeEach(async () => {
    ;[owner, employer, referrer, candidate] = await ethers.getSigners()
    const Factory = await ethers.getContractFactory('BountyRegistry')
    registry = (await Factory.deploy()) as BountyRegistry
    await registry.waitForDeployment()
  })

  describe('postBounty()', () => {
    it('employer posts a bounty', async () => {
      await expect(
        registry.connect(employer).postBounty(ROLE_HASH, { value: TEN_MATIC })
      ).to.emit(registry, 'BountyPosted')

      const bounty = await registry.getBounty(ROLE_HASH)
      expect(bounty.employer).to.equal(employer.address)
      expect(bounty.total).to.equal(TEN_MATIC)
      expect(bounty.active).to.be.true
    })

    it('reverts if bounty already exists for role', async () => {
      await registry.connect(employer).postBounty(ROLE_HASH, { value: TEN_MATIC })
      await expect(
        registry.connect(employer).postBounty(ROLE_HASH, { value: TEN_MATIC })
      ).to.be.reverted
    })

    it('reverts with zero value', async () => {
      await expect(
        registry.connect(employer).postBounty(ROLE_HASH, { value: 0 })
      ).to.be.reverted
    })
  })

  describe('createEscrow()', () => {
    beforeEach(async () => {
      await registry.connect(employer).postBounty(ROLE_HASH, { value: TEN_MATIC })
    })

    it('owner creates escrow and deploys ReferralEscrow', async () => {
      const tx = await registry.connect(owner).createEscrow(
        ROLE_HASH, referrer.address, candidate.address
      )
      const receipt = await tx.wait()
      expect(receipt?.status).to.equal(1)
    })

    it('reverts if non-owner calls createEscrow', async () => {
      await expect(
        registry.connect(employer).createEscrow(ROLE_HASH, referrer.address, candidate.address)
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount')
    })
  })
})
