import { NextRequest, NextResponse } from "next/server";
import { globalGraphEngine } from "@/lib/graph-engine";

export async function POST(req: NextRequest) {
  try {
    const { address, network, stolenAmount, isPresetCase } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
    }
    const result = await globalGraphEngine.traceFraudPath(
      address,
      network,
      stolenAmount || 100000,
      5,
      isPresetCase || false
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[API/trace]", error);
    return NextResponse.json({ error: "Forensic trace failed. Check server logs." }, { status: 500 });
  }
}
