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
