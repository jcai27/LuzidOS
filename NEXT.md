# What I'd do next

## What's fragile

- **SAP navigation is prose, not verified.** Both agent prompts describe screens the way the
  assignment described them ("user profile settings," "Create Sales Order Fiori app") because I
  never got a working SAP login during the build — the provided password failed, and a corrected
  one arrived mid-session. The agent has to improvise the actual click path; if the real UI diverges
  from the prompt's description, that's the most likely failure point, not the app's plumbing.
- **Tick-based progress stalls if nobody's watching.** Run state only advances when the browser polls
  `/tick`. Close the tab mid-run and it just sits at "running" until you reopen the page — there's no
  server-side driver keeping it moving. Fine for a demo, not fine for a real async tool.
- **Stop is soft.** Browser Use v4 doesn't document a cancel endpoint, so "Stop" only makes the app
  stop *watching* a run — Browser Use keeps executing (and billing) it server-side.
- **Event-type mapping in the step log is hand-tuned against one observed run.** Browser Use v4's
  event stream is a fairly deep internal agent trace (`core.event` → `part.type` → ...); my
  human-readable mapping and noise filter cover what I saw in calibration, not necessarily every
  event type a longer or different task would emit.
- **Cost/step numbers are best-effort.** `totalCostUsd` comes straight from the API; step count is
  inferred by counting `llm.response` events since there's no official field for it. Reasonable proxy,
  not a guarantee.
- **The spend cap is informational only.** It's displayed in History, nothing stops a new launch once
  it's exceeded.

## What I'd build with another week

- **A durable driver instead of client-driven polling** — Vercel Cron or a queue (Inngest/QStash)
  advancing runs on a schedule, independent of any open tab. Same `advanceRun()` function, just
  called from a different trigger. Would also make a real cancel-on-stop meaningful.
- **Multi-run batch launches.** The spreadsheet parser already returns arbitrary rows; the UI only
  ever folds them into one task. A QA team's actual workflow is closer to "one spreadsheet, N test
  cases, N independent runs" — worth surfacing as a real feature, not just a parsing capability.
- **A recorded-fixture test harness.** I validated the finalize/parsing logic against the stub and a
  handful of live calibration calls; capturing a few real Browser Use event-stream recordings as
  fixtures would let me safely change the parsing/evidence logic without spending API credits per
  iteration.
- **Finer-grained evidence.** Right now the agent is told to save one screenshot at the end. Capturing
  before/after pairs, or one per major step, would make PASS/FAIL results easier to audit at a glance.
- **Basic auth on the deployed app.** It's currently open to anyone with the URL and holds live SAP
  credentials + a Browser Use key. Fine for this exercise, not fine to leave that way.
- **Enforce the spend cap** rather than just display it.

## What I'd change about how I built it

I'd nail down SAP access *before* writing either agent's task prompt, not after — I wrote both
prompts from the assignment's prose, then discovered login was broken partway through. Verifying the
one external dependency I couldn't control should have been step zero. I'd also front-load API
calibration further: I did calibrate Browser Use's real request/response shapes against docs before
writing the client (docs turned out to disagree with the real API on several field names — `sessionId`
not `session_id`, event `ts` not `timestamp`, cost as a string, etc.), which paid off, but I'd start
there even earlier, before sketching any interfaces.
