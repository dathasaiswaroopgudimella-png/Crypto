import { NextRequest, NextResponse } from "next/server";
import { globalGraphEngine } from "@/lib/graph-engine";
import { RiskScoringEngine } from "@/lib/risk-engine";
import { detectCryptoAsset } from "@/lib/rpc/multi-chain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { address, network } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
    }

    const detected = detectCryptoAsset(address);
    const trace = await globalGraphEngine.traceFraudPath(address, network || detected.network, 0, 3);
    
    return NextResponse.json({
      success: true,
      address,
      network: trace.network,
      riskScore: trace.overallRiskScore,
      detectedPatterns: trace.detectedPatterns,
      destinationVasp: trace.destinationVasp,
      highRiskEntitiesFound: trace.highRiskEntitiesFound,
    });
  } catch (error: any) {
    console.error("[API/risk-score]", error);
    return NextResponse.json({ error: "Risk calculation failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const network = searchParams.get("network");

    if (!address) {
      return NextResponse.json({ error: "Address parameter is required." }, { status: 400 });
    }

    const detected = detectCryptoAsset(address);
    const trace = await globalGraphEngine.traceFraudPath(address, (network as any) || detected.network, 0, 3);

    return NextResponse.json({
      success: true,
      address,
      network: trace.network,
      riskScore: trace.overallRiskScore,
      detectedPatterns: trace.detectedPatterns,
      destinationVasp: trace.destinationVasp,
      highRiskEntitiesFound: trace.highRiskEntitiesFound,
    });
  } catch (error: any) {
    console.error("[API/risk-score GET]", error);
    return NextResponse.json({ error: "Risk calculation failed." }, { status: 500 });
  }
}
