import { NextRequest } from "next/server";
import { globalGraphEngine } from "@/lib/graph-engine";
import { detectCryptoAsset } from "@/lib/rpc/multi-chain";
import {
  apiSuccess,
  apiError,
  handleOptions,
  parseJsonBody,
  validateAddress,
  normalizeNetwork,
  parseAmount,
  parseInteger,
  SUPPORTED_NETWORKS,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

    const rawAddress = body.address || body.targetAddress;
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

    const maxHops = parseInteger(body.maxHops ?? body.hops, 3, 1, 10);
    const detected = detectCryptoAsset(addressValidation.address);
    const resolvedNetwork = network || (detected.network !== "UNKNOWN" ? detected.network : undefined);

    const trace = await globalGraphEngine.traceFraudPath(
      addressValidation.address,
      resolvedNetwork,
      amountValidation.amount,
      maxHops
    );

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      return apiError(
        `Unable to compute risk score: no trace history found for address ${addressValidation.address}.`,
        404
      );
    }

    const data = {
      address: addressValidation.address,
      network: trace.network,
      riskScore: trace.overallRiskScore,
      detectedPatterns: trace.detectedPatterns,
      destinationVasp: trace.destinationVasp,
      highRiskEntitiesFound: trace.highRiskEntitiesFound,
      totalVolumeTrackedUsd: trace.totalVolumeTrackedUsd,
      sha256StateHash: trace.sha256StateHash,
    };

    return apiSuccess(data, 200, data);
  } catch (error: any) {
    console.error("[API/risk-score POST]", error);
    return apiError(
      `Risk calculation failed: ${error?.message || "Internal server error."}`,
      500
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAddress = searchParams.get("address") || searchParams.get("targetAddress");
    const addressValidation = validateAddress(rawAddress);
    if (!addressValidation.valid) {
      return apiError(addressValidation.error || "Wallet address parameter is required.", 400);
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
      3,
      1,
      10
    );

    const detected = detectCryptoAsset(addressValidation.address);
    const resolvedNetwork = network || (detected.network !== "UNKNOWN" ? detected.network : undefined);

    const trace = await globalGraphEngine.traceFraudPath(
      addressValidation.address,
      resolvedNetwork,
      amountValidation.amount,
      maxHops
    );

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      return apiError(
        `Unable to compute risk score: no trace history found for address ${addressValidation.address}.`,
        404
      );
    }

    const data = {
      address: addressValidation.address,
      network: trace.network,
      riskScore: trace.overallRiskScore,
      detectedPatterns: trace.detectedPatterns,
      destinationVasp: trace.destinationVasp,
      highRiskEntitiesFound: trace.highRiskEntitiesFound,
      totalVolumeTrackedUsd: trace.totalVolumeTrackedUsd,
      sha256StateHash: trace.sha256StateHash,
    };

    return apiSuccess(data, 200, data);
  } catch (error: any) {
    console.error("[API/risk-score GET]", error);
    return apiError(
      `Risk calculation failed: ${error?.message || "Internal server error."}`,
      500
    );
  }
}
