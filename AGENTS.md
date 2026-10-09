# Ledger development workflow

- This repository is PREBUILD foundation work. Keep changes generic and truthful; do not add event-only audit behavior, domain rules, correction/approval, replay/recheck, product UI, deployment, or eligibility claims without an explicit scope change.
- Preserve the layer boundary: core is pure; adapters may use core; server may use core/adapters; app and worker use server rather than adapters directly. Tests and narrowly documented configuration checks are the only exceptions.
- Use PowerShell from `C:\Users\chanw\ledger`. The normal credential-free commands are `npm ci`, `npm run check`, `npm run build`, `npm run inspect-fixtures`, and `npm run verify-fixtures`.
- Keep secrets outside tracked files. Live Mongo/OpenAI commands are opt-in, cost/mutation bounded, and must never print credentials or full connection strings.
- If a requested change conflicts with this boundary or the plan, stop and report the conflict before editing. Do not silently broaden scope, deploy, push, tag, or manufacture evidence.
