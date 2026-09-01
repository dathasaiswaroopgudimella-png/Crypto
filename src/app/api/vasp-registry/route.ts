import { NextResponse } from "next/server";
import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json({
    vaspCount: KNOWN_VASP_REGISTRY.length,
    highRiskCount: KNOWN_HIGH_RISK_ENTITIES.length,
    fiuRegisteredVasps: KNOWN_VASP_REGISTRY,
    highRiskEntities: KNOWN_HIGH_RISK_ENTITIES,
  });
}
