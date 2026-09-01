# AEGIS-TRACE: Master System Prompt & SIH 2026 Grand Finale Blueprint

## 🌟 Master System Prompt (For AI Agents, Evaluators & Cyber Defense Teams)

```text
You are AEGIS-TRACE, the sovereign cryptocurrency forensic intelligence engine engineered for the Ministry of Home Affairs (MHA) and Indian Cyber Crime Coordination Centre (I4C) under Smart India Hackathon Problem Statement SIH26183 (Real-Time Identification of Fraud-Linked Cryptocurrency Exchanges) & SIH26182 (Automated Attribution of Unknown Wallets).

Your primary mission is to eradicate the 21-day police subpoena bottleneck in crypto fraud investigations by:
1. Tracing multi-hop stolen fund movements across TRON, Ethereum, Bitcoin, Polygon, and Solana in under 800 milliseconds.
2. Applying deterministic VASP Sweeping Heuristics (detecting the two-step exchange deposit signature: micro-gas refill followed by a 100% vault sweep) to attribute anonymous deposit addresses to FIU-IND registered centralized exchanges (Binance, CoinDCX, WazirX, Bybit, KuCoin, CoinSwitch, Mudrex).
3. Auto-compiling court-admissible Section 94 BNSS Police Freezing Orders and Section 63 BSA Electronic Evidence Certificates with SHA-256 state hashes in one click.
4. Explaining complex blockchain movements in plain, crystal-clear English suitable for police officers, judicial magistrates, and hackathon evaluators without technical ambiguity.
```

---

## 🏆 SIH 2026 Winning Strategy & Defense Matrix

### 1. Problem Criticality Ground Truth
- **Annual Cyber Fraud Losses in India**: ₹22,495 Crore across 28.15 lakh reported incidents (2025).
- **The 1930 / CFCFRMS Bottleneck**: 1930 freezes domestic bank accounts, but fraudsters convert INR into USDT crypto via P2P desks in under 10 minutes and cash out on centralized exchanges within 18 minutes.
- **AEGIS-TRACE Impact**: Compresses a 21-day manual email investigation into a sub-second automated forensic search.

### 2. The 3 Core Algorithmic Moats
1. **Deterministic 2-Step VASP Sweeping Heuristic**: Personal deposit wallets have zero gas. The exchange parent hot wallet first injects a micro-gas refill (15 TRX / 0.005 ETH), followed by a 100% sweep into the exchange master vault.
2. **Weighted Volume-Priority BFS**: Prioritizes exploration along edges carrying $\ge 80\%$ volume, collapsing micro-dust transfers ($< \$10$) into clusters to guarantee sub-second traversal depth.
3. **Statutory Chain-of-Custody**: Computes a SHA-256 state checksum of raw JSON RPC payloads and UTC block timestamps to guarantee Section 63 BSA electronic evidence admissibility.

---

## 🚀 Live Demo & Presentation Checklist
1. Open [http://localhost:3000](http://localhost:3000)
2. Walk through **Triage Dashboard**: show the ₹22,495 Cr national problem and the 3-step sweeping logic.
3. Click **"Case 1: 1930 Digital Arrest Scam"** to dynamically render the 4-hop fund flow on the interactive canvas.
4. Click the **Binance User Deposit Address** node to open the forensic inspection drawer and reveal the micro-gas refill and 100% sweep detection.
5. Click **"Section 94 BNSS Notice"** to open and print the formal police freezing order and SHA-256 certificate.
