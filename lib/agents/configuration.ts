import { z } from "zod";
import type { AgentDefinition } from "@/lib/agents/base";

const ConfigurationResultSchema = z.object({
  applied: z.boolean(),
  setting: z.string(),
  before: z.string(),
  after: z.string(),
  summary: z.string(),
});
export type ConfigurationResult = z.infer<typeof ConfigurationResultSchema>;

export const configurationAgent: AgentDefinition<ConfigurationResult> = {
  type: "configuration",
  label: "Configuration Agent",
  resultSchema: ConfigurationResultSchema,
  // Verified: "low" cut this from ~248s/$0.048 to ~130s/$0.020 with no
  // quality loss across a real run. This flow is short and low-surface-area
  // enough that the model doesn't need to be careful the way the sales
  // order flow does — see unitTest.ts for the case where "low" broke.
  reasoningEffort: "low",

  buildTask(rows, creds, namespaceTag) {
    const changes = rows
      .filter((r) => r.Setting && r.NewValue)
      .map((r) => `- Set "${r.Setting}" to "${r.NewValue}"`)
      .join("\n");

    return `
You are testing the SAP S/4HANA Cloud system at ${creds.url}.
Log in with username "${creds.username}" and password "${creds.password}".

Interact the way a person would: click and type on the actual page elements. Avoid writing
JavaScript/DOM-injection to fill fields or trigger clicks — if a script-driven click causes a page
navigation (e.g. submitting the login form), the page's execution context can be destroyed mid-script
and the call can hang indefinitely. If you do need to click something that navigates, do it as its own
action and confirm the new page has loaded before doing anything else.

Then:
1. Click the user avatar icon in the top-right corner of the screen, then click "Settings" in the
   dropdown menu. This opens a "My Home Settings" dialog with a "Layout" section showing toggleable
   visibility eye-icons for several home-page sections (e.g. To-Dos, News, Pages, Apps, Insights
   Tiles, Insights Cards). If the dialog doesn't open on the Layout tab by default, click "Layout"
   in the left-hand list.
2. Apply the following change(s) by clicking the eye-icon toggle next to the named section so its
   visibility matches the requested value ("Hidden"/"Off" = toggle so the eye is not the filled/blue
   state; "Visible"/"On" = toggle so it is):
${changes}
3. Click "Close" to close the dialog.
4. Reopen the same dialog (avatar icon -> "Settings") and check the same toggle(s) to verify the new
   state actually persisted. Do not trust the act of toggling alone — you must reopen and re-observe.
5. Take a screenshot of the reopened dialog showing the persisted state, and save it to your
   workspace as "after.png".
6. If a popup, cookie banner, "what's new" tour, or session prompt appears at any point, dismiss it and continue.
7. Only touch the setting(s) listed above, for this one logged-in user. Do NOT change any global system settings or any other user's settings.
8. If you touch any free-text note/reference field, prefix it with "${namespaceTag}".

When finished, reply with ONLY a JSON object, no markdown fences, no other text, of this exact shape:
{"applied": boolean, "setting": string, "before": string, "after": string, "summary": string}

- "applied": true only if you confirmed the new value by reading it back after a reload/reopen.
- "before" / "after": the values you actually observed.
- "summary": one or two sentences on what happened, including any problems encountered.
`.trim();
  },

  toVerdict(result) {
    return {
      status: result.applied ? "pass" : "fail",
      summary: result.summary,
    };
  },
};
