import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '0x' + '0'.repeat(64)
const POLYGON_RPC_URL      = process.env.POLYGON_RPC_URL      ?? 'https://polygon-rpc.com'
const AMOY_RPC_URL         = process.env.AMOY_RPC_URL         ?? 'https://rpc-amoy.polygon.technology'
const POLYGONSCAN_API_KEY  = process.env.POLYGONSCAN_API_KEY  ?? ''

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: './src',
    tests:   './test',
    cache:   './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    // Polygon Amoy testnet (Mumbai deprecated Jan 2024)
    amoy: {
      url: AMOY_RPC_URL,
      chainId: 80002,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 'auto',
    },
    // Polygon PoS mainnet
    polygon: {
      url: POLYGON_RPC_URL,
      chainId: 137,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 'auto',
    },
  },
  etherscan: {
    apiKey: {
      polygon:      POLYGONSCAN_API_KEY,
      polygonAmoy:  POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL:     'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
}

export default config
