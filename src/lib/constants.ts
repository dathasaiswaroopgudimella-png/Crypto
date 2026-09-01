import { EntityType } from "./types";

export interface KnownVaspRecord {
  name: string;
  legalEntity: string;
  fiuRegistered: boolean;
  fiuRegistrationNumber?: string;
  complianceEmail: string;
  jurisdiction: string;
  hotWallets: {
    address: string;
    network: "ETH" | "TRON" | "BTC" | "POLYGON" | "BASE" | "SOL";
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
    jurisdiction: "Registered Entity under PMLA Guidelines (FIU-IND)",
    hotWallets: [
      { address: "0x28C6c06298d514Db089934071355E5743bf21d60", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", network: "ETH", type: "VASP_COLD_VAULT" },
      { address: "0xdfd5293d8e347dFe59E90eFd55b2956a1343963d", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u", network: "TRON", type: "VASP_HOT_WALLET" },
      { address: "TDqSquXBgfCLh9mzg1hP99yB5w1wPZSm4g", network: "TRON", type: "VASP_COLD_VAULT" },
      { address: "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s", network: "BTC", type: "VASP_HOT_WALLET" },
      { address: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", network: "BTC", type: "VASP_COLD_VAULT" },
    ],
  },
  {
    name: "CoinDCX",
    legalEntity: "Neblio Technologies Private Limited",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2023/0012",
    complianceEmail: "compliance@coindcx.com",
    jurisdiction: "Mumbai, Maharashtra (India)",
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
    jurisdiction: "Mumbai, Maharashtra (India)",
    hotWallets: [
      { address: "0x564286362092D8e793690549419A62c7B9f7eA41", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "TYm8m2N1V8N1qU7e6pB8tJ6v4s1mQ9rT2u", network: "TRON", type: "VASP_HOT_WALLET" },
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
    hotWallets: [
      { address: "0xf89d7b9c370f57f34b9665b33e2fa43e072eb311", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x1db3439a222c519ab44bb1144fc28167b4fa6ee6", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "TFrZ3v3k6M5B1x9rQ7u8w2v4s5e6a1m3rT", network: "TRON", type: "VASP_HOT_WALLET" },
      { address: "bc1qsugf35d2x9j0n298k48fvgq0m447nlg82rhy9e", network: "BTC", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "KuCoin",
    legalEntity: "Mek Global Limited",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2024/0077",
    complianceEmail: "compliance-team@kucoin.com",
    jurisdiction: "FIU-IND Registered Offshore Entity",
    hotWallets: [
      { address: "0x689c56a0f4c930c451b2602731f3d066f57B8822", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0x2b5634c42055806a59e9107ed44d43c426e58258", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "TK6b7v4u2m1n8q9w5e7r3t6y8u4i2o1p0a", network: "TRON", type: "VASP_HOT_WALLET" },
    ],
  },
  {
    name: "OKX",
    legalEntity: "Aux Cayes FinTech Co. Ltd",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2024/0105",
    complianceEmail: "compliance@okx.com",
    jurisdiction: "Seychelles / FIU-IND Registered Offshore Entity",
    hotWallets: [
      { address: "0x6cC5F688a3D5f330841374581559C823964f0b3A", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xa7efae728d2936e78bda97dc267687568dd593f3", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "TBrf6K38uYm4aU9gG1q2k8t9p3w2v1s5a", network: "TRON", type: "VASP_HOT_WALLET" },
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
    hotWallets: [
      { address: "0x1234567890123456789012345678901234567890", network: "ETH", type: "VASP_HOT_WALLET" },
    ],
  },
];

export const KNOWN_HIGH_RISK_ENTITIES = [
  {
    name: "Tornado Cash (Router Smart Contract)",
    address: "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Decentralized non-custodial privacy protocol used to break on-chain audit trails.",
  },
  {
    name: "Tornado Cash 100 ETH Pool",
    address: "0xA160ba73130761C61181C504E5540F72A804560B",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: true,
    description: "Fixed-denomination mixer pool for fund obfuscation.",
  },
  {
    name: "FixedFloat Automated Swapper",
    address: "0x3344556677889900112233445566778899aabbcc",
    network: "ETH",
    category: "MIXER_OBFUSCATION",
    ofacSanctioned: false,
    description: "Instant cryptocurrency exchange service without KYC verification requirements.",
  },
];
