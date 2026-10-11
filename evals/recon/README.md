# Reconciliation evaluation sets

Each pack directory contains a deterministic 30-case labeled regression set in
`fixtures.json`, a separate 20-case labeled holdout in `cases.json`, and a
`manifest.json` locking both hashes. Runtime evaluation passes only `records`
to the engine; `expectedFindings` remains evaluator-side data.

The holdouts are generated from a separate deterministic partition before the
Step 2 checks and are never regenerated or tuned in response to results. The
manifest is updated only by an intentional reviewed fixture change.
