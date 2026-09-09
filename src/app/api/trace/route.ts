import { NextRequest } from "next/server";
import { globalGraphEngine } from "@/lib/graph-engine";
import {
  apiSuccess,
  apiError,
  handleOptions,
  parseJsonBody,
  validateAddress,
  normalizeNetwork,
  parseAmount,
  parseInteger,
  parseBoolean,
  SUPPORTED_NETWORKS,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const parseResult = await parseJsonBody(req);
    if (!parseResult.ok) {
      return apiError(parseResult.error, parseResult.status);
    }
    const body = parseResult.data;

    const rawAddress = body.address || body.targetAddress || body.searchAddress;
    const addressValidation = validateAddress(rawAddress);
    if (!addressValidation.valid) {
      return apiError(addressValidation.error || "Wallet address is required.", 400);
    }

    let network = undefined;
    if (body.network) {
      network = normalizeNetwork(body.network);
      if (!network) {
        return apiError(
          `Unsupported blockchain network "${body.network}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
          400
        );
      }
    }

    const amountValidation = parseAmount(body.stolenAmount ?? body.amount, 0);
    if (!amountValidation.valid) {
      return apiError(amountValidation.error || "Invalid stolen amount provided.", 400);
    }

    const maxHops = parseInteger(body.maxHops ?? body.hops, 5, 1, 10);
    const isPresetCase = parseBoolean(body.isPresetCase);

    const result = await globalGraphEngine.traceFraudPath(
      addressValidation.address,
      network,
      amountValidation.amount,
      maxHops,
      isPresetCase
    );

    if (!result || !result.nodes || result.nodes.length === 0) {
      return apiError(
        `Forensic trace found no active nodes or transaction history for address ${addressValidation.address}.`,
        404
      );
    }

    return apiSuccess(result);
  } catch (error: any) {
    console.error("[API/trace POST]", error);
    return apiError(
      `Forensic trace computation encountered an unexpected error: ${error?.message || "Internal failure"}`,
      500
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAddress =
      searchParams.get("address") ||
      searchParams.get("targetAddress") ||
      searchParams.get("searchAddress");

    const addressValidation = validateAddress(rawAddress);
    if (!addressValidation.valid) {
      return apiError(addressValidation.error || "Wallet address query parameter is required.", 400);
    }

    let network = undefined;
    const rawNetwork = searchParams.get("network");
    if (rawNetwork) {
      network = normalizeNetwork(rawNetwork);
      if (!network) {
        return apiError(
          `Unsupported blockchain network "${rawNetwork}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
          400
        );
      }
    }

    const rawAmount = searchParams.get("stolenAmount") || searchParams.get("amount");
    const amountValidation = parseAmount(rawAmount, 0);
    if (!amountValidation.valid) {
      return apiError(amountValidation.error || "Invalid stolen amount parameter.", 400);
    }

    const maxHops = parseInteger(
      searchParams.get("maxHops") || searchParams.get("hops"),
      5,
      1,
      10
    );
    const isPresetCase = parseBoolean(searchParams.get("isPresetCase"));

    const result = await globalGraphEngine.traceFraudPath(
      addressValidation.address,
      network,
      amountValidation.amount,
      maxHops,
      isPresetCase
    );

    if (!result || !result.nodes || result.nodes.length === 0) {
      return apiError(
        `Forensic trace found no active nodes or transaction history for address ${addressValidation.address}.`,
        404
      );
    }

    return apiSuccess(result);
  } catch (error: any) {
    console.error("[API/trace GET]", error);
    return apiError(
      `Forensic trace computation encountered an unexpected error: ${error?.message || "Internal failure"}`,
      500
    );
  }
}
