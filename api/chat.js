// Vercel serverless function: /api/chat.js
// Uses Vercel AI Gateway with the AI_GATEWAY_API_KEY environment variable.

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

const DEFAULT_MODEL = "minimax/minimax-m2.7-free";

const SYSTEM_PROMPT = `
You are the AI Engineer inside an Alarm Engineer Toolkit for UK alarm engineers.

Give practical, technically careful answers about intruder alarms, fire alarms,
Texecom, wiring, zones, tampers, bells, batteries, communications, SmartCom,
Ricochet, expanders, PIRs, magnetic contacts, diagnostics, commissioning and
fault finding.

When diagnosing a fault:
1. Start with the event/log history when available.
2. Explain the most likely causes.
3. Give safe, step-by-step checks in a sensible order.
4. Distinguish what is confirmed from what is only a possibility.
5. Do not invent manufacturer-specific terminal numbers, programming paths,
   voltages, resistor values or procedures.
6. If the exact panel/model is needed, ask for it.
7. Keep advice suitable for a competent alarm engineer.
8. Use UK terminology and British English.
`;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.end(JSON.stringify(data));
}

export default async function handler(req, res) {

  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed. Use POST /api/chat."
    });
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    return sendJson(res, 500, {
      ok: false,
      error: "AI_GATEWAY_API_KEY is missing from Vercel."
    });
  }

  try {

    let body = req.body || {};

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return sendJson(res, 400, {
          ok: false,
          error: "Invalid JSON request."
        });
      }
    }

    let messages = [];

    if (Array.isArray(body.messages) && body.messages.length) {

      messages = body.messages
        .filter(
          m =>
            m &&
            typeof m.content === "string"
        )
        .slice(-20)
        .map(m => ({
          role:
            ["system", "user", "assistant"].includes(m.role)
              ? m.role
              : "user",
          content: m.content.slice(0, 12000)
        }));

    } else {

      const prompt =
        typeof body.prompt === "string"
          ? body.prompt
          : typeof body.message === "string"
            ? body.message
            : typeof body.query === "string"
              ? body.query
              : "";

      if (!prompt.trim()) {
        return sendJson(res, 400, {
          ok: false,
          error: "No prompt was supplied."
        });
      }

      messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: prompt.trim().slice(0, 12000)
        }
      ];
    }

    if (!messages.some(m => m.role === "system")) {
      messages.unshift({
        role: "system",
        content: SYSTEM_PROMPT
      });
    }

    const model =
      process.env.AI_MODEL ||
      DEFAULT_MODEL;

    const gatewayResponse = await fetch(
      GATEWAY_URL,
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.2,
          max_tokens: 1200
        })
      }
    );

    const rawText =
      await gatewayResponse.text();

    let data = {};

    try {
      data = rawText
        ? JSON.parse(rawText)
        : {};
    } catch {
      data = {};
    }

    if (!gatewayResponse.ok) {

      console.error(
        "AI Gateway error:",
        gatewayResponse.status,
        data
      );

      return sendJson(
        res,
        gatewayResponse.status,
        {
          ok: false,
          error:
            data?.error?.message ||
            data?.error ||
            rawText ||
            `AI Gateway returned HTTP ${gatewayResponse.status}`,
          status: gatewayResponse.status
        }
      );
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      data?.output_text ||
      "";

    if (!answer) {

      console.error(
        "Unexpected AI response:",
        data
      );

      return sendJson(res, 502, {
        ok: false,
        error: "The AI returned an empty response."
      });
    }

    return sendJson(res, 200, {
      ok: true,
      answer: answer,
      reply: answer,
      text: answer,
      content: answer
    });

  } catch (error) {

    console.error(
      "Chat function error:",
      error
    );

    return sendJson(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Unable to reach the AI Gateway."
    });
  }
}