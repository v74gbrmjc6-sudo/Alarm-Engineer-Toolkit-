export default async function handler(req, res) {
  // Allow your website to call this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // Get your secret key from Vercel
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI_GATEWAY_API_KEY is missing from Vercel."
    });
  }

  try {
    const body = req.body || {};

    // Your website can send either messages, prompt, or message
    let messages = body.messages;

    if (!Array.isArray(messages)) {
      const text = String(
        body.prompt || body.message || ""
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

    // Send request to Vercel AI Gateway
    const response = await fetch(
      "https://ai-gateway.vercel.sh/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "minimax/minimax-m2.7-free",

          messages: messages,

          temperature: 0.2,

          max_tokens: 1200
        })
      }
    );

    const data = await response.json();

    // Gateway returned an error
    if (!response.ok) {
      console.error("AI Gateway error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.error ||
          "AI Gateway request failed."
      });
    }

    // Return the AI response to your website
    return res.status(200).json(data);

  } catch (error) {
    console.error("Chat API error:", error);

    return res.status(500).json({
      error: "Unable to contact AI Gateway.",
      details: error.message
    });
  }
}