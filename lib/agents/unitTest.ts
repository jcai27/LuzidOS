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
  // Deliberately left at Browser Use's default ("xhigh"): "low" was tested
  // and failed a real run — the agent submitted SAP's login by clicking
  // hardcoded pixel coordinates instead of carefully deriving them from its
  // own DOM inspection, and missed. "medium" passed but wasn't meaningfully
  // faster (~471s vs ~495s baseline). This flow has more screens and more
  // fields than the config agent, and apparently needs the full reasoning
  // budget to navigate them reliably.

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
Log in with username "${creds.username}" and password "${creds.password}".

Interact the way a person would: click and type on the actual page elements. Avoid writing
JavaScript/DOM-injection to fill fields or trigger clicks — if a script-driven click causes a page
navigation (e.g. submitting the login form), the page's execution context can be destroyed mid-script
and the call can hang indefinitely. If you do need to click something that navigates, do it as its own
action and confirm the new page has loaded before doing anything else.

Steps:
1. Use the search bar at the top of the screen to search "Create Sales Order". Open the result
   labeled with technical name "VA01" (a plain "Create Sales Orders" app) — not the "Intercompany"
   variant.
2. On the initial screen, enter Order Type "OR" (Standard Order). If it's rejected, click the
   value-help icon next to the field, search, and pick any standard/order-type entry that looks
   equivalent (e.g. containing "Standard Order").
3. Fill in the Organizational Data section and any other fields on this screen using these values:
${fieldLines}
   If any of these values is rejected as invalid for this system, use that field's value-help (F4 /
   the icon next to the field) to pick any valid value of the same kind so you can proceed, and
   mention the substitution in your final "reason". In any value-help search dialog, if two searches
   in a row return nothing useful, stop narrowing the search term — clear the filter completely and
   pick the first reasonable entry in the unfiltered list instead of continuing to retry variations.
4. Click "Continue" to proceed to the order entry screen.
5. Fill in the remaining order details (e.g. Sold-To Party, PO/customer reference, line item Material
   and Quantity) using the values above. In the purchase order / customer reference text field, if
   present, enter "${namespaceTag}" so this order is identifiable as test data.
6. Submit / save the order.
7. Observe the result. Expected result: ${expected}.
8. Take a screenshot of the final result screen (the order confirmation, or the error/validation message if it failed) and save it to your workspace as "confirmation.png".
9. If a popup, cookie banner, "what's new" tour, incomplete-field warning, or session prompt appears at any point, handle it (dismiss, or fill the missing required field with a sensible default) and continue.
10. Take note of the exact order number SAP returns, if any.

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
