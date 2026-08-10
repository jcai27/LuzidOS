# What I'd do next

## What's fragile

- **Tick-based progress stalls if nobody's watching.** Run state only advances when the browser polls
  `/tick`. Close the tab mid-run and it just sits at "running" until you reopen the page — there's no
  server-side driver keeping it moving. Fine for a demo, not fine for a real async tool.
- **Login is fragile to how the agent chooses to submit the form.** The first two real attempts against
  SAP hung indefinitely (5+ minutes, zero new events, confirmed stuck by polling Browser Use's API
  directly, not just our own DB) — the agent had chosen to submit the SAP sign-in form via
  `Runtime.evaluate(...).click()` (raw CDP script), and a script-driven click that triggers a page
  navigation can destroy its own execution context mid-flight and hang forever. Adding an explicit
  instruction ("interact like a person — click/type; avoid JS-injection navigation, and if you must
  navigate via script, treat it as its own action") changed the agent's behavior to a physical
  `Input.dispatchMouseEvent` click, which completed cleanly on the next real attempt. This is a real,
  reproducible failure mode of computer-use agents in general (scripted clicks racing page navigation),
  not something specific to SAP or this prompt — worth a standing guardrail in any agent prompt that
  drives a browser through a login/submit flow.
- **Credentials are embedded directly in the task prompt sent to the LLM.** Not the original design —
  I built around Browser Use's documented domain-scoped `secrets` param, then discovered (via the live
  `GET /api/v4/openapi.json`, not the docs) that the real `RunCreateRequest` schema has no such field;
  sending it 422s. So username/password go straight into the prompt text now.
  `lib/runLifecycle.ts#redactSecrets` scrubs the password before the row is written to Postgres, but
  it's still live in the outbound request to Browser Use (and whatever it logs) for the run's
  duration. Mitigated only by this being a disposable sandbox account, not a real one.
- **Event-type mapping in the step log is hand-tuned against one observed run.** Browser Use v4's
  event stream is a fairly deep internal agent trace (`core.event` → `part.type` → ...); my
  human-readable mapping and noise filter cover what I saw in calibration, not necessarily every
  event type a longer or different task would emit.
- **Cost/step numbers are best-effort.** `totalCostUsd` comes straight from the API; step count is
  inferred by counting `llm.response` events since there's no official field for it. Reasonable proxy,
  not a guarantee.
- **The aggregate spend cap is still informational only.** `RUN_MAX_COST_USD` (`maxCostUsd`) is now a
  real, API-enforced *per-run* cap — Browser Use itself stops the run. But `BROWSER_USE_SPEND_CAP_USD`,
  the running total shown in History, is still just displayed; nothing stops a new launch once
  cumulative spend crosses it.

## Baseline production-readiness gaps

The above is specific to this app's actual behavior; these are the more generic "would this survive
real production load/ops" gaps. "Load balancing" in the classic sense mostly doesn't apply — Vercel's
serverless functions already scale and balance automatically, and the app is already stateless (no
in-memory run state, everything lives in Postgres) — but there are real analogs to it and its
neighbors:

- **No retries/backoff on the Browser Use API calls.** `lib/browserUse.ts#request` is a single
  `fetch`; any transient network blip or 429/5xx throws immediately and fails the whole run rather
  than retrying with backoff. At real scale (many concurrent runs) this is the first thing that would
  cause spurious failures.
- **No rate limiting on the app's own API routes.** Combined with no auth (already noted above),
  anyone with the URL can launch unbounded runs — this is a direct line to runaway Browser Use spend,
  not just a security nicety.
- **`/api/stats` and `totalCostUsd()` do a full table scan on every call.** [db.ts:165-181](lib/db.ts#L165-L181)
  pulls every row's `cost_json` and sums it in JS on every request; `listRuns()` has no pagination.
  Fine at demo scale, an O(all runs) cost per poll (from every open tab, every tick) once run history
  is in the thousands. Should be a SQL aggregate/materialized total plus a cache, and `listRuns` should
  paginate.
- **No DB migrations.** Schema is `CREATE TABLE IF NOT EXISTS` inline in application code
  ([db.ts:23-54](lib/db.ts#L23-L54), similarly in `lib/mockSap.ts`) — no migration history, no safe way
  to `ALTER` a column, no rollback story. Fine for one developer during a 3-hour build, not for a team.
- **No indexes beyond the primary key.** `listRuns()` does `ORDER BY created_at DESC` with a full
  table scan; needs an index on `created_at` (and probably `status`) once this isn't a handful of
  demo rows.
- **The real analog to "load balancing" here is Neon's compute autoscaling and Browser Use's own
  per-account rate limits** — nothing in this app backs off or queues against either, so a burst of
  concurrent runs could hit Neon's connection ceiling or Browser Use's rate limit and just fail loudly
  instead of degrading gracefully.
- **No structured logging, error tracking, or alerting.** Failures land in the run's `error` column or
  a `console.error`; there's no Sentry/log aggregation and nothing pages anyone if Browser Use starts
  failing for every user at once.
- **No health-check endpoint** for uptime monitoring, and **no data retention policy** — run rows and
  Blob screenshots accumulate forever with no TTL/archival, and Neon's backup/PITR settings are
  whatever the Vercel Marketplace default provisioned, not something I configured deliberately.

## What I'd build with another week

- **Session reuse instead of prompt-embedded credentials.** Browser Use v4 supports
  `browserSettings.profileId` for reusing a pre-authenticated session. A one-time bootstrap run could
  log in once against a saved profile; every subsequent run would reference that profile instead of
  re-sending the raw password in the task text on every launch — directly closes the credential-in-prompt
  fragility above.
- **A durable driver instead of client-driven polling** — Vercel Cron or a queue (Inngest/QStash)
  advancing runs on a schedule, independent of any open tab. Same `advanceRun()` function, just
  called from a different trigger. Now that Stop does a real `cancel`, a durable driver would also let
  a server-side timeout hard-cancel a run even if no one's watching, not just stop polling it.
- **Finish the recorded-fixture test harness.** `playwright` is already a devDependency (added for
  exactly this) but nothing's wired up yet. Driving `app/mock-sap/*` directly, or recording a few real
  Browser Use event-stream responses as fixtures, would let me safely change parsing/finalize logic
  without spending API credits or mock-app time per iteration.
- **Multi-run batch launches.** The spreadsheet parser already returns arbitrary rows; the UI only
  ever folds them into one task. A QA team's actual workflow is closer to "one spreadsheet, N test
  cases, N independent runs" — worth surfacing as a real feature, not just a parsing capability.
- **Finer-grained evidence.** Right now each agent saves one screenshot at the end. The configuration
  agent already reopens its settings dialog to verify persistence — capturing a screenshot at that
  reopen *and* one before, or one per major step for the unit-test agent, would make PASS/FAIL results
  easier to audit at a glance.
- **Basic auth on the deployed app.** It's currently open to anyone with the URL, and now that
  credentials are embedded in task prompts rather than a separate secrets channel, limiting who can
  even trigger a run matters more than it did before.
- **Enforce the aggregate spend cap**, not just the per-run one `RUN_MAX_COST_USD` already covers.

## What I'd change about how I built it

I'd nail down SAP access *before* writing either agent's task prompt, not after — I wrote both
prompts from the assignment's prose, then discovered login was broken partway through. Verifying the
one external dependency I couldn't control should have been step zero. I'd also front-load API
calibration further: I did calibrate Browser Use's real request/response shapes against docs before
writing the client (docs turned out to disagree with the real API on several field names — `sessionId`
not `session_id`, event `ts` not `timestamp`, cost as a string, etc.), which paid off, but I'd start
there even earlier, before sketching any interfaces.
