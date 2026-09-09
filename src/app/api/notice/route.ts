import { NextRequest, NextResponse } from "next/server";
import { BnssNoticeGenerator } from "@/lib/legal/bnss-notice";
import { GraphTraceResult } from "@/lib/types";
import { globalGraphEngine } from "@/lib/graph-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let trace: GraphTraceResult = body.trace;
    const officerInfo = body.officerInfo || {};
    const complaintInfo = body.complaintInfo || {};

    if (!trace) {
      const targetAddress = body.targetAddress || body.address;
      if (targetAddress) {
        trace = await globalGraphEngine.traceFraudPath(targetAddress, body.network);
      } else {
        return NextResponse.json({ error: "Trace data or targetAddress is required." }, { status: 400 });
      }
    }

    const notice = BnssNoticeGenerator.generateSection94Notice(trace, officerInfo, complaintInfo);
    return NextResponse.json({ success: true, notice });
  } catch (error: any) {
    console.error("[API/notice POST]", error);
    return NextResponse.json({ error: "Notice generation failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") || searchParams.get("targetAddress");
    if (!address) {
      return NextResponse.json({ error: "Wallet address parameter is required." }, { status: 400 });
    }
    const trace = await globalGraphEngine.traceFraudPath(address);
    const notice = BnssNoticeGenerator.generateSection94Notice(trace);
    return NextResponse.json({ success: true, notice });
  } catch (error: any) {
    console.error("[API/notice GET]", error);
    return NextResponse.json({ error: "Notice generation failed." }, { status: 500 });
  }
}
