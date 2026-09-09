import { NextRequest } from "next/server";
import { BnssNoticeGenerator } from "@/lib/legal/bnss-notice";
import { GraphTraceResult, Section94NoticeData } from "@/lib/types";
import { globalGraphEngine } from "@/lib/graph-engine";
import {
  apiSuccess,
  apiError,
  handleOptions,
  parseJsonBody,
  validateAddress,
  normalizeNetwork,
  parseAmount,
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

    let trace: GraphTraceResult | undefined = body.trace;
    const officerInfo: Partial<Section94NoticeData["investigatingOfficer"]> =
      typeof body.officerInfo === "object" && body.officerInfo !== null ? body.officerInfo : {};
    const complaintInfo: Partial<Section94NoticeData["complaintDetails"]> =
      typeof body.complaintInfo === "object" && body.complaintInfo !== null ? body.complaintInfo : {};

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      const rawTarget = body.targetAddress || body.address;
      if (!rawTarget) {
        return apiError(
          "Either valid forensic trace data or a targetAddress parameter is required to generate a Section 94 BNSS notice.",
          400
        );
      }

      const addressValidation = validateAddress(rawTarget);
      if (!addressValidation.valid) {
        return apiError(addressValidation.error || "Invalid target wallet address.", 400);
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

      trace = await globalGraphEngine.traceFraudPath(addressValidation.address, network);
    }

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      return apiError("No active forensic trail identified for notice generation.", 404);
    }

    const notice = BnssNoticeGenerator.generateSection94Notice(trace, officerInfo, complaintInfo);
    return apiSuccess(notice, 200, { notice });
  } catch (error: any) {
    console.error("[API/notice POST]", error);
    return apiError(
      `Notice generation failed: ${error?.message || "Internal server error."}`,
      500
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAddress = searchParams.get("address") || searchParams.get("targetAddress");
    if (!rawAddress) {
      return apiError("Wallet address parameter is required to generate notice.", 400);
    }

    const addressValidation = validateAddress(rawAddress);
    if (!addressValidation.valid) {
      return apiError(addressValidation.error || "Invalid wallet address.", 400);
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

    const officerInfo: Partial<Section94NoticeData["investigatingOfficer"]> = {};
    if (searchParams.get("officerName")) officerInfo.name = searchParams.get("officerName")!;
    if (searchParams.get("officerDesignation")) officerInfo.designation = searchParams.get("officerDesignation")!;
    if (searchParams.get("policeStation")) officerInfo.policeStation = searchParams.get("policeStation")!;
    if (searchParams.get("district")) officerInfo.district = searchParams.get("district")!;
    if (searchParams.get("state")) officerInfo.state = searchParams.get("state")!;
    if (searchParams.get("contactEmail")) officerInfo.contactEmail = searchParams.get("contactEmail")!;
    if (searchParams.get("contactPhone")) officerInfo.contactPhone = searchParams.get("contactPhone")!;

    const complaintInfo: Partial<Section94NoticeData["complaintDetails"]> = {};
    if (searchParams.get("ackNumber1930")) complaintInfo.ackNumber1930 = searchParams.get("ackNumber1930")!;
    if (searchParams.get("victimName")) complaintInfo.victimName = searchParams.get("victimName")!;
    if (searchParams.get("sourceBankOrAccount")) complaintInfo.sourceBankOrAccount = searchParams.get("sourceBankOrAccount")!;
    if (searchParams.get("crimeDate")) complaintInfo.crimeDate = searchParams.get("crimeDate")!;

    const rawInr = searchParams.get("stolenAmountInr");
    if (rawInr) {
      const inrParsed = parseAmount(rawInr);
      if (inrParsed.valid) complaintInfo.stolenAmountInr = inrParsed.amount;
    }

    const rawUsdt = searchParams.get("stolenAmountUsdt");
    if (rawUsdt) {
      const usdtParsed = parseAmount(rawUsdt);
      if (usdtParsed.valid) complaintInfo.stolenAmountUsdt = usdtParsed.amount;
    }

    const trace = await globalGraphEngine.traceFraudPath(addressValidation.address, network);
    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      return apiError(
        `Forensic trace found no active records for address ${addressValidation.address}.`,
        404
      );
    }

    const notice = BnssNoticeGenerator.generateSection94Notice(trace, officerInfo, complaintInfo);
    return apiSuccess(notice, 200, { notice });
  } catch (error: any) {
    console.error("[API/notice GET]", error);
    return apiError(
      `Notice generation failed: ${error?.message || "Internal server error."}`,
      500
    );
  }
}
