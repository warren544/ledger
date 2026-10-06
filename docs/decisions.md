# Decisions

## 2026-10-06 — prebuild scope

Implement only reusable mechanics and neutral synthetic data before the event. Keep Ledger’s demonstrated behavior unbuilt so the event-created delta is inspectable and honestly disclosed.

## 2026-10-06 — A1 runtime and test toolchain

Pin Node.js to 22.23.3, verified available from the official Windows distribution. Use the patched Next.js 15.5.27 release with React and React DOM 19.1.1; Next accepts Node 20 and newer, and the React peer versions match. Retain `node:test` executed through `tsx`; the test script uses the quoted `tests/**/*.test.ts` glob so root-level tests are discovered on Windows.

## 2026-10-06 — environment validation contract

Keep `readEnv(input)` pure and credential-free. Optional blank MongoDB/OpenAI values become `undefined`; nonempty values with surrounding whitespace are rejected without echoing secrets. MongoDB validation follows the official standard and SRV connection-string forms: only `mongodb://` and `mongodb+srv://`, valid host/port structure, and SRV’s single DNS host with no port and at least three labels. This is syntax validation only; it performs no DNS lookup or connection attempt and does not prove reachability.

## 2026-10-06 — frozen neutral fixture identity

Use a fixed seed, reference timestamp, generator version, deterministic UUID derivation, strict Zod schemas, and a manifest hash over the ordered validated record array. Runtime fixtures remain neutral and unlabeled; fixture verification compares against the checked-in manifest and never updates it automatically. Intentional fixture changes require an explicit reviewed generator/manifest change.

## 2026-10-06 — pure money and ID helpers

Money is represented as safe integer USD cents. Decimal parsing accepts an optional `$`, an optional leading minus, and at most two fractional digits; it rejects whitespace, grouping, exponent notation, alternate signs, fractional cents, and overflow without rounding. Formatting is deterministic and non-grouped (`-$12.34`), and arithmetic checks output bounds. IDs are validated UUID strings, with a per-generator injectable source for tests and no global counters. The test command explicitly discovers both root tests and co-located core tests with `node:test` and `tsx`.

## 2026-10-06 — generic hash-chain utility

Use version-1 entries whose SHA-256 input frames the version, entry index, previous hash, and recursively canonical JSON payload. The documented genesis is 64 zeroes; empty chains verify with that head and count zero. Append returns new arrays and cloned payloads without mutating inputs. Verification recomputes links and hashes and reports only a failure index and structural reason. An unkeyed chain is tamper-evident relative to a separately trusted head/count, not a signature: without those anchors, truncation or whole-chain replacement cannot be detected.

## 2026-10-06 — immutable generic capability gate

The generic capability gate is constructed once from a trusted, copied allowlist using exact lowercase dotted names such as `sample.read`. It fails closed for absent, malformed, wrong-case, whitespace-altered, and unknown names, returns typed decisions only, and exposes no grant/update, callback, tool-execution, model-text, document-content, or label-driven API. This is a reusable boundary primitive, not Ledger policy or product capability wiring.

## 2026-10-06 — bounded generic redaction

Use `redact(value, options)` for structured diagnostics only. Exact sensitive-key masking and caller-supplied nonempty secret replacement are the reliable contract; conservative Mongo credential and Authorization regexes are best effort, not universal PII/secret removal. Traversal is bounded by depth and entries, preserves safe structure without mutation, and replaces cycles, errors, unsupported values, and limits with explicit markers without stringifying raw values. The utility is pure and does not alter global logging behavior.
