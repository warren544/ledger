# Evaluation baseline

Date: 2026-10-09

## Status

The labeled 20-case frozen holdout evaluator is now isolated under `evals/holdout/`. Its labels are evaluator-only and are not imported by runtime fixture readers or the neutral implementation. The baseline rule was fixed before this run: classify a pair as duplicate only when customer, vendor, date, amount, currency, and service code match exactly; document number is excluded from the fingerprint.

The repository command used for this evaluation was:

```text
npm run eval:holdout
```

The evaluated source commit was:

```text
3da1b907595286efcd0f409782e0ae2c8255b321
```

The frozen dataset hash was `c281b448bbd59a9356ca9d9b42693a23936ece21cb2b7ebd1fda39794ea569cc`.

All 20 cases ran successfully. No case metric was nulled.

## Results

```json
{
  "precision": 0.8,
  "recall": 0.8,
  "confusion": { "tp": 8, "fp": 2, "fn": 2, "tn": 8 }
}
```

The results are the baseline evaluator’s measured output on this exact frozen holdout. They are not a claim about a learned model or a production audit system.

## Non-runnable-case policy

If any case cannot run, the evaluator sets precision, recall, and every confusion count to `null` and records the case error plus an aggregate `metricError`. It never infers missing outcomes.

These are the only baseline precision, recall, and confusion numbers currently authorized for the demo.
