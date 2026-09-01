import { NextRequest, NextResponse } from "next/server";
import { BnssNoticeGenerator } from "@/lib/legal/bnss-notice";
import { GraphTraceResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const trace: GraphTraceResult = body.trace;
    const officerInfo = body.officerInfo;
    const complaintInfo = body.complaintInfo;

    if (!trace) {
      return NextResponse.json({ error: "Missing trace graph data" }, { status: 400 });
    }

    const noticeData = BnssNoticeGenerator.generateSection94Notice(
      trace,
      officerInfo,
      complaintInfo
    );

    return NextResponse.json(noticeData);
  } catch (error: any) {
    console.error("[API/notice] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate Section 94 Notice" },
      { status: 500 }
    );
  }
}
