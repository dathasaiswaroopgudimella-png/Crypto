# AEGIS-TRACE (SIH 2026 — Problem Statements SIH26183 & SIH26182)

**Automated Evidence & Graph Intelligence System for Real-Time Crypto-Fraud Mitigation**

- **Target Problem Statements**:
  - `SIH26183`: Real-Time Identification of Fraud-Linked Cryptocurrency Exchanges
  - `SIH26182`: Automated Attribution of Unknown Wallets
- **Sponsoring Body**: Ministry of Home Affairs (MHA) / Indian Cyber Crime Coordination Centre (I4C)
- **Category**: Software • Blockchain & Cybersecurity

---

## 🚀 The National Crisis & Why AEGIS-TRACE Wins
In 2025 alone, Indian citizens lost **₹22,495 Crore** to cyber fraud across 28.15 lakh incidents. While the 1930 Helpline places immediate liens on domestic mule bank accounts, fraudsters rapidly bridge stolen funds into USDT crypto via P2P desks, peel them across multi-hop chains, and cash out on centralized exchanges within **18 minutes**.

Police currently take **7 to 21 days** to manually subpoena exchanges. **AEGIS-TRACE compresses this entire investigation into under 800 milliseconds** by deterministically tracing multi-hop fund movements across Ethereum and TRON, detecting VASP deposit sweeps, and generating court-admissible **Section 94 BNSS Freezing Orders** in 1 click.

---

## ⚡ Core Algorithmic Moats
1. **Deterministic VASP Sweeping Heuristic**: Identifies the universal 2-step centralized exchange deposit pattern:
   - Temporary deposit wallet receives a micro-gas refill ($ETH$ / $TRX$) from the exchange parent hot wallet.
   - 100% of the token balance is swept into the exchange consolidation vault.
2. **Weighted Volume-Priority BFS**: Prioritizes fund traversal on edges carrying $\ge 80\%$ volume while pruning/clustering micro-dust splits ($< \$10$), guaranteeing sub-second execution across 5 hops.
3. **Court-Admissible Legal Generator**: Fulfills Section 94 of Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) and Section 63 of Bharatiya Sakshya Adhiniyam (BSA 2023) by generating formal statutory freeze notices with UTC timestamps and SHA-256 state hashes.
4. **Zero-Cost Sovereign Data Architecture**: Runs on 100% free-tier public blockchain RPCs (Alchemy, TronGrid, public nodes) with offline high-fidelity synthetic demo replay fail-safes.

---

## 🛠️ Quick Start & Installation

```bash
# 1. Navigate to project directory
cd aegis-trace

# 2. Install dependencies
npm install

# 3. Run unit test suite
npm test

# 4. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure
```
src/
├── app/
│   ├── layout.tsx         # Dark theme & forensics typography
│   ├── page.tsx           # Main interactive canvas dashboard
│   └── api/
│       ├── trace/         # Graph traversal & VASP heuristic API
│       ├── notice/        # Section 94 BNSS notice generator API
│       └── vasp-registry/ # FIU-IND registered exchange directory
├── components/
│   ├── Canvas/            # React Flow dynamic interactive graph
│   ├── Header/            # Ingress search bar & preset case switcher
│   ├── Legal/             # Section 94 BNSS / Section 63 BSA modal
│   └── Analytics/         # Metric panels & chronological audit timeline
└── lib/
    ├── graph-engine.ts    # In-memory BFS traversal & peel-chain pruning
    ├── heuristics.ts      # VASP 2-step deposit sweeping detector
    ├── constants.ts       # Pre-indexed FIU-IND VASP database
    ├── mock-data.ts       # 3 real-world scam replay datasets
    └── legal/             # BNSS & BSA statutory notice generators
```
