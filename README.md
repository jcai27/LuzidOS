# Luzid SAP Agent Console

A web app for launching and monitoring AI browser agents (via [Browser Use](https://browser-use.com))
against an SAP S/4HANA Cloud sandbox. Supports two agent workflows, each driven by an uploaded
Excel spreadsheet:

- **Configuration Agent** — applies a profile setting change in SAP and verifies it took effect.
- **Unit Test Agent** — executes a sales-order test case end to end and reports PASS/FAIL with
  screenshot evidence.

**Live demo:** https://luzid-sap-agent-console.vercel.app
**Repo:** https://github.com/jcai27/LuzidOS

---

## Setup

### Prerequisites

- Node 20+
- A [Browser Use](https://cloud.browser-use.com/settings) API key
- A Postgres database (run history) — the project uses [Neon](https://neon.tech), provisioned via
  the Vercel Marketplace: `npx vercel install neon`
- A [Vercel Blob](https://vercel.com/docs/vercel-blob) store (evidence screenshots):
  `npx vercel blob create-store <name> --access public`

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (run history) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (evidence screenshots) |
| `BROWSER_USE_API_KEY` | Browser Use Cloud API key |
| `BROWSER_USE_MODEL` | Optional; leave unset to use Browser Use's default model |
| `SAP_URL` | SAP sandbox URL, e.g. `https://myXXXXXX.s4hana.cloud.sap/ui?sap-client=100` |
| `SAP_USERNAME` / `SAP_PASSWORD` | SAP login. Never sent to the LLM — passed via Browser Use's domain-scoped `secrets` param |
| `BROWSER_USE_SPEND_CAP_USD` | Soft, client-side-only spend awareness shown in the History view |
| `RUN_TIMEOUT_SECONDS` | Wall-clock timeout enforced by the poller (default 300s) |
| `BROWSER_USE_STUB` | `true` = use a zero-cost offline fake Browser Use client (fixed responses, ~6s fake runs). `false` = real API |

If you provisioned Postgres/Blob via the Vercel CLI as above and linked the project (`vercel link`),
`vercel env pull .env.local` fetches those two automatically.

### Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Start with `BROWSER_USE_STUB=true` to exercise the full app (launch,
live polling, evidence, history, stop/retry) with zero API spend before flipping to the real key.

### Deploy

```bash
npx vercel link
npx vercel install neon        # provisions + connects Postgres
npx vercel blob create-store luzid-evidence --access public   # provisions + connects Blob
npx vercel env add <NAME> production,preview --value "<value>" --yes   # SAP/Browser Use vars
npx vercel deploy --prod
```

The project is connected to this GitHub repo, so pushes to `main` also trigger production deploys.

---

## Architecture

Single Next.js app (App Router) — UI and API routes in one deployable unit, run entirely on Vercel's
serverless platform.

```
Browser (Launch / Run / History pages)
      │  fetch, polled every ~2s while a run is active
      ▼
Next.js API routes
  POST /api/runs            parse spreadsheet, build task prompt, create the Browser Use run
  POST /api/runs/:id/tick   advance one run by one poll step (status/events → DB)
  POST /api/runs/:id/stop   mark cancelled; next tick stops polling
  POST /api/runs/:id/retry  clone a run's input and relaunch
  GET  /api/runs, /api/runs/:id, /api/stats
      │
      ▼
lib/runLifecycle.ts   orchestration shared by both agents
      │                    │                        │
      ▼                    ▼                        ▼
lib/agents/*.ts      lib/browserUse.ts        Neon Postgres
(per-agent prompt,    (Browser Use Cloud       (run history,
 result schema,        API v4 client)           structured results)
 verdict logic)              │
                             ▼
                    Browser Use Cloud API
                    (runs the agent, live view,
                     event stream, screenshots)
                             │
                             ▼
                    SAP S/4HANA Cloud sandbox
                             │
                    screenshots re-uploaded to
                             ▼
                       Vercel Blob (evidence)
```

**Request flow for a run:** `POST /api/runs` parses the uploaded spreadsheet into row objects,
builds an agent-specific task prompt, and makes one Browser Use API call to start the agent — this
returns immediately (Browser Use runs are async on their side). The Run page then polls
`POST /api/runs/:id/tick` every ~2s; each tick does one unit of work — fetch latest status/events,
persist progress, and if the run just finished, validate the structured JSON result against a zod
schema, derive a PASS/FAIL verdict, and pull any screenshots the agent saved into its Browser Use
workspace, re-uploading them to Vercel Blob before their presigned URLs expire (~60s).

---

## Key decisions

- **Shared agent abstraction.** The two workflows are the same pipeline — parse spreadsheet → build
  task prompt → run in Browser Use → validate structured JSON → derive PASS/FAIL — differing only in
  the prompt, the result schema, and the verdict rule. `lib/agents/base.ts` defines that as an
  `AgentDefinition` interface; `configuration.ts` and `unitTest.ts` each implement three functions;
  `lib/runLifecycle.ts` is the one orchestrator both run through.

- **Client-driven polling instead of server push.** Originally built with SSE (a server loop holding
  a connection open and polling Browser Use itself). That doesn't survive serverless — a function
  isn't guaranteed to stay alive for a run's whole duration. Replaced it with the browser polling a
  `/tick` endpoint every ~2s; each tick is one short, stateless request, so it behaves identically
  whether the backend is a long-lived local process or ephemeral serverless functions.

- **Structured output via prompt + zod, not an API schema param.** Browser Use v4 doesn't accept a
  JSON-schema parameter — the task prompt explicitly requests JSON, and the raw string result is
  parsed and validated client-side (`resultSchema.safeParse`) before being trusted.

- **Credentials never reach the LLM.** SAP login is passed through Browser Use's domain-scoped
  `secrets` param, matched only against `allowed_domains`, not interpolated into the task prompt.

- **Verdict is separate from run status.** `status` (queued/running/completed/failed/timed_out/
  cancelled) is the technical outcome of the Browser Use run; `verdict` (pass/fail) is the business
  result. A run can `complete` successfully and still legitimately `fail` the test case — collapsing
  those into one field would hide that distinction from the UI.

- **Shared-sandbox namespacing.** Every run gets a `LUZID-<shortId>` tag that the agent is instructed
  to write into any reference/comment field it touches, so created SAP records are attributable and
  won't be mistaken for another candidate's data. The Configuration Agent's prompt explicitly scopes
  it to the one provided user's profile settings, never global config.

- **Built and tested against a stub before spending real API credits.** `lib/browserUseStub.ts` is a
  drop-in fake `BrowserUseClient` with the same interface as the real one, so the entire app (UI,
  polling, DB, evidence pipeline) was built and verified end-to-end at zero cost, matching real field
  names/shapes I'd already confirmed by calibration-testing the real API on a cheap page. Real spend
  only went toward calibration and the two actual scenario runs.

- **Soft stop, not a hard cancel.** The Browser Use v4 API doesn't document a cancel endpoint, so
  Stop marks the run `cancelled` in our own DB; `advanceRun()` checks for that before doing any
  further work, so the next tick (≤2s later) stops polling and the UI settles — Browser Use's side
  keeps running to completion, but the app no longer reflects it.

---

## What's fragile / what I'd do next

See [NEXT.md](./NEXT.md).
