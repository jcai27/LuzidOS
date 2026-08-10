# Luzid Take Home Assignment

**Role:** Software Engineer  
**Time box:** ~ 3 hours  
**Deliverable:** A working web app + demo (local is fine)

## The Challenge

Build a web application that lets a user launch and monitor AI browser agents against an SAP environment, using the Browser Use API. The app should support two agent workflows:

1. Configuration Agent — applies a configuration change in SAP
2. Unit Test Agent — executes a single test case and reports pass/fail with evidence

In both cases the input should be an excel spreadsheet.

We deliberately left the product design open. How you structure the UX, what you abstract, and where you go beyond the spec is a big part of what we're evaluating.

## What We Provide

URL to a shared SAP sandbox environment + login credentials

**URL:** https://my433731.s4hana.cloud.sap/ui?sap-client=100

**Credentials:**

andres@luzidos.com  
Luzid2DMoon!

A Browser Use API key

Sample inputs for each scenario (below)

**Browser use API Key**

bu_ylSYfq29l5ll6U5Pyoz2aYBP4WxJE-hwHbBUHUfLI5o

## Concrete Scenarios

### Scenario 1 — Configuration

Change the default date format (or another user profile setting) for the provided user via the SAP settings screen, and verify the change took effect.

### Scenario 2 — Unit Test

Given this test case as input:

**Steps:** Log in → navigate to the sales order creation screen → create a sales order with the provided sample values → submit

**Expected result:** SAP returns an order number confirmation

Your agent executes it and reports PASS/FAIL with screenshot evidence.

## Requirements

### Must have

- Web UI to configure, launch, and monitor each of the two agents
- Live visibility into a running agent (Browser Use live view, streamed steps, or screenshots)
- Structured results per run (status, outputs, errors, evidence)
- Basic error handling: agent failure, SAP popups, timeouts — the app shouldn't just hang

### Nice to have (this is where "depth" points live)

- Run history / persistence
- Shared abstractions across agents (hint: two of these workflows are structurally similar)
- Retry / stop controls
- Cost or step tracking per run
- Anything else you think a real user of this product would want

## Deliverables

1. **README:** setup instructions (`env` vars for creds/keys), architecture overview (a paragraph and/or diagram), key decisions
2. **Demo video:** E2E run of all two agents, narrated
3. **"What I'd do next" writeup (≤ 1 page):** what you'd build with another week, what you'd change, what's fragile

## Constraints & Ground Rules

- **AI tooling is encouraged.** Use Cursor, Claude, Copilot, whatever — we're testing how fast you can ship real product with modern tools. Just be able to explain every line in the follow-up interview.
- **Shared sandbox:** namespace your data, don't delete others' records, don't change global settings beyond Scenario 1's scope.
- Any stack you like. Local-only is fine; no deployment required.

## How We Evaluate

| Area | What we look for |
|---|---|
| **Functionality** | Each agent completes its scenario E2E; robustness to SAP UI weirdness (popups, session timeouts, slow loads) |
| **UX & product thinking** | Sensible launch flow, live agent visibility, useful error states, results a real user could act on |
| **Depth** | Abstractions, evidence artifacts, run history, cost awareness, going beyond the spec in ways that make sense |
| **Decisions & trade-offs** | What key decisions did you make throughout the development? |

We'd rather see 3 scenarios working well with a thoughtful product around them than 4 scenarios duct-taped together.
