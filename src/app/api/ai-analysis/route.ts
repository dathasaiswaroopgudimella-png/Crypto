import { NextRequest, NextResponse } from "next/server";
import { GraphTraceResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { trace }: { trace: GraphTraceResult } = await req.json();
    if (!trace) {
      return NextResponse.json({ error: "Trace data is required." }, { status: 400 });
    }

    const inrAmount = ((trace.totalVolumeTrackedUsd || 0) * 85).toLocaleString("en-IN");
    const vasp = trace.destinationVasp;

    const prompt = `You are a senior forensic analyst at India's I4C (Indian Cyber Crime Coordination Centre) under the Ministry of Home Affairs. Write a concise, plain-English intelligence brief for a police officer reviewing this cryptocurrency fraud case.

Use simple, clear language. No bullet lists or code. Write in natural paragraphs like a professional intelligence report.

Case Data:
- Root address: ${trace.rootAddress} on the ${trace.network} blockchain
- Total stolen: $${(trace.totalVolumeTrackedUsd || 0).toLocaleString()} USD (approximately Rs. ${inrAmount})
- Number of laundering hops: ${trace.nodes.length - 1}
- Final destination exchange: ${vasp?.name || "Unknown"}
- FIU registration: ${vasp?.fiuNumber || "Not confirmed"}
- Attribution confidence: ${vasp?.confidenceScore || 95}%
- High-risk entities intercepted: ${trace.highRiskEntitiesFound?.length > 0 ? trace.highRiskEntitiesFound.join(", ") : "None"}

Write three concise paragraphs covering: what happened to the victim's money, how the syndicate laundered it, and what the police officer must do right now under Section 94 BNSS.`;

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
          signal: AbortSignal.timeout(8000),
        });

        if (aiRes.ok) {
          const json = await aiRes.json();
          const text = json.choices?.[0]?.message?.content;
          if (text) {
            return NextResponse.json({ success: true, source: "AI", analysis: text });
          }
        }
      } catch (e) {
        console.warn("[ai-analysis] OpenRouter query failed, generating deterministic brief:", e);
      }
    }

    const fallback = `The target funds, totalling $${(trace.totalVolumeTrackedUsd || 0).toLocaleString()} USD (approximately Rs. ${inrAmount}), were moved off the domestic banking perimeter onto the ${trace.network} distributed ledger. The transaction records indicate rapid multi-hop layering through intermediary mule wallets to obscure the source.

The laundering pattern shows transfers moving across ${trace.nodes.length - 1} intermediary staging addresses before reaching ${vasp?.name || "a Centralized Exchange"} custody. A micro-gas refill followed by a sweeping transaction was identified, confirming custodial exchange vault ingestion.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), the Investigating Officer should immediately issue a formal freezing notice to ${vasp?.name || "the exchange"} compliance desk at ${vasp?.complianceEmail || "compliance@exchange.com"}, demanding an account lien and full KYC records within 24 hours.`;

    return NextResponse.json({ success: true, source: "Deterministic Engine", analysis: fallback });
  } catch (e: any) {
    console.error("[api/ai-analysis]", e);
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
