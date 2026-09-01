# AEGIS-TRACE: Hackathon Pitch Script & Judge Defense Guide

## ⏱️ The 30-Second Winning Pitch (Memorize This)
> *"Respected judges, in 2025 alone, Indian citizens lost ₹22,495 Crore to cyber fraud. While the 1930 helpline effectively freezes domestic bank accounts, scammers immediately convert stolen INR into USDT crypto and cash out on centralized exchanges in just 18 minutes. State cyber cells take 21 days to manually subpoena exchanges. Our platform, AEGIS-TRACE, traces the entire multi-hop crypto trail across Ethereum and TRON in under 800 milliseconds and auto-generates a court-admissible Section 94 BNSS freezing order in one click, saving citizens' money before it escapes overseas."*

---

## 🎯 Top 5 Judge Questions & Technical Defense

### Q1: "How do you know an address belongs to Binance or CoinDCX without private exchange KYC data?"
**Defense**: *"Centralized exchanges follow a universal on-chain sweeping architecture. Personal deposit addresses have zero gas. The exchange parent hot wallet must first execute a micro-gas refill before automatically sweeping 100% of the deposit into its consolidated vault. By mathematically identifying this two-step sweep pattern and cross-referencing the destination vault with our verified database of FIU-registered VASP hot wallets, our engine achieves high attribution certainty without private KYC data."*

### Q2: "What if scammers use mixers like Tornado Cash or cross-chain bridges?"
**Defense**: *"Mixers and bridges are public smart contracts with published ABIs. When funds touch a mixer contract, our engine immediately flags the node as a High-Risk Obfuscation Entity, captures the ingress deposit timestamp, amount, and pool denomination, alerting officers that funds have entered an un-freezable contract and preventing wasted subpoena cycles."*

### Q3: "How do you handle rate limits on public blockchain RPCs?"
**Defense**: *"We employ an in-memory LRU cache to prevent duplicate queries on hub addresses, paired with an asynchronous round-robin connection pool across redundant RPC endpoints (Alchemy, Cloudflare, TronGrid) with automatic exponential backoff. Furthermore, we use targeted `eth_getLogs` topic filters rather than fetching full block bodies, reducing payload bandwidth by 95%."*

### Q4: "Is this evidence legally admissible in an Indian court under the new criminal laws?"
**Defense**: *"Yes. To fulfill Section 63 of Bharatiya Sakshya Adhiniyam (BSA 2023), the platform records raw JSON RPC responses, attaches UTC ledger timestamps and block hashes, and computes a SHA-256 state checksum of the graph. This hash is embedded into an auto-generated system certificate confirming that the data was extracted from an immutable distributed ledger without manual tampering."*

### Q5: "Won't scammers create thousands of micro-wallets (dust attacks) to crash your traversal engine?"
**Defense**: *"We implement a weighted volume-priority BFS algorithm that prioritizes exploration along the primary fund-carrying branch ($\ge 80\%$ of source balance) while aggregating micro-dust transfers ($< \$10$) into a single clustered node, capping traversal depth at 5 hops to guarantee sub-second execution."*
