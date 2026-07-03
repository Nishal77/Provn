import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying OpenRepDAO with:', deployer.address)

  // In production: deploy REP governance token first, then pass address here.
  // For dev: deploy a simple mock ERC20.
  const REPToken = await ethers.getContractFactory('MockREPToken')
  const repToken = await REPToken.deploy()
  await repToken.waitForDeployment()
  console.log('REP token:', await repToken.getAddress())

  const OpenRepDAO = await ethers.getContractFactory('OpenRepDAO')
  const dao = await OpenRepDAO.deploy(await repToken.getAddress())
  await dao.waitForDeployment()
  console.log('OpenRepDAO:', await dao.getAddress())
}

main().catch(e => { console.error(e); process.exit(1) })
