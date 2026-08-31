const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MODEL = "openai/gpt-5.5";

const SYSTEM_PROMPT = `
You are the AI Engineer inside the Alarm Engineer Toolkit.

You are a practical UK field-reference assistant for professional alarm
engineers.

Help with:
- Intruder alarms
- Fire alarms
- CCTV
- Access control
- Signalling
- Wiring
- Fault finding
- Commissioning
- Testing
- Batteries
- Voltage and resistance measurements
- Texecom and other alarm equipment

Give clear, practical, step-by-step answers that an engineer can use on site.

Always:
- Start with the most likely causes.
- Explain how to test and prove the cause.
- Use the event log where relevant.
- Ask for the manufacturer and exact panel/device model when necessary.
- Do not invent terminal numbers, programming values or manufacturer-specific
  details.
- Make clear when something depends on the exact panel or device.
- Keep answers reasonably concise.
- Include appropriate safety warnings for mains voltage, batteries and fire
  alarm systems.

You are a troubleshooting aid, not a replacement for the manufacturer's
documentation.
`;

function json(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {

  // Allow browser pre-flight requests
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Use POST /api/chat"
    });
  }

  // API key must be stored in Vercel, NOT in index.html
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    return json(res, 500, {
      error:
        "AI_GATEWAY_API_KEY is missing. Add it in Vercel → Project Settings → Environment Variables."
    });
  }

  try {

    let body = req.body;

    // Handle cases where Vercel supplies the body as text
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return json(res, 400, {
          error: "Invalid JSON."
        });
      }
    }

    let messages = [];

    // Supports:
    // { message: "hello" }
    if (typeof body?.message === "string") {
      messages = [
        {
          role: "user",
          content: body.message
        }
      ];
    }

    // Supports:
    // { prompt: "hello" }
    else if (typeof body?.prompt === "string") {
      messages = [
        {
          role: "user",
          content: body.prompt
        }
      ];
    }

    // Supports:
    // { messages: [...] }
    else if (Array.isArray(body?.messages)) {
      messages = body.messages
        .filter(
          m =>
            m &&
            typeof m.content === "string" &&
            ["user", "assistant"].includes(m.role)
        )
        .map(m => ({
          role: m.role,
          content: m.content
        }));
    }

    if (!messages.length) {
      return json(res, 400, {
        error:
          'No message supplied. Send {"message":"your question"}'
      });
    }

    const response = await fetch(GATEWAY_URL, {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        model: MODEL,

        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          ...messages
        ],

        stream: false,

        temperature: 0.2,

        max_tokens: 1800
      })
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error("AI Gateway error:", response.status, data);

      return json(res, response.status, {
        error:
          data?.error?.message ||
          data?.message ||
          `AI Gateway error ${response.status}`
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error("Unexpected AI response:", data);

      return json(res, 502, {
        error: "AI returned an empty response."
      });
    }

    // Keep the response compatible with the frontend
    return json(res, 200, {
      choices: [
        {
          message: {
            role: "assistant",
            content: answer
          }
        }
      ]
    });

  } catch (error) {

    console.error("Backend error:", error);

    return json(res, 500, {
      error:
        error?.message ||
        "The AI backend failed."
    });
  }
};
