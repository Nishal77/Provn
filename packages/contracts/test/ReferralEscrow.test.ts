import { expect } from 'chai'
import { ethers } from 'hardhat'
import type { ReferralEscrow } from '../typechain-types'
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { time } from '@nomicfoundation/hardhat-network-helpers'

describe('ReferralEscrow', () => {
  let escrow: ReferralEscrow
  let owner: SignerWithAddress
  let employer: SignerWithAddress
  let referrer: SignerWithAddress
  let platform: SignerWithAddress

  const TEN_MATIC = ethers.parseEther('10')
  const ROLE_HASH = ethers.keccak256(ethers.toUtf8Bytes('role-xyz'))

  // 90 days in seconds
  const TRANCHE2_DELAY = 90 * 24 * 60 * 60
  // 180 days in seconds
  const TRANCHE3_DELAY = 180 * 24 * 60 * 60

  beforeEach(async () => {
    ;[owner, employer, referrer, platform] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('ReferralEscrow')
    escrow = (await Factory.deploy(
      employer.address,
      referrer.address,
      platform.address,
      ROLE_HASH,
      { value: TEN_MATIC }
    )) as ReferralEscrow
    await escrow.waitForDeployment()
  })

  it('holds the correct balance', async () => {
    const address = await escrow.getAddress()
    const balance = await ethers.provider.getBalance(address)
    expect(balance).to.equal(TEN_MATIC)
  })

  describe('releaseTranche1()', () => {
    it('owner releases tranche1 to referrer (33% minus platform fee)', async () => {
      const before = await ethers.provider.getBalance(referrer.address)
      await escrow.connect(owner).releaseTranche1()
      const after = await ethers.provider.getBalance(referrer.address)
      // 33% of 10 MATIC = 3.3 MATIC, minus 5% platform fee ≈ 3.135 MATIC
      expect(after - before).to.be.gt(ethers.parseEther('3'))
    })

    it('reverts double release', async () => {
      await escrow.connect(owner).releaseTranche1()
      await expect(escrow.connect(owner).releaseTranche1()).to.be.reverted
    })

    it('reverts if non-owner calls', async () => {
      await expect(
        escrow.connect(employer).releaseTranche1()
      ).to.be.revertedWithCustomError(escrow, 'OwnableUnauthorizedAccount')
    })
  })

  describe('releaseTranche2()', () => {
    beforeEach(async () => {
      await escrow.connect(owner).releaseTranche1()
    })

    it('reverts before 90 days', async () => {
      await expect(escrow.connect(owner).releaseTranche2()).to.be.reverted
    })

    it('releases after 90 days', async () => {
      await time.increase(TRANCHE2_DELAY + 1)
      const before = await ethers.provider.getBalance(referrer.address)
      await escrow.connect(owner).releaseTranche2()
      const after = await ethers.provider.getBalance(referrer.address)
      expect(after).to.be.gt(before)
    })
  })

  describe('releaseTranche3()', () => {
    beforeEach(async () => {
      await escrow.connect(owner).releaseTranche1()
      await time.increase(TRANCHE2_DELAY + 1)
      await escrow.connect(owner).releaseTranche2()
    })

    it('reverts before 180 days', async () => {
      await expect(escrow.connect(owner).releaseTranche3()).to.be.reverted
    })

    it('releases final tranche after 180 days', async () => {
      await time.increase(TRANCHE3_DELAY + 1)
      const before = await ethers.provider.getBalance(referrer.address)
      await escrow.connect(owner).releaseTranche3()
      const after = await ethers.provider.getBalance(referrer.address)
      expect(after).to.be.gt(before)
    })
  })

  describe('refundEmployer()', () => {
    it('owner can refund remaining funds to employer', async () => {
      const before = await ethers.provider.getBalance(employer.address)
      await escrow.connect(owner).refundEmployer()
      const after = await ethers.provider.getBalance(employer.address)
      expect(after).to.be.gt(before)
    })

    it('reverts after tranche1 released', async () => {
      await escrow.connect(owner).releaseTranche1()
      await expect(escrow.connect(owner).refundEmployer()).to.be.reverted
    })
  })
})
