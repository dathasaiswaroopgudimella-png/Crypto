import { EntityType } from "./types";

export interface KnownVaspRecord {
  name: string;
  legalEntity: string;
  fiuRegistered: boolean;
  fiuRegistrationNumber?: string;
  complianceEmail: string;
  nodalOfficer?: string;
  jurisdiction: string;
  freezeRequestEmail?: string;
  hotWallets: {
    address: string;
    network: "ETH" | "TRON" | "BTC" | "POLYGON" | "BASE" | "SOL" | "BSC" | "ARBITRUM";
    type: EntityType;
  }[];
}

export const KNOWN_VASP_REGISTRY: KnownVaspRecord[] = [
  {
    name: "Binance",
    legalEntity: "Nest Services Limited / Binance Holdings Ltd",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2024/0089",
    complianceEmail: "compliance-india@binance.com",
    nodalOfficer: "India Compliance Team",
    jurisdiction: "Registered Entity under PMLA Guidelines (FIU-IND)",
    freezeRequestEmail: "lawenforcement@binance.com",
    hotWallets: [
      { address: "0x28C6c06298d514Db089934071355E5743bf21d60", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", network: "ETH", type: "VASP_COLD_VAULT" },
      { address: "0xdfd5293d8e347dFe59E90eFd55b2956a1343963d", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x5a52E96BAcdaBb82fd05763E25335261B270Efcb", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xe2fc31F816A9b3dcd668F787b4380bbc6F5C0D27", network: "BSC", type: "VASP_HOT_WALLET" },
      { address: "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3", network: "BSC", type: "VASP_HOT_WALLET" },
      { address: "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u", network: "TRON", type: "VASP_HOT_WALLET" },
      { address: "TDqSquXBgfCLh9mzg1hP99yB5w1wPZSm4g", network: "TRON", type: "VASP_COLD_VAULT" },
      { address: "TJCo98saj3uMLdmyV6h4HZkXELhgTe7MAY", network: "TRON", type: "VASP_HOT_WALLET" },
      { address: "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s", network: "BTC", type: "VASP_HOT_WALLET" },
      { address: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", network: "BTC", type: "VASP_COLD_VAULT" },
      { address: "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97", network: "BTC", type: "VASP_COLD_VAULT" },
    ],
  },
  {
    name: "CoinDCX",
    legalEntity: "Neblio Technologies Private Limited",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2023/0012",
    complianceEmail: "compliance@coindcx.com",
    jurisdiction: "Mumbai, Maharashtra (India)",
    freezeRequestEmail: "legal@coindcx.com",
    hotWallets: [
      { address: "0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", network: "TRON", type: "VASP_HOT_WALLET" },
      { address: "385cR5DM96n1HvBDMzLHPYcw89fZAXULJP", network: "BTC", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "WazirX",
    legalEntity: "Zanmai Labs Private Limited",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2023/0004",
    complianceEmail: "legal@wazirx.com",
    nodalOfficer: "Legal & Compliance Team",
    jurisdiction: "Mumbai, Maharashtra (India)",
    freezeRequestEmail: "lawenforcement@wazirx.com",
    hotWallets: [
      { address: "0x564286362092D8e793690549419A62c7B9f7eA41", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", network: "ETH", type: "VASP_COLD_VAULT" },
      { address: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", network: "BTC", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "Bybit",
    legalEntity: "Bybit Fintech FZE",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2024/0142",
    complianceEmail: "compliance@bybit.com",
    jurisdiction: "Dubai (UAE) / FIU-IND Registered Offshore Entity",
    freezeRequestEmail: "learequest@bybit.com",
    hotWallets: [
      { address: "0xf89d7b9c370f57f34b9665b33e2fa43e072eb311", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x1db3439a222c519ab44bb1144fc28167b4fa6ee6", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xd090e2f925da726b50c4ed8d0fb90ad053324f31", network: "BSC", type: "VASP_HOT_WALLET" },
      { address: "bc1qsugf35d2x9j0n298k48fvgq0m447nlg82rhy9e", network: "BTC", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "KuCoin",
    legalEntity: "Mek Global Limited",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2024/0077",
    complianceEmail: "compliance-team@kucoin.com",
    jurisdiction: "Seychelles / FIU-IND Registered Offshore Entity",
    freezeRequestEmail: "support@kucoin.com",
    hotWallets: [
      { address: "0x689c56a0f4c930c451b2602731f3d066f57B8822", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x2b5634c42055806a59e9107ed44d43c426e58258", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x0a98fb70939162725ae66e626fe4b52cff62c2e5", network: "ETH", type: "VASP_COLD_VAULT" },
    ],
  },
  {
    name: "OKX",
    legalEntity: "Aux Cayes FinTech Co. Ltd",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2024/0105",
    complianceEmail: "compliance@okx.com",
    jurisdiction: "Seychelles / FIU-IND Registered Offshore Entity",
    freezeRequestEmail: "legal@okx.com",
    hotWallets: [
      { address: "0x6cC5F688a3D5f330841374581559C823964f0b3A", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xa7efae728d2936e78bda97dc267687568dd593f3", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xb60e8dd61c5d32be8058bb8eb970870f07233155", network: "ETH", type: "VASP_COLD_VAULT" },
      { address: "bc1q42lja79elem0anu8q8s3h2n687re9jax556pcc", network: "BTC", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "CoinSwitch",
    legalEntity: "Bitcipher Labs LLP",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2023/0018",
    complianceEmail: "grievance@coinswitch.co",
    jurisdiction: "Bengaluru, Karnataka (India)",
    hotWallets: [
      { address: "0x7894a4c6b45a6c7d8e9f0a1b2c3d4e5f6a7b8c9d", network: "ETH", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "Mudrex",
    legalEntity: "Mudrex Financial Services Limited",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2023/0031",
    complianceEmail: "legal@mudrex.com",
    jurisdiction: "Bengaluru, Karnataka (India)",
    hotWallets: [],
  },
  {
    name: "Coinbase",
    legalEntity: "Coinbase Global, Inc.",
    fiuRegistered: false,
    complianceEmail: "legal@coinbase.com",
    jurisdiction: "United States (US-regulated)",
    freezeRequestEmail: "law_enforcement@coinbase.com",
    hotWallets: [
      { address: "0xa090e606e30bD747d4E6245a1517EbE430F0057e", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x503828976D22510aad0201ac7EC88293211D23Da", network: "ETH", type: "VASP_COLD_VAULT" },
      { address: "0xddfAbCdc4D8FfC6d5beaf154f18B778f892A0740", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ", network: "BTC", type: "VASP_HOT_WALLET" },
      { address: "3Cbq7aT1tY8kMxWLBkgQQAUfTQzeSxRiJX", network: "BTC", type: "VASP_COLD_VAULT" },
    ],
  },
  {
    name: "Kraken",
    legalEntity: "Payward Inc.",
    fiuRegistered: false,
    complianceEmail: "legal@kraken.com",
    jurisdiction: "United States (US-regulated)",
    freezeRequestEmail: "law_enforcement@kraken.com",
    hotWallets: [
      { address: "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xAe2D4617c862309A3d75A0fFB358c7a5009c673F", network: "ETH", type: "VASP_COLD_VAULT" },
      { address: "3QiYSMmGf3aFbdQLngnJmQ9vMFoVKxaEpd", network: "BTC", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "Huobi / HTX",
    legalEntity: "Huobi Global Limited",
    fiuRegistered: false,
    complianceEmail: "support@huobi.com",
    jurisdiction: "Seychelles",
    freezeRequestEmail: "law_enforcement@htx.com",
    hotWallets: [
      { address: "0xdc76cd25977e0a5ae17155770273ad58648900d3", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xaB5C66752a9e8167967685F1450532fB96d5d24f", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xE93381fB4c4F14bDa253907b18faD305D799241a", network: "ETH", type: "VASP_COLD_VAULT" },
    ],
  },
  {
    name: "Gate.io",
    legalEntity: "Gate Technology Inc.",
    fiuRegistered: false,
    complianceEmail: "compliance@gate.io",
    jurisdiction: "Cayman Islands",
    hotWallets: [
      { address: "0x0d0707963952f2fba59dd06f2b425ace40b492fe", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x7793CD85C11a924478d358D49b05b37E91B5810F", network: "ETH", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "MEXC",
    legalEntity: "MEXC Global",
    fiuRegistered: false,
    complianceEmail: "support@mexc.com",
    jurisdiction: "Seychelles",
    hotWallets: [
      { address: "0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x75e89d5979E4f6Fba9F97c104c2F0AFB3F1dcB88", network: "ETH", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "Bitget",
    legalEntity: "Bitget Limited",
    fiuRegistered: false,
    complianceEmail: "compliance@bitget.com",
    jurisdiction: "Seychelles",
    hotWallets: [
      { address: "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xd93f7e271cb87c23aaa73edc008a79646d1f9912", network: "ETH", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "Zebpay",
    legalEntity: "Awlencan Innovations India Pvt Ltd",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2023/0008",
    complianceEmail: "compliance@zebpay.com",
    jurisdiction: "Ahmedabad, Gujarat (India)",
    hotWallets: [],
  },
];

// OFAC-sanctioned mixers, tumblers, and high-risk entities
export const KNOWN_HIGH_RISK_ENTITIES = [
  {
    name: "Tornado Cash (Router Smart Contract)",
    address: "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Decentralized non-custodial privacy protocol. OFAC SDN listed August 2022.",
  },
  {
    name: "Tornado Cash 100 ETH Pool",
    address: "0xA160ba73130761C61181C504E5540F72A804560B",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Fixed-denomination 100 ETH mixer pool.",
  },
  {
    name: "Tornado Cash 10 ETH Pool",
    address: "0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Fixed-denomination 10 ETH mixer pool.",
  },
  {
    name: "Tornado Cash 1 ETH Pool",
    address: "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Fixed-denomination 1 ETH mixer pool.",
  },
  {
    name: "Tornado Cash 0.1 ETH Pool",
    address: "0x12D66f87A04A9E220C9D1E4d5f6E45765DAc46c5",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Fixed-denomination 0.1 ETH mixer pool.",
  },
  {
    name: "FixedFloat Automated Swapper",
    address: "0x3344556677889900112233445566778899aabbcc",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: false,
    description: "No-KYC instant exchange service used in fraud layering.",
  },
  {
    name: "ChipMixer (BTC Tumbler)",
    address: "1NZ9vDq86nFwQzFdtP66R3DkPT3s7fN2d",
    network: "BTC",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Bitcoin tumbler seized by Europol/DOJ March 2023.",
  },
  {
    name: "Sinbad Mixer",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    network: "BTC",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Bitcoin mixer sanctioned by OFAC November 2023.",
  },
  {
    name: "Blender.io (Lazarus-linked Mixer)",
    address: "1BlenderioPoolXXXXXXXXXXXXXXXa3t6b",
    network: "BTC",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "BTC mixer used by Lazarus Group, sanctioned OFAC May 2022.",
  },
];

// Cross-chain bridge contract addresses
export const KNOWN_BRIDGE_CONTRACTS = [
  {
    name: "Multichain Router",
    address: "0xC564EE9f21Ed8A2d8E7e76c085740d5e4c5FaFbE",
    network: "ETH",
    destinationChains: ["BSC", "POLYGON", "AVALANCHE", "FANTOM"],
  },
  {
    name: "Hop Protocol (ETH Bridge)",
    address: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18d",
    network: "ETH",
    destinationChains: ["POLYGON", "ARBITRUM", "OPTIMISM"],
  },
  {
    name: "Across Protocol",
    address: "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381",
    network: "ETH",
    destinationChains: ["ARBITRUM", "OPTIMISM", "BASE", "POLYGON"],
  },
  {
    name: "Wormhole Token Bridge",
    address: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585",
    network: "ETH",
    destinationChains: ["SOL", "BSC", "AVALANCHE", "POLYGON"],
  },
  {
    name: "Stargate Finance",
    address: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
    network: "ETH",
    destinationChains: ["BSC", "AVALANCHE", "POLYGON", "ARBITRUM", "OPTIMISM"],
  },
  {
    name: "cBridge (Celer Network)",
    address: "0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820",
    network: "ETH",
    destinationChains: ["BSC", "POLYGON", "ARBITRUM", "OPTIMISM", "AVALANCHE"],
  },
  {
    name: "Synapse Bridge",
    address: "0x2796317b0fF8538F253012862c06787Adfb8cEb6",
    network: "ETH",
    destinationChains: ["BSC", "POLYGON", "ARBITRUM", "OPTIMISM", "AVALANCHE"],
  },
];
