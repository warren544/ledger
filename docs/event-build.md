# Event-build provenance

## Prebuilt foundation

Created during the prebuild phase: repository shell, exact Node 22.23.3 runtime pin, Next App Router shell, environment contract, neutral record schemas, synthetic fixture manifest, fixture inspection/reset scripts, and phase-boundary documentation.

## Explicitly not prebuilt

Audit panels, duplicate/split domain checks, prompts, executable policy/DSL semantics, correction-to-rule behavior, approval workflow, product evaluator, policy-driven rechecks, and product UI are intentionally absent.

## Event boundary

Before implementation begins, record the actual foundation commit as `prebuild-freeze`, create `event-build` from that exact state, and record the event-start commit as `event-start`. Do not backdate commits or claim prebuilt functionality as event-created.

## Reused dependencies

The foundation uses Node.js, TypeScript, and the standard Node test runner. Dependency versions and licenses must be reviewed before release.
