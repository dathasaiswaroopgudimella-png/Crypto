import { NextRequest } from "next/server";
import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES, KnownVaspRecord } from "@/lib/constants";
import {
  apiSuccess,
  apiError,
  handleOptions,
  parseJsonBody,
  validateAddress,
  normalizeNetwork,
  parseBoolean,
  SUPPORTED_NETWORKS,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleOptions();
}

interface VaspQueryParams {
  search?: string;
  type?: string;
  fiuOnly?: boolean;
  network?: string;
  name?: string;
  address?: string;
}

function processVaspQuery(params: VaspQueryParams) {
  const { search, type, fiuOnly, network: rawNetwork, name, address } = params;

  // 1. Specific lookup by VASP Name
  if (name && name.trim()) {
    const cleanName = name.trim().toLowerCase();
    const found = KNOWN_VASP_REGISTRY.find(
      (v) =>
        v.name.toLowerCase() === cleanName ||
        v.legalEntity.toLowerCase() === cleanName ||
        v.name.toLowerCase().includes(cleanName)
    );
    if (!found) {
      return {
        status: 404,
        error: `VASP entity "${name}" was not found in the registry.`,
      };
    }
    return {
      status: 200,
      data: {
        vasp: found,
        fiuRegistered: found.fiuRegistered,
        complianceEmail: found.complianceEmail,
        hotWallets: found.hotWallets,
      },
    };
  }

  // 2. Specific lookup by Wallet Address
  if (address && address.trim()) {
    const addressValidation = validateAddress(address);
    if (!addressValidation.valid) {
      return {
        status: 400,
        error: addressValidation.error || "Invalid cryptocurrency wallet address format.",
      };
    }

    const cleanAddr = addressValidation.address.toLowerCase();

    // Check VASP hot wallets
    for (const vasp of KNOWN_VASP_REGISTRY) {
      const matchedWallet = vasp.hotWallets.find(
        (w) => w.address.toLowerCase() === cleanAddr
      );
      if (matchedWallet) {
        return {
          status: 200,
          data: {
            entityType: "VASP",
            vasp,
            matchedWallet,
            isFiuRegistered: vasp.fiuRegistered,
            complianceEmail: vasp.complianceEmail,
          },
        };
      }
    }

    // Check High-Risk Sanctioned Entities
    const matchedHighRisk = KNOWN_HIGH_RISK_ENTITIES.find(
      (h) => h.address.toLowerCase() === cleanAddr
    );
    if (matchedHighRisk) {
      return {
        status: 200,
        data: {
          entityType: "HIGH_RISK_ENTITY",
          highRiskEntity: matchedHighRisk,
          isSanctioned: matchedHighRisk.ofacSanctioned,
        },
      };
    }

    return {
      status: 404,
      error: `Address "${addressValidation.address}" is not associated with any known VASP or high-risk entity in the registry.`,
    };
  }

  // 3. Network Filter Validation
  let filteredNetwork: string | undefined = undefined;
  if (rawNetwork) {
    const normalized = normalizeNetwork(rawNetwork);
    if (!normalized) {
      return {
        status: 400,
        error: `Unsupported blockchain network "${rawNetwork}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
      };
    }
    filteredNetwork = normalized;
  }

  // 4. General List Filtering
  let registry: KnownVaspRecord[] = [...KNOWN_VASP_REGISTRY];
  let highRisk = [...KNOWN_HIGH_RISK_ENTITIES];

  if (fiuOnly || type === "FIU") {
    registry = registry.filter((v) => v.fiuRegistered);
  } else if (type === "GLOBAL") {
    registry = registry.filter((v) => !v.fiuRegistered);
  }

  if (filteredNetwork) {
    registry = registry.filter((v) =>
      v.hotWallets.some((w) => w.network === filteredNetwork)
    );
    highRisk = highRisk.filter((h) => h.network === filteredNetwork);
  }

  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    registry = registry.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        v.legalEntity.toLowerCase().includes(s) ||
        v.complianceEmail.toLowerCase().includes(s) ||
        v.jurisdiction.toLowerCase().includes(s) ||
        v.hotWallets.some((w) => w.address.toLowerCase().includes(s))
    );
    highRisk = highRisk.filter(
      (h) =>
        h.name.toLowerCase().includes(s) ||
        h.address.toLowerCase().includes(s) ||
        h.description.toLowerCase().includes(s)
    );
  }

  return {
    status: 200,
    data: {
      vaspCount: registry.length,
      fiuRegistered: registry.filter((v) => v.fiuRegistered).length,
      registry,
      highRiskEntities: highRisk,
      totalVaspCount: KNOWN_VASP_REGISTRY.length,
      totalHighRiskCount: KNOWN_HIGH_RISK_ENTITIES.length,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || searchParams.get("q") || undefined;
    const type = searchParams.get("type") || undefined;
    const fiuOnly = parseBoolean(searchParams.get("fiuOnly"));
    const network = searchParams.get("network") || undefined;
    const name = searchParams.get("name") || undefined;
    const address = searchParams.get("address") || undefined;

    const result = processVaspQuery({
      search,
      type,
      fiuOnly,
      network,
      name,
      address,
    });

    if (result.status !== 200) {
      return apiError(result.error || "Query failed.", result.status);
    }

    return apiSuccess(result.data!, 200, result.data!);
  } catch (error: any) {
    console.error("[API/vasp-registry GET]", error);
    return apiError(
      `Registry lookup failed: ${error?.message || "Internal server error."}`,
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const parseResult = await parseJsonBody(req);
    if (!parseResult.ok) {
      return apiError(parseResult.error, parseResult.status);
    }
    const body = parseResult.data || {};

    const search = body.search || body.q;
    const type = body.type;
    const fiuOnly = parseBoolean(body.fiuOnly);
    const network = body.network;
    const name = body.name;
    const address = body.address;

    const result = processVaspQuery({
      search,
      type,
      fiuOnly,
      network,
      name,
      address,
    });

    if (result.status !== 200) {
      return apiError(result.error || "Query failed.", result.status);
    }

    return apiSuccess(result.data!, 200, result.data!);
  } catch (error: any) {
    console.error("[API/vasp-registry POST]", error);
    return apiError(
      `Registry lookup failed: ${error?.message || "Internal server error."}`,
      500
    );
  }
}
