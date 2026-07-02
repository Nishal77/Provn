import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

// Load env from root .env when running scripts locally
// In CI these are passed as environment variables directly
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '0x' + '0'.repeat(64)
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com'
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL ?? 'https://rpc-mumbai.maticvigil.com'
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY ?? ''

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
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
    mumbai: {
      url: MUMBAI_RPC_URL,
      chainId: 80001,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    polygon: {
      url: POLYGON_RPC_URL,
      chainId: 137,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 'auto',
    },
  },
  etherscan: {
    apiKey: {
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
    },
  },
}

export default config
