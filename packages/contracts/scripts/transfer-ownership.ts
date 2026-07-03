/**
 * transfer-ownership.ts
 * Transfers DIDRegistry + BountyRegistry ownership to a Gnosis Safe multisig.
 * Run AFTER mainnet deploy. Required before going live.
 *
 * Usage:
 *   GNOSIS_SAFE=0x... npx hardhat run scripts/transfer-ownership.ts --network polygon
 */

import hre from 'hardhat'

async function main() {
  const safeAddress = process.env.GNOSIS_SAFE
  if (!safeAddress) throw new Error('Set GNOSIS_SAFE env var to your Gnosis Safe address')

  const didRegistryAddress    = process.env.DID_REGISTRY_ADDRESS
  const bountyRegistryAddress = process.env.BOUNTY_REGISTRY_ADDRESS
  const daoAddress            = process.env.POLYGON_DAO_ADDRESS

  if (!didRegistryAddress)    throw new Error('Set DID_REGISTRY_ADDRESS')
  if (!bountyRegistryAddress) throw new Error('Set BOUNTY_REGISTRY_ADDRESS')

  const [deployer] = await hre.ethers.getSigners()
  console.log(`Transferring ownership to Safe: ${safeAddress}`)
  console.log(`From deployer: ${deployer.address}`)

  const DIDRegistry    = await hre.ethers.getContractAt('DIDRegistry',    didRegistryAddress)
  const BountyRegistry = await hre.ethers.getContractAt('BountyRegistry', bountyRegistryAddress)

  let tx = await DIDRegistry.transferOwnership(safeAddress)
  await tx.wait()
  console.log(`DIDRegistry ownership → ${safeAddress} (tx: ${tx.hash})`)

  tx = await BountyRegistry.transferOwnership(safeAddress)
  await tx.wait()
  console.log(`BountyRegistry ownership → ${safeAddress} (tx: ${tx.hash})`)

  if (daoAddress) {
    const OpenRepDAO = await hre.ethers.getContractAt('OpenRepDAO', daoAddress)
    tx = await OpenRepDAO.transferOwnership(safeAddress)
    await tx.wait()
    console.log(`OpenRepDAO ownership → ${safeAddress} (tx: ${tx.hash})`)
  }

  console.log('\nOwnership transfer complete. Deployer key no longer controls contracts.')
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })
