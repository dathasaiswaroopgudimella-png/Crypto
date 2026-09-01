# AEGIS-TRACE: System Architecture & Heuristics Specification

## 1. Multi-Chain Ingestion Pipeline
```
Victim Report (1930 / CFCFRMS)
               │
               ▼
   [ Search & Ingress Ingestion ]
         │               │
  (EVM / 0x...)    (TRON / T...)
         │               │
         ▼               ▼
  [ Alchemy / RPC ]   [ TronGrid REST ]
         │               │
         └───────┬───────┘
                 ▼
     [ In-Memory LRU Cache ]
```

## 2. The 3 Core Topological Heuristics
1. **Deposit Sweeping Signature**: Exchange personal deposit addresses have zero gas. The exchange hot wallet first executes a micro-gas refill (e.g., 15 TRX / 0.005 ETH), followed by a 100% sweep into the exchange master vault.
2. **Weighted Volume-Priority BFS**: Prioritizes paths carrying $\ge 80\%$ of the initial balance to defeat peel chains, collapsing micro-splits ($< \$10$) into dust nodes.
3. **Statutory Cryptographic Chain-of-Custody**: Computes a SHA-256 state checksum of raw JSON RPC payloads and UTC block timestamps to guarantee Section 63 BSA legal admissibility.
