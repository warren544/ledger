# Ledger

Ledger is a synthetic-data billing-exception demo. This checkout currently contains only the disclosed prebuild foundation described in `docs/event-build.md`.

## Phase boundary

This is **PREBUILD** work. It intentionally does not contain the event-only audit, domain checks, correction flow, rule DSL, approval service, policy recheck, or product UI. Those remain unimplemented until the authorized event start.

## Commands

```text
npm install
npm run doctor
npm run inspect-fixtures
npm run check
```

No secrets are required for the local foundation checks. All fixture data is synthetic.

## Repository map

`src/core` contains pure schemas and generic utilities; `src/adapters` contains injected Mongo/OpenAI seams; `src/server` contains generic orchestration; `src/app` is the blank Next shell; `worker` is the neutral worker entry point; `scripts` contains explicit CLI operations; `evals/fixtures` contains frozen generated neutral data; `tests` and `src/core/**/__tests__` contain contract tests; `docs` contains scope and decision records.

## Fresh Windows setup

Use the exact runtime recorded in `.nvmrc` (`22.23.3`), then run:

```powershell
Set-Location 'C:\Users\chanw\ledger'
node --version
npm ci
npm run check
npm run build
```

The local check is credential-free and includes typecheck, boundary lint, the full 75-test suite, frozen fixture verification, generic eval plumbing, and the frozen 20-case baseline evaluator. `npm run reset-fixtures` regenerates the canonical files from the deterministic recipe; `npm run inspect-fixtures` validates them; `npm run verify-fixtures` compares them with the checked-in manifest and never refreshes it.

`npm run eval:smoke` writes an ignored generic report under `evals/reports`. Its implementation is explicitly a prebuild test double and its domain metrics remain null; it is not an accuracy result.

## Optional live checks

Keep real values only in an ignored `.env.local`; `.env.example` contains placeholders. Mongo setup/smoke requires an explicitly confirmed synthetic namespace and mutates only its own uniquely named test data, with cleanup in `finally`. The adapter smoke requires `--live --confirm-api-cost`, makes one tiny structured-output call and one tiny embedding call, requires the declared Atlas vector index, and removes only its own data. Missing configuration, permissions, index readiness, or hosted access leaves the corresponding live result unverified. `npm run worker:dry` uses labeled in-memory storage and is not proof of durable Mongo concurrency.

## Scope and future transition

The current boundary is PREBUILD: no audit findings, duplicate/split checks, domain rule DSL, correction/approval flow, policy recheck, product evaluator/replay, Sunday demo, or finished UI exists. Hosted GitHub Actions status is unknown; the workflow file is only locally syntax-checked.

Future freeze/event-start commands are review instructions only and must be run after Warren confirms timing and reviews the exact state:

```powershell
git tag prebuild-freeze
git switch -c event-build
git tag event-start
```

They have not been run and do not establish eligibility. The organizer clarification remains unresolved.

## Environment contract

`NODE_ENV` defaults to `development` and accepts only `development`, `test`, or `production`; empty, whitespace-only, and surrounding-whitespace values are rejected. `LEDGER_WORKSPACE_ID` defaults to `demo` and must be a nonempty identifier using letters, numbers, `_`, or `-`.

Blank `MONGODB_URI` and `OPENAI_API_KEY` values are treated as absent. Nonempty values may not have surrounding whitespace. MongoDB URIs are syntax-checked against the documented `mongodb://` and `mongodb+srv://` forms, including host, port, and SRV restrictions. Validation does not prove DNS, network reachability, authentication, or service availability. The doctor reports configuration presence separately from connectivity, and never attempts a connection.
