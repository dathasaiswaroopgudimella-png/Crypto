import { NextRequest, NextResponse } from "next/server";
import { globalGraphEngine } from "@/lib/graph-engine";
import { BlockchainNetwork } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = body.address || "TY7kL9w4NxQ2rJ1v8mP5s3e7t9a2m4b6cD";
    const network: BlockchainNetwork = body.network || (address.startsWith("0x") ? "ETH" : "TRON");
    const amount = Number(body.amount) || 10000;
    const maxHops = Number(body.maxHops) || 5;

    const traceResult = await globalGraphEngine.traceFraudPath(
      address,
      network,
      amount,
      maxHops,
      true
    );

    return NextResponse.json(traceResult);
  } catch (error: any) {
    console.error("[API/trace] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trace transaction path" },
      { status: 500 }
    );
  }
}
