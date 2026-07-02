import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()
  const network = await ethers.provider.getNetwork()
  const networkName = network.name
  const chainId = Number(network.chainId)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('\n── DIDRegistry Deployment ───────────────────────')
  console.log('Network:          ', networkName, `(chainId ${chainId})`)
  console.log('Deployer address: ', deployer.address)
  console.log('Deployer balance: ', ethers.formatEther(balance), 'MATIC')

  if (balance === 0n) {
    console.error('\nERROR: Deployer wallet has 0 MATIC. Fund it before deploying.')
    if (chainId === 80001) {
      console.error('Mumbai faucet: https://faucet.polygon.technology/')
    }
    process.exit(1)
  }

  const DIDRegistry = await ethers.getContractFactory('DIDRegistry')

  // The deployer is the initial owner.
  // Production: transfer ownership to a Gnosis Safe multisig after deploy.
  console.log('\nDeploying DIDRegistry...')
  const registry = await DIDRegistry.deploy(deployer.address)
  await registry.waitForDeployment()

  const address = await registry.getAddress()
  const deployTx = registry.deploymentTransaction()

  console.log('DIDRegistry deployed to:', address)
  console.log('Transaction hash:       ', deployTx?.hash ?? 'unknown')

  // Write deployment manifest
  const fs = await import('fs')
  const deploymentInfo = {
    address,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    network: networkName,
    chainId,
    txHash: deployTx?.hash ?? null,
  }

  fs.mkdirSync('./deployments', { recursive: true })
  const outPath = `./deployments/${networkName}.json`
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2))
  console.log('\nDeployment manifest written to', outPath)

  // Polygonscan source verification
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log('\nWaiting 5 block confirmations before Polygonscan verification...')
    await deployTx?.wait(5)

    try {
      const hre = await import('hardhat')
      await hre.run('verify:verify', {
        address,
        constructorArguments: [deployer.address],
      })
      console.log('Contract source verified on Polygonscan.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Already Verified')) {
        console.log('Contract already verified on Polygonscan.')
      } else {
        console.warn('Polygonscan verification failed:', msg)
      }
    }
  } else {
    console.log('\nSkipping Polygonscan verification (POLYGONSCAN_API_KEY not set).')
  }

  // ── Post-deploy instructions ────────────────────────────────
  const envKey = chainId === 137
    ? 'POLYGON_DID_REGISTRY_ADDRESS'
    : chainId === 80001
      ? 'MUMBAI_DID_REGISTRY_ADDRESS'
      : 'DID_REGISTRY_ADDRESS'

  const polygonscanBase = chainId === 80001
    ? 'https://mumbai.polygonscan.com/address'
    : 'https://polygonscan.com/address'

  console.log('\n── Next steps ───────────────────────────────────')
  console.log(`1. Add to your .env file:`)
  console.log(`   ${envKey}="${address}"`)
  console.log(`   DID_REGISTRY_ADDRESS="${address}"`)
  console.log(`2. View on Polygonscan: ${polygonscanBase}/${address}`)
  if (chainId === 137) {
    console.log('3. Transfer contract ownership to a Gnosis Safe multisig:')
    console.log(`   npx hardhat run scripts/transfer-ownership.ts --network polygon`)
  }
  console.log('─────────────────────────────────────────────────\n')
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
