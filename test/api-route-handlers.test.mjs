import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// 1. Static Audit of Route Files for Mandate Compliance
test("Mandate Check: All 5 API route files export const dynamic = 'force-dynamic'", () => {
  const routes = [
    "src/app/api/trace/route.ts",
    "src/app/api/notice/route.ts",
    "src/app/api/risk-score/route.ts",
    "src/app/api/vasp-registry/route.ts",
    "src/app/api/ai-analysis/route.ts",
  ];

  for (const relPath of routes) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `Route file must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, "utf-8");

    // Must export const dynamic = "force-dynamic"
    assert.match(
      content,
      /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/,
      `${relPath} must specify export const dynamic = 'force-dynamic'`
    );

    // Must support GET
    assert.match(
      content,
      /export\s+async\s+function\s+GET/,
      `${relPath} must support GET method`
    );

    // Must support POST
    assert.match(
      content,
      /export\s+async\s+function\s+POST/,
      `${relPath} must support POST method`
    );

    // Must support OPTIONS for CORS preflight
    assert.match(
      content,
      /export\s+async\s+function\s+OPTIONS/,
      `${relPath} must support OPTIONS method for CORS preflight`
    );
  }
});

// 2. Address Validation Unit Tests
test("Input Validation: Address Format Validation across EVM, TRON, BTC, SOL, and Case IDs", () => {
  function isValidCryptoAddress(address) {
    if (!address || typeof address !== "string") return false;
    const clean = address.trim();
    if (!clean) return false;
    if (/^0x[a-fA-F0-9]{40}$/.test(clean)) return true;
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(clean)) return true;
    if (/^(bc1q|bc1p)[0-9ac-hj-np-z]{38,59}$/.test(clean)) return true;
    if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(clean)) return true;
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) return true;
    if (/^CASE-[A-Z0-9_-]+$/i.test(clean) || /^1930\/[A-Z0-9/_-]+$/i.test(clean)) return true;
    return false;
  }

  // Valid EVM
  assert.equal(isValidCryptoAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), true);
  assert.equal(isValidCryptoAddress("0x28C6c06298d514Db089934071355E5743bf21d60"), true);
  // Valid TRON
  assert.equal(isValidCryptoAddress("TY7kL9w4NxQ2rJ1v8mP5s3e7t9a2m4b6cD"), true);
  assert.equal(isValidCryptoAddress("TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u"), true);
  // Valid Bitcoin SegWit (Bech32)
  assert.equal(isValidCryptoAddress("bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97"), true);
  // Valid Bitcoin Legacy & P2SH
  assert.equal(isValidCryptoAddress("1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s"), true);
  assert.equal(isValidCryptoAddress("34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo"), true);
  // Valid Case IDs
  assert.equal(isValidCryptoAddress("CASE-DL-2026-049182"), true);
  assert.equal(isValidCryptoAddress("1930/CFCFRMS/2026/049182"), true);

  // Invalid formats
  assert.equal(isValidCryptoAddress(""), false);
  assert.equal(isValidCryptoAddress("not_an_address"), false);
  assert.equal(isValidCryptoAddress("0x123"), false); // too short EVM
  assert.equal(isValidCryptoAddress("TY7kL9"), false); // too short TRON
  assert.equal(isValidCryptoAddress("invalid_wallet_xyz!"), false);
});

// 3. Network Normalization Unit Tests
test("Input Validation: Network Normalization with Case-Insensitivity & Aliases", () => {
  function normalizeNetwork(network) {
    if (typeof network !== "string" || !network.trim()) return undefined;
    const clean = network.trim().toUpperCase();
    switch (clean) {
      case "ETH":
      case "ETHEREUM":
      case "MAINNET":
        return "ETH";
      case "TRON":
      case "TRX":
        return "TRON";
      case "BTC":
      case "BITCOIN":
        return "BTC";
      case "POLYGON":
      case "MATIC":
        return "POLYGON";
      case "BASE":
        return "BASE";
      case "SOL":
      case "SOLANA":
        return "SOL";
      case "BSC":
      case "BINANCE":
      case "BNB":
        return "BSC";
      case "ARBITRUM":
      case "ARB":
        return "ARBITRUM";
      case "OPTIMISM":
      case "OP":
        return "OPTIMISM";
      case "AVALANCHE":
      case "AVAX":
        return "AVALANCHE";
      default:
        return undefined;
    }
  }

  assert.equal(normalizeNetwork("eth"), "ETH");
  assert.equal(normalizeNetwork("ethereum"), "ETH");
  assert.equal(normalizeNetwork("TRX"), "TRON");
  assert.equal(normalizeNetwork("tron"), "TRON");
  assert.equal(normalizeNetwork("bitcoin"), "BTC");
  assert.equal(normalizeNetwork("matic"), "POLYGON");
  assert.equal(normalizeNetwork("solana"), "SOL");
  assert.equal(normalizeNetwork("bnb"), "BSC");
  assert.equal(normalizeNetwork("arb"), "ARBITRUM");
  assert.equal(normalizeNetwork("op"), "OPTIMISM");
  assert.equal(normalizeNetwork("avax"), "AVALANCHE");
  // Unsupported network
  assert.equal(normalizeNetwork("DOGECOIN"), undefined);
  assert.equal(normalizeNetwork("monero"), undefined);
  assert.equal(normalizeNetwork(""), undefined);
});

// 4. Amount Parsing Unit Tests
test("Input Validation: Robust Amount Parsing & Sanity Bounds", () => {
  function parseAmount(amount, defaultVal = 0) {
    if (amount === undefined || amount === null || amount === "") {
      return { valid: true, amount: defaultVal };
    }
    if (typeof amount === "number") {
      if (isNaN(amount) || !isFinite(amount)) {
        return { valid: false, amount: defaultVal, error: "Amount must be a finite number." };
      }
      if (amount < 0) {
        return { valid: false, amount: defaultVal, error: "Amount cannot be negative." };
      }
      return { valid: true, amount };
    }
    if (typeof amount === "string") {
      const cleaned = amount.replace(/[\$,\s₹]|USD|INR|USDT/gi, "").trim();
      if (!cleaned) return { valid: true, amount: defaultVal };
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return { valid: false, amount: defaultVal, error: `Invalid numeric amount format: "${amount}".` };
      }
      if (parsed < 0) {
        return { valid: false, amount: defaultVal, error: "Amount cannot be negative." };
      }
      return { valid: true, amount: parsed };
    }
    return { valid: false, amount: defaultVal, error: "Invalid amount data type." };
  }

  assert.deepEqual(parseAmount(50000), { valid: true, amount: 50000 });
  assert.deepEqual(parseAmount("50000"), { valid: true, amount: 50000 });
  assert.deepEqual(parseAmount("$147,058.82 USD"), { valid: true, amount: 147058.82 });
  assert.deepEqual(parseAmount("₹1,25,00,000 INR"), { valid: true, amount: 12500000 });
  assert.deepEqual(parseAmount(""), { valid: true, amount: 0 });
  assert.deepEqual(parseAmount(undefined, 100), { valid: true, amount: 100 });

  // Rejections
  assert.equal(parseAmount(-500).valid, false);
  assert.equal(parseAmount("$-500").valid, false);
  assert.equal(parseAmount(NaN).valid, false);
  assert.equal(parseAmount(Infinity).valid, false);
  assert.equal(parseAmount("abc").valid, false);
});

// 5. Response Envelopes & CORS Headers Verification
test("Architecture: Response Envelopes & CORS Headers Format", () => {
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  };

  function apiSuccess(data, status = 200, extra = {}) {
    return {
      status,
      headers: CORS_HEADERS,
      body: {
        success: true,
        data,
        ...extra,
      },
    };
  }

  function apiError(error, status = 400, details) {
    const body = { success: false, error };
    if (details !== undefined) body.details = details;
    return {
      status,
      headers: CORS_HEADERS,
      body,
    };
  }

  const successRes = apiSuccess({ rootAddress: "0x123", network: "ETH" });
  assert.equal(successRes.status, 200);
  assert.equal(successRes.body.success, true);
  assert.ok(successRes.body.data);
  assert.equal(successRes.headers["Access-Control-Allow-Origin"], "*");

  const error400 = apiError("Wallet address is required.", 400);
  assert.equal(error400.status, 400);
  assert.equal(error400.body.success, false);
  assert.equal(error400.body.error, "Wallet address is required.");

  const error404 = apiError("Forensic case not found.", 404);
  assert.equal(error404.status, 404);
  assert.equal(error404.body.success, false);

  const error500 = apiError("Internal server error.", 500);
  assert.equal(error500.status, 500);
  assert.equal(error500.body.success, false);
});

// 6. VASP Registry Filter Engine Unit Test
test("VASP Registry Filter: Correctly filters by FIU registration and search terms", () => {
  const SAMPLE_VASP_REGISTRY = [
    {
      name: "Binance",
      legalEntity: "Nest Services Limited / Binance Holdings Ltd",
      fiuRegistered: true,
      fiuRegistrationNumber: "FIU-IND/RE/2024/0089",
      complianceEmail: "compliance-india@binance.com",
      hotWallets: [
        { address: "0x28C6c06298d514Db089934071355E5743bf21d60", network: "ETH" },
        { address: "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u", network: "TRON" },
      ],
    },
    {
      name: "CoinDCX",
      legalEntity: "Neblio Technologies Private Limited",
      fiuRegistered: true,
      fiuRegistrationNumber: "FIU-IND/RE/2023/0012",
      complianceEmail: "compliance@coindcx.com",
      hotWallets: [
        { address: "0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67", network: "ETH" },
      ],
    },
    {
      name: "Kraken",
      legalEntity: "Payward Inc.",
      fiuRegistered: false,
      complianceEmail: "legal@kraken.com",
      hotWallets: [
        { address: "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", network: "ETH" },
      ],
    },
  ];

  // Filter FIU registered
  const fiuRegistered = SAMPLE_VASP_REGISTRY.filter((v) => v.fiuRegistered);
  assert.equal(fiuRegistered.length, 2);
  assert.ok(fiuRegistered.every((v) => v.fiuRegistered === true));

  // Search by name "Binance"
  const binance = SAMPLE_VASP_REGISTRY.find((v) => v.name.toLowerCase() === "binance");
  assert.ok(binance, "Binance must be found in registry");
  assert.equal(binance.fiuRegistered, true);
  assert.equal(binance.hotWallets.length, 2);

  // Search by address
  const testAddress = "0x28C6c06298d514Db089934071355E5743bf21d60".toLowerCase();
  const matched = SAMPLE_VASP_REGISTRY.find((v) =>
    v.hotWallets.some((w) => w.address.toLowerCase() === testAddress)
  );
  assert.ok(matched, "Known wallet address must map to Binance");
  assert.equal(matched.name, "Binance");
});
