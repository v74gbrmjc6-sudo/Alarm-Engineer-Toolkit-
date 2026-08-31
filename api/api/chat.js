// api/chat.js

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI_GATEWAY_API_KEY is not configured in Vercel."
    });
  }

  try {
    const body = req.body || {};

    let messages = Array.isArray(body.messages)
      ? body.messages
      : null;

    if (!messages) {
      const text = String(
        body.prompt ?? body.message ?? ""
      ).trim();

      if (!text) {
        return res.status(400).json({
          error: "No message was supplied."
        });
      }

      messages = [
        {
          role: "user",
          content: text
        }
      ];
    }

    messages = messages
      .filter(
        (m) =>
          m &&
          ["system", "user", "assistant"].includes(m.role)
      )
      .map((m) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : JSON.stringify(m.content)
      }));

    if (!messages.length) {
      return res.status(400).json({
        error: "No valid messages were supplied."
      });
    }

    const response = await fetch(
      "https://ai-gateway.vercel.sh/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-5.5",
          messages,
          temperature: 0.2,
          max_tokens: 1200
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("AI Gateway error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.error ||
          "AI Gateway request failed."
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Chat API error:", error);

    return res.status(500).json({
      error: "Unable to contact the AI Gateway.",
      details: error?.message || "Unknown error."
    });
  }
}