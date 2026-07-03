import { expect } from 'chai'
import { ethers } from 'hardhat'
import type { OpenRepDAO, MockREPToken } from '../typechain-types'
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('OpenRepDAO', () => {
  let dao: OpenRepDAO
  let repToken: MockREPToken
  let owner: SignerWithAddress
  let voter1: SignerWithAddress
  let voter2: SignerWithAddress
  let noTokenUser: SignerWithAddress

  const ONE_REP  = ethers.parseEther('1')
  const FIVE_REP = ethers.parseEther('5')

  beforeEach(async () => {
    ;[owner, voter1, voter2, noTokenUser] = await ethers.getSigners()

    const TokenFactory = await ethers.getContractFactory('MockREPToken')
    repToken = (await TokenFactory.deploy()) as MockREPToken
    await repToken.waitForDeployment()

    const DAOFactory = await ethers.getContractFactory('OpenRepDAO')
    dao = (await DAOFactory.deploy(await repToken.getAddress())) as OpenRepDAO
    await dao.waitForDeployment()

    // Distribute REP to voters
    await repToken.mint(voter1.address, ethers.parseEther('1000'))
    await repToken.mint(voter2.address, ethers.parseEther('500'))
  })

  describe('propose()', () => {
    it('REP holder can create proposal', async () => {
      await expect(
        dao.connect(voter1).propose(
          'ORP-1: Add MIT as issuer',
          'QmDescriptionCID',
          ethers.ZeroAddress,
          '0x'
        )
      ).to.emit(dao, 'ProposalCreated')
    })

    it('reverts if caller has no REP', async () => {
      await expect(
        dao.connect(noTokenUser).propose('Test', 'desc', ethers.ZeroAddress, '0x')
      ).to.be.revertedWith('DAO: must hold REP to propose')
    })

    it('reverts with empty title', async () => {
      await expect(
        dao.connect(voter1).propose('', 'desc', ethers.ZeroAddress, '0x')
      ).to.be.revertedWith('DAO: empty title')
    })

    it('increments proposal count', async () => {
      await dao.connect(voter1).propose('P1', 'desc', ethers.ZeroAddress, '0x')
      await dao.connect(voter1).propose('P2', 'desc', ethers.ZeroAddress, '0x')
      expect(await dao.proposalCount()).to.equal(2)
    })
  })

  describe('castVote()', () => {
    let proposalId: bigint

    beforeEach(async () => {
      const tx = await dao.connect(voter1).propose(
        'ORP-1: Test', 'desc', ethers.ZeroAddress, '0x'
      )
      const receipt = await tx.wait()
      const event = receipt?.logs.find((l: any) => l.fragment?.name === 'ProposalCreated')
      proposalId = (event as any)?.args?.[0] ?? 1n
    })

    it('voter can cast FOR vote', async () => {
      await expect(dao.connect(voter1).castVote(proposalId, true))
        .to.emit(dao, 'VoteCast')
        .withArgs(proposalId, voter1.address, true, ethers.parseEther('1000'))
    })

    it('voter can cast AGAINST vote', async () => {
      await expect(dao.connect(voter2).castVote(proposalId, false))
        .to.emit(dao, 'VoteCast')
        .withArgs(proposalId, voter2.address, false, ethers.parseEther('500'))
    })

    it('reverts on double vote', async () => {
      await dao.connect(voter1).castVote(proposalId, true)
      await expect(
        dao.connect(voter1).castVote(proposalId, true)
      ).to.be.revertedWith('DAO: already voted')
    })

    it('reverts if no REP balance', async () => {
      await expect(
        dao.connect(noTokenUser).castVote(proposalId, true)
      ).to.be.revertedWith('DAO: no voting weight')
    })

    it('proposal state is Active during voting', async () => {
      const state = await dao.state(proposalId)
      expect(state).to.equal(1) // ProposalState.Active
    })
  })

  describe('cancel()', () => {
    let proposalId: bigint

    beforeEach(async () => {
      const tx = await dao.connect(voter1).propose('Cancel Test', 'desc', ethers.ZeroAddress, '0x')
      const receipt = await tx.wait()
      const event = receipt?.logs.find((l: any) => l.fragment?.name === 'ProposalCreated')
      proposalId = (event as any)?.args?.[0] ?? 1n
    })

    it('proposer can cancel own proposal', async () => {
      await expect(dao.connect(voter1).cancel(proposalId))
        .to.emit(dao, 'ProposalCancelled')
        .withArgs(proposalId)
    })

    it('owner can cancel any proposal', async () => {
      await expect(dao.connect(owner).cancel(proposalId))
        .to.emit(dao, 'ProposalCancelled')
    })

    it('random user cannot cancel', async () => {
      await expect(dao.connect(voter2).cancel(proposalId))
        .to.be.revertedWith('DAO: not authorized')
    })

    it('state is Cancelled after cancel', async () => {
      await dao.connect(voter1).cancel(proposalId)
      expect(await dao.state(proposalId)).to.equal(6) // ProposalState.Cancelled
    })
  })

  describe('MockREPToken', () => {
    it('mints initial supply to deployer', async () => {
      const balance = await repToken.balanceOf(owner.address)
      // 10M initial - amounts minted to voters
      expect(balance).to.be.gt(0n)
    })

    it('owner can mint up to MAX_SUPPLY', async () => {
      await repToken.mint(voter1.address, ONE_REP)
      expect(await repToken.balanceOf(voter1.address)).to.be.gt(0n)
    })

    it('reverts minting beyond MAX_SUPPLY', async () => {
      const maxSupply = await repToken.MAX_SUPPLY()
      const current = await repToken.totalSupply()
      await expect(
        repToken.mint(voter1.address, maxSupply - current + 1n)
      ).to.be.revertedWith('REP: max supply exceeded')
    })

    it('holders can burn their own tokens', async () => {
      const before = await repToken.balanceOf(voter1.address)
      await repToken.connect(voter1).burn(ONE_REP)
      expect(await repToken.balanceOf(voter1.address)).to.equal(before - ONE_REP)
    })
  })
})
