import { NextResponse } from "next/server";
import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json({
    success: true,
    vaspCount: KNOWN_VASP_REGISTRY.length,
    fiuRegistered: KNOWN_VASP_REGISTRY.filter(v => v.fiuRegistered).length,
    registry: KNOWN_VASP_REGISTRY,
    highRiskEntities: KNOWN_HIGH_RISK_ENTITIES,
  });
}
