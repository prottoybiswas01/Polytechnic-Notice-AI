/**
 * Calls Cloudflare Workers AI text generation model.
 * Primary AI service with automatic fallback to Gemini API key rotation upon failure/quota limit.
 */
export async function callCloudflareAI(messages, systemPrompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";

  if (!accountId || !token) {
    return { success: false, error: "Cloudflare credentials missing" };
  }

  const payloadMessages = [];
  if (systemPrompt) {
    payloadMessages.push({ role: "system", content: systemPrompt });
  }

  for (const m of messages) {
    payloadMessages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: payloadMessages }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn(`[Cloudflare Workers AI] HTTP ${response.status} failed: ${errorText}`);
      return { success: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    if (!data.success) {
      console.warn(`[Cloudflare Workers AI] API success=false:`, data.errors);
      return { success: false, errors: data.errors };
    }

    const replyText =
      data.result?.response ||
      data.result?.choices?.[0]?.message?.content ||
      data.result?.description ||
      data.result?.text;

    if (replyText && typeof replyText === "string" && replyText.trim().length > 0) {
      return { success: true, reply: replyText.trim() };
    }

    return { success: false, error: "Empty reply text from Cloudflare Workers AI" };
  } catch (err) {
    console.error("[Cloudflare Workers AI Error]:", err);
    return { success: false, error: err.message || err };
  }
}
