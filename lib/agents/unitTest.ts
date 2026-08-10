import { z } from "zod";
import type { AgentDefinition } from "@/lib/agents/base";

const UnitTestResultSchema = z.object({
  pass: z.boolean(),
  orderNumber: z.string().nullable(),
  reason: z.string(),
});
export type UnitTestResult = z.infer<typeof UnitTestResultSchema>;

export const unitTestAgent: AgentDefinition<UnitTestResult> = {
  type: "unit_test",
  label: "Unit Test Agent",
  resultSchema: UnitTestResultSchema,

  buildTask(rows, creds, namespaceTag) {
    const byField = Object.fromEntries(rows.map((r) => [r.Field, r.Value]));
    const testCase = byField.TestCase ?? "Create Sales Order";
    const expected = byField.ExpectedResult ?? "SAP returns an order number confirmation";
    const fieldLines = rows
      .filter((r) => r.Field && !["TestCase", "ExpectedResult"].includes(r.Field))
      .map((r) => `- ${r.Field}: ${r.Value}`)
      .join("\n");

    return `
You are executing this test case against the SAP S/4HANA Cloud system at ${creds.url}: "${testCase}".
Log in with the injected credentials for this domain.

Steps:
1. Navigate to the sales order creation screen (e.g. app "Create Sales Order" / VA01-equivalent Fiori app).
2. Create a new sales order using these values:
${fieldLines}
3. In the purchase order / customer reference text field, if present, enter "${namespaceTag}" so this order is identifiable as test data.
4. Submit / save the order.
5. Observe the result. Expected result: ${expected}.
6. Take a screenshot of the final result screen (the order confirmation, or the error/validation message if it failed) and save it to your workspace as "confirmation.png".
7. If a popup, cookie banner, "what's new" tour, incomplete-field warning, or session prompt appears at any point, handle it (dismiss, or fill the missing required field with a sensible default) and continue.
8. Take note of the exact order number SAP returns, if any.

When finished, reply with ONLY a JSON object, no markdown fences, no other text, of this exact shape:
{"pass": boolean, "orderNumber": string|null, "reason": string}

- "pass": true only if SAP actually returned an order number confirmation as expected.
- "orderNumber": the confirmation/order number if one was returned, else null.
- "reason": one or two sentences on what happened, including any errors or validation messages shown.
`.trim();
  },

  toVerdict(result) {
    return {
      status: result.pass ? "pass" : "fail",
      summary: result.reason,
    };
  },
};
