import { NextRequest, NextResponse } from "next/server";
import { BnssNoticeGenerator } from "@/lib/legal/bnss-notice";
import { GraphTraceResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const trace: GraphTraceResult = body.trace;
    const officerInfo = body.officerInfo || {};
    const complaintInfo = body.complaintInfo || {};

    if (!trace) {
      return NextResponse.json({ error: "Trace data is required." }, { status: 400 });
    }

    const notice = BnssNoticeGenerator.generateSection94Notice(trace, officerInfo, complaintInfo);
    return NextResponse.json({ success: true, notice });
  } catch (error: any) {
    console.error("[API/notice]", error);
    return NextResponse.json({ error: "Notice generation failed." }, { status: 500 });
  }
}
