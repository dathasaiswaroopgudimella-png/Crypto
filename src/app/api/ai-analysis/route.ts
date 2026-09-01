import { NextRequest, NextResponse } from "next/server";
import { GraphTraceResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { trace }: { trace: GraphTraceResult } = await req.json();
    if (!trace) {
      return NextResponse.json({ error: "Trace data is required." }, { status: 400 });
    }

    const inrAmount = (trace.totalVolumeTrackedUsd * 85).toLocaleString("en-IN");
    const vasp = trace.destinationVasp;

    const prompt = `You are a senior forensic analyst at India's I4C (Indian Cyber Crime Coordination Centre) under the Ministry of Home Affairs. Write a concise, plain-English intelligence brief for a police officer reviewing this cryptocurrency fraud case.

Use simple, clear language. No bullet lists or code. Write in natural paragraphs like a professional intelligence report.

Case Data:
- Root address: ${trace.rootAddress} on the ${trace.network} blockchain
- Total stolen: $${trace.totalVolumeTrackedUsd.toLocaleString()} USD (approximately Rs. ${inrAmount})
- Number of laundering hops: ${trace.nodes.length - 1}
- Final destination exchange: ${vasp?.name || "Unknown"}
- FIU registration: ${vasp?.fiuNumber || "Not confirmed"}
- Attribution confidence: ${vasp?.confidenceScore || 95}%
- High-risk entities intercepted: ${trace.highRiskEntitiesFound.length > 0 ? trace.highRiskEntitiesFound.join(", ") : "None"}

Write three concise paragraphs covering: what happened to the victim's money, how the syndicate laundered it, and what the police officer must do right now under Section 94 BNSS.`;

    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (openRouterKey && !openRouterKey.includes("YOUR_")) {
      try {
        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AEGIS-TRACE Forensic System",
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.15,
            max_tokens: 600,
          }),
        });

        if (aiRes.ok) {
          const json = await aiRes.json();
          const text = json.choices?.[0]?.message?.content;
          if (text) {
            return NextResponse.json({ success: true, source: "AI", analysis: text });
          }
        }
      } catch (e) {
        console.warn("[ai-analysis] OpenRouter failed, using deterministic engine:", e);
      }
    }

    const fallback = `The victim's money, totalling approximately Rs. ${inrAmount}, was moved off the traditional banking system within minutes of the crime. The funds were converted into USDT cryptocurrency through a peer-to-peer merchant and credited to the suspect's first wallet address on the ${trace.network} blockchain.

The laundering involved ${trace.nodes.length - 1} rapid transfers across disposable intermediary wallets — a technique known as peel-chain layering — where each wallet received the funds and immediately passed them on, making traditional block-by-block tracing extremely difficult without automated tooling. The final transfer showed a classic exchange deposit signature: a micro-gas top-up from the exchange parent wallet followed by a complete balance sweep into ${vasp?.name || "a centralized exchange"}'s internal vault.

Under Section 94 of the Bharatiya Nagarik Suraksha Sanhita, the Investigating Officer must immediately issue a statutory notice to ${vasp?.name || "the exchange"} at ${vasp?.complianceEmail || "their compliance desk"}, demanding a freeze on the identified deposit account, preservation of full KYC records, and disclosure of all associated bank accounts and login activity within twenty-four hours.`;

    return NextResponse.json({ success: true, source: "Deterministic Engine", analysis: fallback });
  } catch (e: any) {
    console.error("[api/ai-analysis]", e);
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
