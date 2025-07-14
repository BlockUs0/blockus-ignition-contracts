import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ledger";
dotenv.config();

const config: HardhatUserConfig = {
  sourcify: {
    enabled: true
  },
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1 
      }
    }
  },
  defaultNetwork: "sepolia",
  networks: {
    hardhat: {
    },
    mainnet: {
      url: 'https://mainnet.infura.io/v3/8ef07dfe7367497f9b7d4a7ad2437ec8',
      accounts: [ process.env.DEPLOYER_PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY! ],
      chainId: 1,
      ledgerAccounts: [
        "0xBDE4d8669C7543acd972DA1Ad96478E7A5D857c2",
      ],
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [ process.env.DEPLOYER_PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY! ],
      chainId: 137,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL!,
      accounts: [ process.env.DEPLOYER_PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY! ],
      chainId: 11155111,
    },
    b3: {
      url: 'https://mainnet-rpc.b3.fun',
      accounts: [ process.env.DEPLOYER_PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY! ],
      chainId: 8333,
    },
    sonemium: {
      url: 'https://rpc.soneium.org/',
      accounts: [ process.env.DEPLOYER_PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY! ],
      chainId: 1868,
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [ process.env.DEPLOYER_PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY! ],
    },
    sei: {
      url: "https://evm-rpc.sei-apis.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY!],
      chainId: 1329,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY!,
      sepolia: process.env.ETHERSCAN_API_KEY!,
      polygon: process.env.POLYGON_ETHERSCAN!,
      bsc:process.env.ETHERSCAN_API_KEY!,
      b3:'as',
      sonemium:'as',
      sei: 'db766fd4-ea50-4f8c-8cc2-28ec882ea790',
    },
    customChains: [
      {
        network: "b3",
        chainId: 8333,
        urls: {
          apiURL: "https://explorer.b3.fun/api",
          browserURL: "https://explorer.b3.fun",
        },
      },
      {
        network: "sonemium",
        chainId: 1868,
        urls: {
          apiURL: "https://soneium.blockscout.com/api",
          browserURL: "https://soneium.blockscout.com/",
        },
      },
      {
        network: "sei",
        chainId: 1329,
        urls: {
          apiURL: "https://seitrace.com/pacific-1/ap",
          browserURL: "https://seitrace.com/pacific-1",
        },
      },
    ]

  }
};

export default config;
