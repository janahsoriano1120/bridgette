import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-haiku-4-5-20251001";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildPrompt(meal: string, context: string) {
  return `You are Bridgette, a warm, Filipino-first health companion. A user logged a meal. Give a short, supportive reflection on the FOOD.

STRICT RULES, follow all:
- Use ONLY general, well-established nutrition knowledge. Speak categorically about food types (for example, palm oil tends to be high in saturated fat).
- NEVER state numbers (no grams, calories, percentages). You have no nutrition database.
- Always hedge: "tends to", "can be", "generally", "might".
- NEVER diagnose, prescribe, or claim the user has any condition. Comment on the food, not the person.
- Keep each item to one short, plain sentence. Warm, conversational. No emojis.
${context ? `- The user's doctor advised: "${context}". You may gently connect the meal to that, without prescribing.` : ""}

Meal: "${meal}"

Return ONLY valid JSON, no other text:
{
  "flag": "healthy" | "moderate" | "unhealthy",
  "working": ["one or two short sentences on what is generally good about it"],
  "noting": ["one or two short sentences on what to be mindful of"],
  "swap": "one gentle, optional swap for next time",
  "askDoctor": "one hedged thing they could ask their doctor"
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { meal, context = "" } = await req.json();
    if (!meal || typeof meal !== "string") {
      return new Response(JSON.stringify({ error: "meal required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: buildPrompt(meal, context) }],
      }),
    });

    const data = await resp.json();
    const text = (data?.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify({ meal, ...parsed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
