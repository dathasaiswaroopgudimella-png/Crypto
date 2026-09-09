import { NextRequest, NextResponse } from "next/server";
import { globalGraphEngine } from "@/lib/graph-engine";
import { BlockchainNetwork } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { address, network, stolenAmount, isPresetCase } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
    }
    const result = await globalGraphEngine.traceFraudPath(
      address,
      network,
      stolenAmount || 0,
      5,
      isPresetCase || false
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[API/trace POST]", error);
    return NextResponse.json({ error: "Forensic trace failed. Check server logs." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const network = searchParams.get("network") as BlockchainNetwork | undefined;
    const isPresetCase = searchParams.get("isPresetCase") === "true";
    if (!address) {
      return NextResponse.json({ error: "Wallet address query parameter is required." }, { status: 400 });
    }
    const result = await globalGraphEngine.traceFraudPath(
      address,
      network,
      0,
      5,
      isPresetCase
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[API/trace GET]", error);
    return NextResponse.json({ error: "Forensic trace failed. Check server logs." }, { status: 500 });
  }
}
