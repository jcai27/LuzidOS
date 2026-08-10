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

  buildTask(rows, creds, namespaceTag) {
    const changes = rows
      .filter((r) => r.Setting && r.NewValue)
      .map((r) => `- Set "${r.Setting}" to "${r.NewValue}"`)
      .join("\n");

    return `
You are testing the SAP S/4HANA Cloud system at ${creds.url}.
Log in with the injected credentials for this domain.

Then:
1. Navigate to the logged-in user's profile / personalization settings screen (e.g. user avatar menu -> "Settings" or "Personalize My Home Page").
2. Apply the following change(s):
${changes}
3. Save the change(s).
4. Reload or reopen the settings screen and read back the value(s) to verify they actually persisted. Do not trust a save confirmation alone.
5. Take a screenshot of the settings screen showing the new value(s) after reload, and save it to your workspace as "after.png".
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
