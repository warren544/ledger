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

## Environment contract

`NODE_ENV` defaults to `development` and accepts only `development`, `test`, or `production`; empty, whitespace-only, and surrounding-whitespace values are rejected. `LEDGER_WORKSPACE_ID` defaults to `demo` and must be a nonempty identifier using letters, numbers, `_`, or `-`.

Blank `MONGODB_URI` and `OPENAI_API_KEY` values are treated as absent. Nonempty values may not have surrounding whitespace. MongoDB URIs are syntax-checked against the documented `mongodb://` and `mongodb+srv://` forms, including host, port, and SRV restrictions. Validation does not prove DNS, network reachability, authentication, or service availability. The doctor reports configuration presence separately from connectivity, and never attempts a connection.
