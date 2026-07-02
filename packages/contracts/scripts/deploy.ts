import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying DIDRegistry...')
  console.log('Deployer address:', deployer.address)
  console.log('Deployer balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'MATIC')

  const DIDRegistry = await ethers.getContractFactory('DIDRegistry')

  // The deployer is the initial owner. In production this should be a
  // multisig (Gnosis Safe) rather than a single EOA.
  const registry = await DIDRegistry.deploy(deployer.address)
  await registry.waitForDeployment()

  const address = await registry.getAddress()
  console.log('DIDRegistry deployed to:', address)
  console.log('Network:', (await ethers.provider.getNetwork()).name)

  // Write deployment info to a file so the API can pick it up
  const fs = await import('fs')
  const deploymentInfo = {
    address,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
  }

  const outPath = `./deployments/${deploymentInfo.network}.json`
  fs.mkdirSync('./deployments', { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2))
  console.log('Deployment info written to', outPath)

  // Verify on Polygonscan if API key is set
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log('Waiting 5 blocks before verification...')
    await registry.deploymentTransaction()?.wait(5)

    try {
      const hre = await import('hardhat')
      await hre.run('verify:verify', {
        address,
        constructorArguments: [deployer.address],
      })
      console.log('Contract verified on Polygonscan')
    } catch (err) {
      console.warn('Verification failed (may already be verified):', err)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
