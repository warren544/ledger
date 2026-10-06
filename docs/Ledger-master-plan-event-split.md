# `# Ledger: master plan` 

```
Hackathon build for Warren Chan. Revised Oct 6, 2026 for event-built demo
eligibility. This is the working doc and the thing to paste into Codex.
Full detail lives in `docs/build-plan.md` (base plan, "BP") and `docs/hardening-
addendum.md` ("HA"). Section numbers below point there. This revision controls
timing and scope where the earlier plans conflict. Source prompts need the phase
restrictions below; do not execute their original full scope before the event.
```

# `## 1. Executive summary` 

```
**What it is.** Ledger is a billing-exception agent that learns without
loosening its controls. One loop: find a billing exception, show the evidence,
take a human correction, propose a scoped rule, get separate approval (gated by
a frozen regression eval), re-audit new cases, show exactly what changed. It is
a self-tightening harness, not an autonomous accountant. Human decisions improve
memory; only an approved, tested rule changes executable policy. It can never
write to a ledger, send email, or pay.
```

```
**Winning moment.** A judge watches a false flag become a precise, versioned
exception. A new legitimate split invoice stops being flagged, the real
duplicate from the same customer is still caught, and an attempted accounting
write is blocked. The memory, rule version, evidence and block are all on
screen. Two added beats: a too-broad rule fails the eval gate (Approve
disabled), and a prompt-injection email changes nothing.
```

```
**Thesis: recursion with a ratchet.** The agent evolves its rules, memory and
context policy. It never evolves tool access or safety controls. Every change is
proposed by the agent, verified on a frozen regression set, approved by a
separate human, and recorded in a hash-chained log.
```

```
**Statement 1, Recursive Harnessing.** Ledger updates its own rules (closed
DSL), context policy (immutable memory snapshots per epoch) and guardrails
(tighten only). Tool access is deliberately frozen. That is the stance, not a
gap.
```

```
**Statement 2, Long Horizon Engineering.** Coherence comes from memory
architecture (episodic, semantic, working context, consolidation, vector
precedent retrieval, versioned epochs), not context size. Hard metric signals: a
frozen holdout, computed counts, eval history, and thresholds that fail CI.
```

```
**Stack.** Next.js App Router + TypeScript + Tailwind on Vercel; MongoDB Atlas
(official Node driver, Vector Search, change streams); OpenAI SDK (structured
outputs + `text-embedding-3-small` at 1536 dims); Zod; Vitest + fast-check;
Playwright (one smoke); one Windows `tsx` worker; GitHub Actions CI. No
RAG/agent framework, no ORM, no OCR, all data synthetic.
```

```
**Event-day core.** Duplicate versus approved split; evidence viewer;
correction; scoped rule proposal; eval-gated separate approval; policy version;
explicit re-audit; real Atlas memory/retrieval; concise trace; audit chain;
injection and blocked-write proof. All are targets, not implemented or measured
results.
```

```
- Stretch: wrong-rate and missing-surcharge checks, automatic change-stream
rechecks, time-skip/history UI, full explanation view, charts, cost panel, broad
retrieval, polished rollback UI.
- Never: OCR/PDF, email integrations, real accounting writes, multi-tenant UI,
workflow builder, multi-agent, auto code patches, fine-tuning.
```

```
## 2. Build steps: maximize prep, preserve event-built credit
```

# `### Rule and boundary` 

```
Warren relayed this organizer rule: "Your demo must only highlight the specific
features, code, and functionality that your team built during the hackathon.
Judges must be able to clearly identify what was created during the event."
```

```
**Invisible does not mean eligible.** A new Sunday UI over a finished prebuilt
audit/learning engine does not make that engine event-built. A tag proves the
boundary, not eligibility. Disclose the foundation and highlight only the event-
created delta. The quote is the basis of this revision; the full official rules,
event hours, submission cutoff and organizer interpretation have not been
independently verified.
```

```
**Open organizer question:** "We plan to bring a disclosed Next.js/Atlas
scaffold, schemas, synthetic fixtures, CI, generic eval/worker plumbing, and
policy/hash-chain utilities. May our demo show new event-built audit and
approval workflows that reuse those utilities, provided we identify the prebuilt
parts and highlight only the event-created functionality? Are domain-specific
prebuilt audit or rule-evaluation libraries allowed in that demonstration?"
```

```
Until clarified, leave the domain checks, prompts, executable DSL semantics,
approval workflow and integrated product unbuilt. Prebuild reusable mechanics,
not the winning moment. If organizers disallow reuse in demonstrated
functionality, rebuild the affected utilities during the event or narrow the
demo. Permission to bring code is not permission to claim it as event work.
```

```
### A. Prebuild: reusable foundation, no finished product
```

```
Hours are planning estimates, not promises. Run P0 once. For every source
prompt, paste the phase contract in section 2C first; review diffs and run
checks after each. Full prompt bodies remain in BP section 7 and HA section 7.
```

```
| # | Goal | Done when | Codex prompt, restricted scope | Hours | Day |
|---|---|---|---|---|---|
```

```
| A1 | Operating contract and scaffold | Private repo; source docs in `docs/`;
blank Next.js shell; env validation, access shell, doctor | P0 + P1; no audit
panels | 1.25 | Tue |
```

```
| A2 | Atlas, schemas, fixtures | DB validators, ordinary/vector indexes; seeded
synthetic records, withheld labels in evaluator-only files; CLI inspection, no
case UI | P2 infrastructure/data only | 1.5 | Tue |
```

```
| A3 | Generic utility libraries | Money/ID helpers, default-deny capability
gate, hash-chain append/verify, redaction; isolated tests; documented prebuilt
status | P3 generic helpers + P14 utilities only | 1.5 | Wed |
```

```
| A4 | Adapter connectivity | Mongo/OpenAI/embedding adapters tested on neutral
samples; vector index returns a neutral test record; no Ledger audit prompt or
orchestration | P4 adapters only | 1 | Wed |
```

```
| A5 | Worker and eval plumbing | Generic queue/leases/dedupe/checkpoint
skeleton; evaluator report schema and runner; baseline test doubles labeled; no
policy-triggered case recheck | P6 skeleton + P7 runner only | 1.5 | Thu |
| A6 | Regression and CI plumbing | Frozen fixture manifest/hash; test
execution/report transport; Actions checks wired; no rule-specific evaluator or
approval endpoint | P11 runner + P12 infrastructure | 1.5 | Fri |
```

```
| A7 | Deploy and reset utilities | Vercel blank shell and Windows worker reach
Atlas; health checks; fixture reseed/reset; fresh checkout documented | P8 + P9
reset utility only | 1 | Fri |
```

```
| A8 | Submission shells and freeze | README/security/submission templates; demo
storyboard; inventory of reused code/data; infrastructure smoke passes; freeze
tag recorded | P10 preparation only | 1 | Sat |
```

```
**Prebuild total: about 10.25 focused hours.** Tue 2.75, Wed 2.5, Thu 1.5, Fri
2.5, Sat 1. Spare prep time goes to setup reliability, synthetic edge cases, API
documentation, architecture decisions and the organizer question, not secretly
completing the demo features. No Saturday recording of the finished product: it
does not exist yet.
```

```
### B. During the hackathon: create the demonstrated behavior
```

```
Sunday is **October 11, 2026**. The earlier timetable was not verified; use the
confirmed coding start and submission cutoff. No implementation work before the
permitted start. Reserve at least the last 90 minutes for freeze, checks,
recording and submission. If a real cutoff leaves less time, reduce scope before
starting.
```

```
| # | Goal | Done when | Codex prompt, event scope | Hours |
|---|---|---|---|---|
```

```
| B1 | Establish event baseline | Rules/sponsor requirements checked; `event-
start` points to unchanged foundation; build inventory and new branch ready | P0
phase update | 0.25 |
```

```
| B2 | Audit and evidence product | Event-written duplicate/split check,
constrained audit prompt, cited findings, memory/retrieval orchestration,
durable trace, minimal queue/evidence UI work end to end | P3 domain checks + P4
orchestration + P9 minimal UI | 2 |
```

```
| B3 | Correction to scoped proposal | Correction persists episodic memory,
proposes a closed DSL rule, shows a diff; documents cannot grant approval; no
policy change on correction | P5 + P3 DSL semantics | 1.5 |
```

```
| B4 | Eval-gated separate approval | Event-written rule regression logic; too-
broad proposal fails; scoped one passes measured tests; exact rule-version
report, separate identity, stale rejection, CAS activation and rollback
primitive | P11 + P5 approval | 1.5 |
```

```
| B5 | Re-audit and measured replay | Explicit re-audit clears the legitimate
split but retains the duplicate; event-written baseline/learned comparison shows
actual counts and identical holdout hash | P6 explicit recheck + P7 product
evaluator + P9 results | 1 |
```

```
| B6 | Safety proof and concise run view | Event-integrated hash-chain records
decision/approval/block; injection verdict unchanged; forbidden write denied;
run view displays evidence, epoch and context IDs | P14 event integration + P13
minimum + P9 buttons | 1 |
```

```
| B7 | Stabilize, record and submit | Tests/CI reflect implemented scope; reset
twice; deploy; timed rehearsal; event-only demo video; all links/permissions
checked; submission receipt | P8 redeploy + P12 event tests + P10 release | 1.5
|
```

```
| B8 | Optional extension, only after core passes | Automatic epoch-triggered
durable rechecks with recovery; time-skip/history UI; richer explanation and
cost panel; extra checks only if spare | P6 full + P9/P13 polish + P3 extra
patterns | +2-3 |
```

```
**Event core: about 8.75 focused hours; full original show: about 10.75-11.75
focused hours.** Neither includes meals, briefing, mentor conversations or
interruptions. The full show is not a reliable solo one-day commitment, even
with Codex. An 11-hour venue day would not mean 11 coding hours. Plan for the
core, cut more if the actual coding window is shorter, and treat B8 as optional.
Parallel coding does not remove integration/review time.
```

```
**Progress gates.** Foundation gate (Saturday): adapters, indexes, worker/runner
shells, CI and deployment work without any completed audit/learning product.
Event gate 1 (after B2): a real cited audit works. Event gate 2 (after B4):
correction -> failed broad rule -> passed scoped rule -> separate activation
works. Event gate 3 (after B6): explicit recheck, measured replay, injection
block and chain verification work. Freeze as soon as the last gate passes; do
not delay submission for stretch work. The old M1-M6 product milestones now
occur during the event, not on prep evenings.
```

```
### C. Codex phase contract and P0-P14 routing
```

```
Paste this ahead of each original prompt, filling the phase and allowed slice:
```

```
> Phase: PREBUILD or EVENT. Implement only the named slice in this master plan.
The original prompt's broader scope is not permission to build other slices now.
```

```
PREBUILD may create reusable infrastructure, neutral adapter tests and fixtures,
but no completed Ledger audit, domain-specific DSL/rule evaluator,
correction/approval service, product UI, policy-driven recheck or product
replay. EVENT implements the demonstrated behavior and adds real integration
tests. Keep labels out of agent runtime inputs. Record reused files and
new/modified event files honestly; never manufacture commit dates or describe
prebuilt functionality as created today. Stop and flag scope conflicts rather
than following the older plan silently.
```

```
| Prompt | Before event | During event |
```

```
|---|---|---|
| P0 | Repo/agent operating contract + phase restriction | Event scope and new
decision log |
```

- `| P1 | Scaffold/auth/env only | Feature routes only if needed |` 

- `| P2 | Schemas/indexes/synthetic fixtures | Only new domain schema changes needed by event work |` 

- `| P3 | Generic helpers/default-deny library | Duplicate/split checks, DSL semantics and product policy tests |` 

- `| P4 | Neutral adapter/embedding connectivity | Real audit call, citations, retrieval and trace orchestration |` 

- `| P5 | No functional implementation | Correction, proposal, separate approval and rollback |` 

- `| P6 | Generic durable worker skeleton | Explicit recheck core; change-stream integration stretch |` 

- `| P7 | Runner/report plumbing and label isolation | Product evaluator, pinned comparison and measured counts |` 

- `| P8 | Blank shell deployment/health | Product deployment and readback |` 

- `| P9 | Fixture reset utility only | Queue/evidence/rule/results UI; time-skip polish stretch |` 

- `| P10 | Storyboard and submission templates | Real rehearsal, recording, freeze and submission |` 

- `| P11 | Regression runner/report plumbing | Domain regression gate, stale/version checks, CAS |` 

```
| P12 | Infrastructure CI | Product/contract/injection/integration/smoke tests |
```

```
| P13 | No product view | Minimum run view core; cost/detail stretch |
```

```
| P14 | Generic redaction/hash-chain utilities and attack fixture files |
Injection/forbidden-action behavior and audit-log integration |
```

```
### D. Provenance: make the delta easy to inspect
```

```
1. Saturday night: commit all actual preparation, including fixtures, tests and
templates. Run checks, inspect the diff, then `git tag -a prebuild-freeze -m
'Disclosed pre-event foundation'`. Push the branch and tag; keep secrets out.
2. At the authorized start: create `event-build` from that exact commit and tag
`event-start` before implementation. If any changes happened after Saturday,
commit and disclose them as pre-event work too; the event-start tree is the
final boundary, not an obsolete tag.
```

```
3. Commit Sunday features in small, real increments. Do not squash away
chronology or backdate commits. Preserve generated code provenance and third-
party dependency/license notes. Git history supports disclosure; it is not sole
proof of compliance.
```

```
4. Maintain `docs/event-build.md`: prebuilt inventory; event-created feature;
new/modified files; relevant commits; demo timestamp; reused dependencies. Show
`git diff --stat event-start..HEAD` and full diff for substantive behavior, not
just UI lines.
```

```
5. Tag the submitted commit `hackathon-submission`; record its hash in
README/video. Record actual measured results, not target values. Preserve the
submit receipt and confirmed cutoff.
```

```
**Today:** start A1/A2; ask organizers the question above; confirm coding
window/cutoff and sponsor requirements. Do not run P5/P13 or the unrestricted
P3/P4/P6/P7/P9/P11/P14 beforehand.
```

# `## 3. Architecture and folder structure` 

```
Target architecture (not a claim of implementation). Prebuild generic
adapters/libraries; assemble domain services, product routes and UI during the
event. Flow: Browser (queue, evidence, feedback, rules, replay, traces) ->
Next.js on Vercel (bounded API routes) -> MongoDB Atlas -> change stream -> one
Windows worker (claim jobs, fetch docs + exact active rules + vector precedents,
deterministic checks, one LLM interpretation, validate citations, policy gate,
persist trace) -> OpenAI (embeddings + structured output, no tool permissions).
A CLI-only held-out evaluator writes reports that the UI shows read-only.
```

```
```
ledger/
  AGENTS.md            # Codex guide: structure, commands, never-do list
  README.md            # architecture diagram, trust model, repo map
  docs/                # build-plan.md, hardening-addendum.md, architecture.md,
security.md, decisions.md
  src/
    core/              # PURE: audit, policy, memory, trace, Zod schemas. No
Next/Mongo/OpenAI imports
    adapters/          # all I/O: mongo/, llm/, embeddings/
    server/            # services shared by routes AND worker
    app/               # Next.js App Router pages + thin API routes
    components/        # UI by feature
    lib/               # env.ts (Zod-validated), logger, ids
  worker/              # tsx polling loop; imports src/server only
  evals/               # golden dataset, attack fixtures, harness, thresholds
(eval.config.ts)
  tests/               # integration, contract, e2e
  scripts/             # doctor, seed, verify-audit-chain, replay-demo, migrate
  .github/workflows/ci.yml
```

```
**Dependency rules (ESLint-enforced).** `core` imports nothing from `adapters`,
`server`, `app` or `worker`. `adapters` import `core` only. `server` imports
`core` + `adapters`. `app` and `worker` go through `server` and never touch
`adapters` directly. Tests are co-located in `__tests__` for pure logic; cross-
layer tests live in `tests/`. One `check` script (typecheck + lint + test +
eval) is what Codex runs and CI runs. Single package, no monorepo.
```

```
**Conventions.** One plan, one architecture doc, one decisions log (no doc
sprawl). Integers for money (USD cents). UUID string IDs everywhere. Pin Node
LTS and a lockfile. `design-desk` is a conventions reference only (it is an
unlicensed fork); do not copy its code.
```

```
**Consistency contract (HA section 3).** Idempotent mutations via request IDs +
unique indexes; job leases; CAS on policy epoch; `schemaVersion` on every doc
with a migration runner; `workspaceId` on everything with one isolation test.
```

```
## 4. Data model summary
```

```
Full TypeScript contracts: BP section 2. All docs share `_id` (UUID),
`workspaceId`, `schemaVersion`, `createdAt`. Database `ledger_demo`.
```

- `| Collection | Purpose |` 

- `|---|---|` 

- `| `records` | Synthetic invoices, rate sheets, emails, service logs; raw text + payload + provenance |` 

- `| `cases` | Audit units with status and customer/feature keys |` 

- `| `runs` | One audit execution: pinned model, snapshot, epoch, cost |` 

- `| `findings` | Issue per pattern (duplicate, wrong_rate, missing_surcharge) with` 

```
cited evidence (recordId, fieldPath, quote) |
```

```
| `decisions` | Human reviewer verdicts on findings |
```

```
| `memories` | Episodic (reviewed decisions) + semantic (consolidated), with
1536-d embeddings, grouped by immutable snapshot |
```

```
| `rules` | Scoped DSL rule: customer, pattern, serviceCode, conditions, expiry,
`testReportId` |
```

```
| `rule_sets` | Versioned policy epochs, pointer to active set (rollback = move
pointer) |
```

```
| `traces` | Span-shaped steps; IDs of context used; redacted |
```

```
| `jobs` | Durable queue with leases and dedupe keys |
```

```
| `checkpoints` | Worker/change-stream resume state |
```

```
| `evaluations` | Frozen-holdout results, per-pattern counts, dataset hash |
```

```
| `rule_eval_reports` (HA) | Regression report per exact rule version |
```

```
| `audit_log` (HA) | Hash-chained entries (prevHash, hash) for every decision,
approval, block |
```

```
Working context is not a collection; it is the bounded packet per run, and
traces record the IDs that supplied it. Atlas Vector Search index filters by
workspace, snapshot and customer.
```

```
## 5. Demo script (3 minutes) and fallback
```

```
Rehearse to 2:45 after event implementation. Start signed in and warmed; do not
pre-click the correction.
```

```
**Opening disclosure:** "We brought a disclosed Atlas/Next.js foundation,
synthetic fixtures and reusable utilities. During this event we built the audit,
correction-to-rule and eval-gated approval workflow you will see. The README
separates that work from the foundation."
```

```
Use that line only if the event-build inventory supports it. Never say
"everything you see was built today." Do not feature prebuilt libraries as event
achievements. Organizer clarification governs whether the new workflow may
demonstrate reused core logic at all.
```

```
| Time | Action | Line / proof |
```

```
|---|---|---|
```

```
| 0:00-0:20 | Disclosure + queue/evidence for DEMO-A | Opening line above, then
"Agents repeat mistakes because corrections live in chat. Ledger turns a
correction into a scoped, testable policy." |
```

```
| 0:20-0:45 | Run audit live | Candidate duplicate, cited evidence, precedent
IDs, live trace |
```

```
| 0:45-1:05 | Reject the false positive | Episodic memory appears with reviewer
decision |
```

```
| 1:05-1:30 | Rule diff + eval gate | **Beat 1:** try approving the too-broad
rule; Approve disabled with the actual failing case and reason. Approve the
scoped rule only if its actual report passes; show measured count and recall.
Separate approver activates epoch N+1 |
```

```
| 1:30-1:55 | Recheck DEMO-B/C | B clears, C stays flagged; explicit re-audit
and rule version shown. Show change-stream jobs only if B8 shipped |
```

```
| 1:55-2:20 | Metrics tab | Reproducible synthetic replay, same holdout hash,
actual baseline vs learned counts |
```

```
| 2:20-2:40 | Forbidden write + injection | Gate blocks `ledger.write`
(invariant, not model choice). **Beat 2:** run the injection email; verdict
unchanged. "Documents are evidence, never instructions." |
```

```
| 2:40-3:00 | Atlas panel | "MongoDB stores evidence and memory, retrieves
precedent, versions policy, drives rechecks. The agent improves; its permissions
don't expand." |
```

```
**Core pacing:** keep metrics to a single result row and run view to evidence +
epoch + context IDs. Time-skip animation, history charts and automatic rechecks
are stretch, not required demo beats.
```

```
**Q&A reserve.** Run `verify-audit-chain` live; open `/runs/[runId]` on any
finding a judge points at. Roadmap slide (HA section 10): identity/SSO, per-
tenant clusters, CSFLE, scheduled evals + auto-rollback, OTel export, SOC 2
mapping. Build none of it.
```

```
**Live vs labeled.** Live: Atlas reads/writes, vector retrieval, one agent call,
feedback, proposal/approval, policy enforcement; change-triggered jobs only if
completed in B8. Labeled: synthetic data, simulated history, saved eval runs,
recorded proposals ("Recorded proposal from run X"). Never leave "Atlas Vector
Search" green over a mocked query.
```

```
**Fallback order.** Vercel UI + live Atlas, then local Next.js + live Atlas,
then read-only trace/eval replay, then labeled recording. If Atlas is down,
disable mutations rather than fake persistence. Saturday may produce an
infrastructure recovery recording only, not a judging fallback. Record the
actual event-built product during Sunday; first frame reads "Recorded demo using
synthetic data; captured [timestamp], commit [hash]." No secrets on screen.
```

```
**Key Q&A answers (BP 9, HA 9).** Not fine-tuning: same model, different
approved snapshots. Agent proposes only inside a fixed DSL; the safety layer is
immutable. Could it move money? No, writes are blocked by the gate. Scale: one
worker today; leases and isolation tests make N workers safe; rest is roadmap.
Is it tested? Show the Actions tab.
```

```
## 6. Submission package checklist
```

```
- [ ] **README** with architecture diagram, trust model (propose / verify /
approve / record), repo map, trace taxonomy, how to run, honest live-vs-replay
table
```

- `[ ] **Challenge-statements section** (section 7 below) in README and submission form` 

- `[ ] **Eval report**: baseline vs learned on frozen holdout, per-pattern breakdown, dataset hash, thresholds; nulls shown as null` 

- `[ ] **Security page** (`docs/security.md`): injection fixtures and results, allowlist, secrets handling, propose/approve separation, audit chain and how to verify` 

```
- [ ] **CI badge / Actions run** green on the submitted commit
```

```
- [ ] **Demo video** (3 min, subtitled) plus fallback recording
```

```
- [ ] **Roadmap slide** (enterprise seams, nothing built)
```

- `[ ] **Landing page / deployed URL** (Vercel) with synthetic-data banner and a judge login path` 

```
- [ ] **License note**: choose a license for Ledger; state that all data is
synthetic; do not copy code from the unlicensed `design-desk` fork; list third-
party deps
```

```
- [ ] **Prebuilt disclosure**: `docs/event-build.md`, `prebuild-freeze` and
`event-start` hashes, event feature/file/commit map, organizer clarification if
obtained; honest repo history and team declaration
```

```
- [ ] **Claim audit**: every highlighted feature is event-created and every
result is actually measured; remove unfinished stretch claims from
README/video/submission
```

```
- [ ] Final checks: repo access works for judges, links open logged out, no
secrets in history (gitleaks), fresh Windows checkout builds with documented
commands
```

```
Release checklist from BP section 10 also applies: validators and vector index
exist and return expected memory; mutations need reviewer access; feedback and
approval separate and idempotent; stale/expired rules never apply; restart does
not duplicate results; reset works twice.
```

# `## 7. How Ledger answers the challenge statements` 

```
**Submission-use gate:** this is target language, not proof of a finished
system. Before pasting it into a submission, keep only implemented, measured,
eligible features. If B8 is cut, replace change-stream claims with explicit
version-pinned re-audit and omit checkpoint/restart claims not tested. If counts
differ, use the actual report, not 20/20 as a promised outcome. Separate the
disclosed prebuilt foundation from the event-created learning workflow.
```

```
**Thesis: recursion with a ratchet.** Both statements ask how a harness improves
itself over long horizons without drifting out of control. Ledger's answer:
self-improvement compounds only when every change is ratcheted. The agent
proposes, a frozen regression gate verifies, a separate human approves, and a
tamper-evident log records it. The agent evolves its rules, memory and context
policy continuously. It can never evolve its tool access or safety controls.
Each accepted change is versioned, measured and reversible.
```

# `### Statement 1: Recursive Harnessing` 

```
Ledger evolves its own harness along the axes the statement names, with one
deliberate exception. **Rules:** a reviewer's correction writes an episodic
memory; the agent proposes a scoped rule inside a closed, server-side DSL. It
can fill in title and explanation, never invent a new effect or operator.
**Context policy:** approved rules and reviewed decisions form a new immutable
memory snapshot (epoch N+1) that precedent retrieval reads; old runs keep their
exact retrieved IDs. **Guardrails:** they only tighten, never loosen. Tool
access never expands: `ledger.write`, `email.send` and `payment.execute` sit
behind an immutable allowlist that no learned rule, model output or retrieved
document can weaken. Documents are evidence, never instructions, enforced by the
backend rather than by prompt wording. Every proposed rule runs a 20-case
regression set before Approve enables; approval needs a passing eval report no
older than the rule version, a second identity (proposer cannot approve), and a
compare-and-swap on the policy epoch. Activation fires a change stream that
durably re-audits every affected open case.
```

```
**Demo beat:** a too-broad rule ("suppress duplicates for this customer,
period") fails the gate because one true duplicate would clear. If the scoped
rule passes the actual frozen 20-case report, epoch N+1 activates, the
legitimate split invoice clears, and the true duplicate stays flagged.
```

# `### Statement 2: Long Horizon Engineering` 

```
Ledger does not claim billions of tokens in one context window, and we argue
that is the wrong axis. Long-horizon coherence comes from memory architecture.
Each run gets a bounded working-context packet. Durable knowledge lives in
episodic memory (every reviewed decision, embedded and retrieved by Atlas Vector
Search as precedent) and semantic memory (approved rules, consolidated from
episodes). Memory is organized in immutable snapshots tied to policy epochs, so
a run weeks later retrieves the same precedents a run today would, and any past
run is replayable from its recorded IDs. The change stream carries work across
time: a policy change durably re-audits open cases, with leases and checkpoints
that survive worker restarts. **Hard metric signals:** a frozen holdout, same
model, same inputs, computed TP/FP/FN/TN per pattern, eval history, and
thresholds (recall may not drop, false positives may not rise, unsafe actions
stay blocked) that fail CI. A change that does not improve or preserve the
metrics is not admitted. Optimization toward the long-term goal is a ratchet on
those numbers, not a hope.
```

```
**Demo beat:** open the metrics tab: baseline vs learned on the identical
holdout hash with computed counts, then show `/runs/[runId]` for a recheck
weeks-later-style case with its snapshot ID and retrieved precedent IDs, and run
`verify-audit-chain`.
```

```
## 8. Risk and cut list
```

```
**If prep slips:** protect Atlas/index connectivity, schemas/fixtures, blank
deploy, generic runner and CI. Cut helper polish and property tests first. Do
not compensate by building the event product early.
```

```
**If event time slips, cut in this order:** cost/history charts, keyboard
shortcuts, animation and time-skip polish; wrong-rate/missing-surcharge checks
and broad retrieval; automatic change-stream rechecks (use an explicit event-
built re-audit); full `/runs` page (keep a compact real trace); polished
rollback UI (retain a tested rollback primitive). Keep measured counts in a
plain table instead of an elaborate metrics tab. Reduce fixture breadth only
before freezing a new declared test set, never after seeing failures.
```

```
**Protected core:** correction -> scoped proposal -> version-matched eval gate
-> separate approval; split clears/duplicate remains; real persisted
evidence/memory; blocked forbidden action; injection proof; hash-chain
integration and verification. Do not weaken approvals, label isolation or fail-
closed behavior to save time. If even that core will not fit, ship a smaller
honestly described workflow and ask organizers about eligible scope, rather than
claiming the full plan works.
```

```
**No Saturday product fallback.** If automatic rechecks are incomplete, demo
explicit re-audit and say so. A fallback video/replay for judging must
demonstrate eligible event-built functionality and obey the event's recording
rules; a pre-event foundation video is not a substitute.
```

```
| Risk | Prevention | Honest fallback |
```

```
|---|---|---|
```

```
| LLM slow/down | Pre-embedded history; one short structured call; ~12s
deadline; one retry | Deterministic checks live; earlier explanation labeled
replay |
```

```
| Venue Wi-Fi / Atlas unreachable | Test on arrival; local app + video ready |
Read-only replay; no fake mutations |
```

```
| Vector index lagging | Create Tuesday; health check before each rehearsal |
Label `exact_fallback`; show recorded real vector run |
```

```
| Atlas/network access mismatch | Test Vercel and Windows connectivity early |
Local UI with same Atlas |
```

```
| Worker asleep/disconnected | Plug in, disable sleep, heartbeat, restart
script, lease recovery | Explicit re-audit route or recorded recheck |
```

```
| Vercel timeout/cold start | Bounded routes enqueue jobs; warm routes | Local
Next.js |
```

```
| Bad rule hides a real issue | Closed DSL, exact scope, eval gate, separate
approver, expiry | Keep rule proposed; show the failing counterexample as safety
working |
```

```
| No metric improvement | Deterministic generator; event-day held-out evaluation
| Show preserved recall and auditable correction; no unsupported accuracy claim
|
| Double clicks / retries | Request IDs, unique indexes, leases | Return
existing outcome |
```

```
| Reset polluted by old job | Reset generation + stale-result guard | Fresh demo
workspace |
```

```
| Reviewer session expires | Rehearse login; warm session | Re-authenticate;
never weaken security |
```

```
| Sponsor requirement differs | Confirm early; adapter seam; tagged baseline |
Keep stack unless mandatory; disclose |
```

```
**Minimum viable event-built demo (target, not achieved):** disclosed prebuilt
synthetic fixture data, new event-written workflow; five fixture cases;
duplicate check; real Atlas episodic memory and vector retrieval; one scoped
rule; eval-gated separate human activation; split clears, duplicate stays
flagged; forbidden write blocked; concise trace.
```

