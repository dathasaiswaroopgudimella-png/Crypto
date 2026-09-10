import { NextRequest, NextResponse } from "next/server";
import { BlockchainNetwork } from "./types";
import { AUTHENTIC_FORENSIC_CASES } from "./forensic-cases";

/**
 * Standard CORS headers for AEGIS-TRACE API routes.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

/**
 * Standard API error response envelope.
 */
export interface ApiErrorEnvelope {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * Returns a standardized JSON success response envelope:
 * { success: true, data: ..., ...extra }
 */
export function apiSuccess<T extends Record<string, any>>(
  data: T,
  status = 200,
  extra: Record<string, any> = {}
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...extra,
    },
    {
      status,
      headers: CORS_HEADERS,
    }
  );
}

/**
 * Returns a standardized JSON error response envelope:
 * { success: false, error: "..." }
 */
export function apiError(
  error: string,
  status = 400,
  details?: unknown
): NextResponse {
  const body: ApiErrorEnvelope = {
    success: false,
    error,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * Handle HTTP OPTIONS preflight request.
 */
export function handleOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Safely parses the JSON request body with robust error handling.
 */
export async function parseJsonBody<T = any>(
  req: NextRequest
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const text = await req.text();
    if (!text || text.trim().length === 0) {
      return { ok: true, data: {} as T };
    }
    const data = JSON.parse(text);
    if (typeof data !== "object" || data === null) {
      return {
        ok: false,
        error: "Request body must be a valid JSON object.",
        status: 400,
      };
    }
    return { ok: true, data };
  } catch (err: any) {
    return {
      ok: false,
      error: `Malformed JSON payload: ${err?.message || "Syntax error"}`,
      status: 400,
    };
  }
}

/**
 * Supported blockchain networks.
 */
export const SUPPORTED_NETWORKS: readonly BlockchainNetwork[] = [
  "ETH",
  "TRON",
  "BTC",
  "POLYGON",
  "BASE",
  "SOL",
  "BSC",
  "ARBITRUM",
  "OPTIMISM",
  "AVALANCHE",
] as const;

/**
 * Normalizes user-provided network strings to a valid BlockchainNetwork.
 */
export function normalizeNetwork(network: unknown): BlockchainNetwork | undefined {
  if (typeof network !== "string" || !network.trim()) {
    return undefined;
  }
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

/**
 * Validates whether a given string is a valid cryptocurrency address or authentic case ID.
 */
export function isValidCryptoAddress(address: string): boolean {
  const clean = address.trim();
  if (!clean) return false;

  // EVM (0x followed by 40 hex characters)
  if (/^0x[a-fA-F0-9]{40}$/.test(clean)) return true;

  // TRON (Base58 starting with T, length 34)
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(clean)) return true;

  // Bitcoin Bech32 SegWit (bc1q / bc1p)
  if (/^(bc1q|bc1p)[0-9ac-hj-np-z]{38,59}$/.test(clean)) return true;

  // Bitcoin Legacy (1) and P2SH (3)
  if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(clean)) return true;

  // Solana (Base58, 32 to 44 characters, excluding 0, O, I, l)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) return true;

  // Authentic Forensic Case ID, Complaint Number, or Case Node Address match
  if (
    AUTHENTIC_FORENSIC_CASES.some(
      (c) =>
        c.caseId.toLowerCase() === clean.toLowerCase() ||
        c.complaintNumber.toLowerCase() === clean.toLowerCase() ||
        c.initialSuspectAddress.toLowerCase() === clean.toLowerCase() ||
        c.graphData.rootAddress.toLowerCase() === clean.toLowerCase() ||
        c.graphData.destinationVasp?.vaultAddress.toLowerCase() === clean.toLowerCase() ||
        c.graphData.destinationVasp?.depositAddress.toLowerCase() === clean.toLowerCase() ||
        c.graphData.nodes.some(
          (n) => n.id.toLowerCase() === clean.toLowerCase() || n.fullAddress.toLowerCase() === clean.toLowerCase()
        )
    )
  ) {
    return true;
  }

  // Generic Case / Complaint pattern prefix
  if (
    /^CASE-[A-Z0-9_-]+$/i.test(clean) ||
    /^1930\/[A-Z0-9/_-]+$/i.test(clean) ||
    /^SIH[A-Z0-9_-]+$/i.test(clean)
  ) {
    return true;
  }

  return false;
}

/**
 * Validates and sanitizes a wallet address or case identifier.
 */
export function validateAddress(address: unknown): {
  valid: boolean;
  address: string;
  error?: string;
} {
  if (typeof address !== "string" || !address.trim()) {
    return {
      valid: false,
      address: "",
      error: "Wallet address is required and must be a non-empty string.",
    };
  }
  const clean = address.trim();
  if (!isValidCryptoAddress(clean)) {
    return {
      valid: false,
      address: clean,
      error:
        "Invalid cryptocurrency wallet address format. Must be a valid EVM (0x...), TRON (T...), Bitcoin (1/3/bc1...), Solana, or recognized Forensic Case identifier.",
    };
  }
  return { valid: true, address: clean };
}

/**
 * Robustly parses amounts (strings, numbers, currency symbols) with sanity bounds.
 */
export function parseAmount(
  amount: unknown,
  defaultVal: number = 0
): { valid: boolean; amount: number; error?: string } {
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
    if (!cleaned) {
      return { valid: true, amount: defaultVal };
    }
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

/**
 * Parses integer parameters with clamping.
 */
export function parseInteger(
  val: unknown,
  defaultVal: number,
  min = 1,
  max = 10
): number {
  if (val === undefined || val === null || val === "") return defaultVal;
  const num = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(num) || !isFinite(num)) return defaultVal;
  return Math.max(min, Math.min(max, Math.round(num)));
}

/**
 * Parses boolean parameters safely from query strings or JSON.
 */
export function parseBoolean(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  if (typeof val === "number") {
    return val === 1;
  }
  return false;
}
