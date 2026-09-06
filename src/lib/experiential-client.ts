/**
 * AEGIS-TRACE Sovereign Intelligence Gateway: Experiential Labs Client
 * 
 * Routes LLM completions through https://api.experientiallabs.ai/v1
 * Authenticated via EXPLABS_API_KEY environment variable.
 * Default Target Model: "gpt-6-astra" (exact ID)
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  };
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  timeoutMs?: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
}

export interface ChatCompletionResult {
  id?: string;
  model: string;
  reply: string;
  tool_calls?: any[];
  usage?: TokenUsage;
  finish_reason?: string;
  raw?: any;
}

/**
 * Validates and retrieves Experiential Labs Gateway configuration.
 * Throws explicit instruction if EXPLABS_API_KEY is not set.
 */
export function getExperientialConfig() {
  const apiKey = process.env.EXPLABS_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey.includes("your_") || apiKey.includes("YOUR_")) {
    throw new Error(
      "EXPLABS_API_KEY environment variable is not set. Please create one under Settings -> API keys and export it."
    );
  }

  const baseUrl = (process.env.EXPLABS_BASE_URL || "https://api.experientiallabs.ai/v1").replace(/\/+$/, "");
  const model = process.env.EXPLABS_MODEL || "gpt-6-astra";

  return { apiKey, baseUrl, model };
}

/**
 * Executes a Chat Completion request through the Experiential Labs Gateway.
 * Fully compatible with OpenAI wire format; preserves streaming and tool-calls.
 */
export async function createExperientialChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult | Response> {
  const { apiKey, baseUrl, model: defaultModel } = getExperientialConfig();
  const selectedModel = options.model || defaultModel;

  const payload: Record<string, any> = {
    model: selectedModel,
    messages: options.messages,
  };

  if (options.max_tokens) {
    payload.max_tokens = options.max_tokens;
  }

  // Model route compatibility: gpt-6-astra explicitly does not support the 'temperature' parameter.
  if (options.temperature !== undefined && selectedModel !== "gpt-6-astra") {
    payload.temperature = options.temperature;
  }

  if (options.stream) {
    payload.stream = true;
  }

  if (options.tools && options.tools.length > 0) {
    payload.tools = options.tools;
    if (options.tool_choice) {
      payload.tool_choice = options.tool_choice;
    }
  }

  const endpoint = `${baseUrl}/chat/completions`;
  const timeoutMs = options.timeoutMs || 25000;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "AEGIS-TRACE-Forensic-Gateway/1.0",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  // If streaming is requested, return the raw Response object directly for downstream SSE piping
  if (options.stream) {
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Experiential Labs Gateway stream error (HTTP ${res.status}): ${errText}`);
    }
    return res;
  }

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data?.error?.message || `HTTP ${res.status}`;
    const errorCode = data?.error?.code || "unknown";
    const errorType = data?.error?.type || "gateway_error";

    const err = new Error(`[Experiential Labs] (${selectedModel}) ${errorMsg}`);
    (err as any).statusCode = res.status;
    (err as any).code = errorCode;
    (err as any).type = errorType;
    (err as any).rawError = data?.error;
    throw err;
  }

  const choice = data.choices?.[0];
  const reply = choice?.message?.content || "";
  const tool_calls = choice?.message?.tool_calls;
  const usage: TokenUsage | undefined = data.usage;

  return {
    id: data.id,
    model: data.model || selectedModel,
    reply,
    tool_calls,
    usage,
    finish_reason: choice?.finish_reason,
    raw: data,
  };
}
