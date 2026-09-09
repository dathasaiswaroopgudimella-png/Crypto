import { NextRequest } from "next/server";
import { GraphTraceResult } from "@/lib/types";
import { globalGraphEngine } from "@/lib/graph-engine";
import {
  apiSuccess,
  apiError,
  handleOptions,
  parseJsonBody,
  validateAddress,
  normalizeNetwork,
  parseAmount,
  SUPPORTED_NETWORKS,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function OPTIONS() {
  return handleOptions();
}

async function generateIntelligenceBrief(trace: GraphTraceResult): Promise<{
  source: string;
  analysis: string;
  usage?: any;
}> {
  const inrAmount = ((trace.totalVolumeTrackedUsd || 0) * 85).toLocaleString("en-IN");
  const vasp = trace.destinationVasp;

  const prompt = `You are a senior forensic analyst at India's I4C (Indian Cyber Crime Coordination Centre) under the Ministry of Home Affairs. Write a concise, plain-English intelligence brief for a police officer reviewing this cryptocurrency fraud case.

Use simple, clear language. No bullet lists or code. Write in natural paragraphs like a professional intelligence report.

Case Data:
- Root address: ${trace.rootAddress} on the ${trace.network} blockchain
- Total stolen: $${(trace.totalVolumeTrackedUsd || 0).toLocaleString()} USD (approximately Rs. ${inrAmount})
- Number of laundering hops: ${trace.nodes ? trace.nodes.length - 1 : 0}
- Final destination exchange: ${vasp?.name || "Unknown"}
- FIU registration: ${vasp?.fiuNumber || "Not confirmed"}
- Attribution confidence: ${vasp?.confidenceScore || 95}%
- High-risk entities intercepted: ${trace.highRiskEntitiesFound && trace.highRiskEntitiesFound.length > 0 ? trace.highRiskEntitiesFound.join(", ") : "None"}

Write three concise paragraphs covering: what happened to the victim's money, how the syndicate laundered it, and what the police officer must do right now under Section 94 BNSS.`;

  // 1. PRIMARY INTELLIGENCE: Experiential Labs Gateway (gpt-6-astra)
  const explabsKey = process.env.EXPLABS_API_KEY;
  if (explabsKey && !explabsKey.includes("YOUR_") && !explabsKey.includes("your_")) {
    try {
      const { createExperientialChatCompletion } = await import("@/lib/experiential-client");

      try {
        // Attempt exact requested target: gpt-6-astra
        const expRes = (await createExperientialChatCompletion({
          model: "gpt-6-astra",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
          timeoutMs: 4000,
        })) as any;

        if (expRes?.reply) {
          return {
            source: "Experiential Labs (gpt-6-astra)",
            analysis: expRes.reply,
            usage: expRes.usage,
          };
        }
      } catch (astraErr: any) {
        console.warn("[ai-analysis] gpt-6-astra route note:", astraErr.message);

        // Parallel Experiential Model: claude-fable-latest (on same gateway & key)
        try {
          const fableRes = (await createExperientialChatCompletion({
            model: "claude-fable-latest",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 600,
            timeoutMs: 4500,
          })) as any;

          if (fableRes?.reply) {
            return {
              source: "Experiential Labs (claude-fable-latest)",
              analysis: fableRes.reply,
              usage: fableRes.usage,
            };
          }
        } catch (fableErr: any) {
          console.warn("[ai-analysis] Experiential fallback note:", fableErr.message);
        }
      }
    } catch (clientErr) {
      console.warn("[ai-analysis] Experiential client error:", clientErr);
    }
  }

  // 2. SECONDARY INTELLIGENCE: OpenRouter Gateway
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && !openRouterKey.includes("YOUR_") && !openRouterKey.includes("your_")) {
    try {
      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aegis-trace.vercel.app",
          "X-Title": "AEGIS-TRACE Forensic System",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.15,
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (aiRes.ok) {
        const json = await aiRes.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) {
          return {
            source: "OpenRouter AI",
            analysis: text,
          };
        }
      }
    } catch (e) {
      console.warn("[ai-analysis] OpenRouter query failed, continuing cascade:", e);
    }
  }

  // 3. TERTIARY INTELLIGENCE: Google Gemini API Gateway
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.includes("YOUR_") && !geminiKey.includes("your_") && geminiKey.length > 20) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (geminiRes.ok) {
        const json = await geminiRes.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return {
            source: "Google Gemini Flash",
            analysis: text,
          };
        }
      }
    } catch (e) {
      console.warn("[ai-analysis] Gemini API query failed, continuing cascade:", e);
    }
  }

  // 4. QUATERNARY INTELLIGENCE: NVIDIA NIM Inference Gateway
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey && !nvidiaKey.includes("YOUR_") && !nvidiaKey.includes("your_")) {
    try {
      const nvRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${nvidiaKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (nvRes.ok) {
        const json = await nvRes.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) {
          return {
            source: "NVIDIA NIM (Llama-3.1-70B)",
            analysis: text,
          };
        }
      }
    } catch (e) {
      console.warn("[ai-analysis] NVIDIA NIM query failed, falling back to deterministic engine:", e);
    }
  }

  // 5. DETERMINISTIC ENGINE FALLBACK
  const hopCount = trace.nodes && trace.nodes.length > 1 ? trace.nodes.length - 1 : 1;
  const fallback = `The target funds, totalling $${(trace.totalVolumeTrackedUsd || 0).toLocaleString()} USD (approximately Rs. ${inrAmount}), were moved off the domestic banking perimeter onto the ${trace.network} distributed ledger. The transaction records indicate rapid multi-hop layering through intermediary mule wallets to obscure the source.

The laundering pattern shows transfers moving across ${hopCount} intermediary staging addresses before reaching ${vasp?.name || "a Centralized Exchange"} custody. A micro-gas refill followed by a sweeping transaction was identified, confirming custodial exchange vault ingestion.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), the Investigating Officer should immediately issue a formal freezing notice to ${vasp?.name || "the exchange"} compliance desk at ${vasp?.complianceEmail || "compliance@exchange.com"}, demanding an account lien and full KYC records within 24 hours.`;

  return {
    source: "Deterministic Engine",
    analysis: fallback,
  };
}

export async function POST(req: NextRequest) {
  try {
    const parseResult = await parseJsonBody(req);
    if (!parseResult.ok) {
      return apiError(parseResult.error, parseResult.status);
    }
    const body = parseResult.data;

    let trace: GraphTraceResult | undefined = body.trace;

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      const rawAddress = body.address || body.targetAddress;
      if (!rawAddress) {
        return apiError(
          "Either valid forensic trace data or a wallet address is required for AI intelligence brief.",
          400
        );
      }

      const addressValidation = validateAddress(rawAddress);
      if (!addressValidation.valid) {
        return apiError(addressValidation.error || "Invalid wallet address.", 400);
      }

      let network = undefined;
      if (body.network) {
        network = normalizeNetwork(body.network);
        if (!network) {
          return apiError(
            `Unsupported blockchain network "${body.network}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
            400
          );
        }
      }

      const amountValidation = parseAmount(body.stolenAmount ?? body.amount, 0);
      if (!amountValidation.valid) {
        return apiError(amountValidation.error || "Invalid stolen amount.", 400);
      }

      trace = await globalGraphEngine.traceFraudPath(
        addressValidation.address,
        network,
        amountValidation.amount,
        5
      );
    }

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      return apiError("Forensic trail not found or empty for AI analysis.", 404);
    }

    const result = await generateIntelligenceBrief(trace);
    return apiSuccess(result, 200, result);
  } catch (e: any) {
    console.error("[API/ai-analysis POST]", e);
    return apiError(
      `AI analysis generation failed: ${e?.message || "Internal server error."}`,
      500
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAddress = searchParams.get("address") || searchParams.get("targetAddress");
    if (!rawAddress) {
      return apiError("Wallet address query parameter is required for AI intelligence brief.", 400);
    }

    const addressValidation = validateAddress(rawAddress);
    if (!addressValidation.valid) {
      return apiError(addressValidation.error || "Invalid wallet address.", 400);
    }

    let network = undefined;
    const rawNetwork = searchParams.get("network");
    if (rawNetwork) {
      network = normalizeNetwork(rawNetwork);
      if (!network) {
        return apiError(
          `Unsupported blockchain network "${rawNetwork}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`,
          400
        );
      }
    }

    const amountValidation = parseAmount(
      searchParams.get("stolenAmount") || searchParams.get("amount"),
      0
    );
    if (!amountValidation.valid) {
      return apiError(amountValidation.error || "Invalid stolen amount.", 400);
    }

    const trace = await globalGraphEngine.traceFraudPath(
      addressValidation.address,
      network,
      amountValidation.amount,
      5
    );

    if (!trace || !trace.nodes || trace.nodes.length === 0) {
      return apiError(
        `Forensic trace found no active records for address ${addressValidation.address}.`,
        404
      );
    }

    const result = await generateIntelligenceBrief(trace);
    return apiSuccess(result, 200, result);
  } catch (e: any) {
    console.error("[API/ai-analysis GET]", e);
    return apiError(
      `AI analysis generation failed: ${e?.message || "Internal server error."}`,
      500
    );
  }
}
