// Parse a free-form WhatsApp/SMS job message into structured fields using Lovable AI.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      message,
      companies = [],
      technicians = [],
      jobTypes = [],
      generalRules = "",
      marketerRules = [],
      recentCorrections = [],
    } = await req.json();
    if (!message || typeof message !== "string" || message.length > 5000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You extract job/service details from informal WhatsApp/SMS messages sent by technicians or dispatchers. Be flexible — formats vary. Extract only what's clearly present; leave fields empty if unsure.

Currency: numbers like "255$", "$255", "255" near words like "closed/total/price" are the price. "Parts 15$" means parts cost.
Phone: extract digits, keep + prefix if present.
Job type guess from keywords (e.g., "Garage Door Repair", "Plumbing", "Electrical").
${companies.length ? `Known marketers/companies: ${companies.join(", ")}.` : ""}
${technicians.length ? `Known technicians: ${technicians.join(", ")}.` : ""}
${jobTypes.length ? `Known job types: ${jobTypes.join(", ")}.` : ""}
Match company/tech/job_type to known values when there's a clear match (case-insensitive).
${
  Array.isArray(marketerRules) && marketerRules.length
    ? `Marketer mapping rules (apply when message contains the listed names/keywords, case-insensitive):\n${marketerRules
        .filter((r: any) => r?.marketerName && Array.isArray(r?.patterns) && r.patterns.length)
        .map((r: any) => `- If message mentions any of [${r.patterns.join(", ")}] → company = "${r.marketerName}"`)
        .join("\n")}`
    : ""
}
${
  Array.isArray(recentCorrections) && recentCorrections.length
    ? `Recent admin corrections (learn from these — prefer the corrected value when the same pattern appears):\n${recentCorrections
        .slice(0, 25)
        .map((c: any) => `- ${c.field}: parsed "${c.parsed}" → corrected "${c.corrected}"`)
        .join("\n")}`
    : ""
}
${generalRules ? `Additional rules from the admin (always follow):\n${generalRules}` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_job",
              description: "Extract structured job fields from the message",
              parameters: {
                type: "object",
                properties: {
                  customer_name: { type: "string", description: "Customer's full name" },
                  phone_no: { type: "string", description: "Phone number" },
                  address: { type: "string", description: "Full street address" },
                  job_type: { type: "string", description: "Type of service (Garage Door Repair, Plumbing, etc.)" },
                  job_date: { type: "string", description: "Job date in YYYY-MM-DD format if found, otherwise empty" },
                  notes: { type: "string", description: "Service description, time window, special instructions" },
                  price: { type: "number", description: "Total price/closed amount in dollars" },
                  parts: { type: "number", description: "Parts cost (tech parts) in dollars" },
                  co_parts: { type: "number", description: "Co-parts (marketer parts) in dollars" },
                  office_parts: { type: "number", description: "Office parts in dollars" },
                  tech_name: { type: "string", description: "Technician name if mentioned" },
                  company: { type: "string", description: "Marketer/company name if mentioned" },
                  payment: { type: "string", description: "Payment method (Cash, Card, Check, Zelle, etc.)" },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_job" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached, please retry shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI parsing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : {};

    return new Response(JSON.stringify({ extracted: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-job-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
