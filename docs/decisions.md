# Decisions

## 2026-10-06 — prebuild scope

Implement only reusable mechanics and neutral synthetic data before the event. Keep Ledger’s demonstrated behavior unbuilt so the event-created delta is inspectable and honestly disclosed.

## 2026-10-06 — A1 runtime and test toolchain

Pin Node.js to 22.23.3, verified available from the official Windows distribution. Use the patched Next.js 15.5.27 release with React and React DOM 19.1.1; Next accepts Node 20 and newer, and the React peer versions match. Retain `node:test` executed through `tsx`; the test script uses the quoted `tests/**/*.test.ts` glob so root-level tests are discovered on Windows.
