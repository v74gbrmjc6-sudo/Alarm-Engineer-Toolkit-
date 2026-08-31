export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await fetch(
      "https://ai-gateway.vercel.sh/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-5.5",
          messages: [
            {
              role: "system",
              content:
                "You are an expert UK alarm engineer assistant. Give practical, accurate advice about intruder and fire alarm systems, including Texecom, wiring, faults, commissioning and diagnostics. Be concise and clear. If you are unsure, say so.",
            },
            {
              role: "user",
              content: message,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "AI Gateway request failed",
      });
    }

    return res.status(200).json({
      answer: data.choices?.[0]?.message?.content || "No answer returned.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
    });
  }
}
