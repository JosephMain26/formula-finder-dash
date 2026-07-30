import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(3).max(500),
  companies: z.array(z.string()).max(200).optional(),
  technicians: z.array(z.string()).max(200).optional(),
  jobTypes: z.array(z.string()).max(200).optional(),
});

/**
 * One-time AI call: turns a plain-English rule into a structured rule that the
 * app then enforces deterministically. No AI runs when the rule is applied.
 */
export const compileAIRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const known = [
      data.companies?.length ? `Known marketers/companies: ${data.companies.join(", ")}.` : "",
      data.technicians?.length ? `Known technicians: ${data.technicians.join(", ")}.` : "",
      data.jobTypes?.length ? `Known job types: ${data.jobTypes.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content: `Convert one plain-English parsing rule into a single structured rule for a job-management app.
"source" is what to look at: message (whole text) or a parsed field.
"op": contains | equals | any (any = always apply).
"then.field" is the parsed field to set: status (job status), company, tech_name, job_type, payment, notes, phone_no, address, customer_name, price, parts, co_parts, office_parts.
"then.mode": set (replace), prefix, append.
Match values to the known lists when clearly intended.
${known}`,
          },
          { role: "user", content: data.text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "make_rule",
              description: "Build the structured rule",
              parameters: {
                type: "object",
                properties: {
                  whenSource: { type: "string" },
                  whenOp: { type: "string" },
                  whenValue: { type: "string" },
                  thenField: { type: "string" },
                  thenValue: { type: "string" },
                  thenMode: { type: "string" },
                },
                required: ["whenSource", "whenOp", "thenField", "thenValue"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "make_rule" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached, try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace.");
      throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Could not understand that rule — try rephrasing it.");
    const a = JSON.parse(call.function.arguments || "{}");

    return {
      when: {
        source: String(a.whenSource || "message"),
        op: String(a.whenOp || "contains"),
        value: String(a.whenValue || ""),
      },
      then: {
        field: String(a.thenField || ""),
        value: String(a.thenValue || ""),
        mode: String(a.thenMode || "set"),
      },
    };
  });
