import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { parseUuid } from "../../core/ids.js";
import { billingRecordSchema } from "../../core/recon/packs/billing.js";
import { transportRecordSchema } from "../../core/recon/packs/transport.js";
import { reconCaseStatusSchema, reconPackSchema, type ReconCase, type ReconPack } from "../../core/recon/record-types.js";
import { exceptionSchema, transitionException, type ReconException } from "../../core/recon/exception.js";
import { runReconCase } from "./engine.js";
import { requireCapability, type ReconActor } from "./auth.js";
import { draftException, dispositionSchema, type DraftDependencies, type DraftResult } from "./drafter.js";
import type { ReconCorrection, ReconRepository } from "./repository.js";

const packRecords = { transport: transportRecordSchema, billing: billingRecordSchema } as const;
const bodyRecordLimit = 500;

function caseId(workspaceId: string, pack: ReconPack, key: string) {
  const digest = createHash("sha256").update(`ledger-recon-case:v2\\0${workspaceId}\\0${pack}\\0${key}`, "utf8").digest("hex").slice(0, 32).split("");
  digest[12] = "5";
  digest[16] = ((Number.parseInt(digest[16], 16) & 3) | 8).toString(16);
  return parseUuid(`${digest.slice(0, 8).join("")}-${digest.slice(8, 12).join("")}-${digest.slice(12, 16).join("")}-${digest.slice(16, 20).join("")}-${digest.slice(20).join("")}`);
}

function links(record: Record<string, unknown>): string[] {
  return Object.entries(record).filter(([key, value]) => key !== "recordId" && typeof value === "string" && (key.endsWith("Id") || key === "stopId" || key === "customerId" || key === "manifestId")).map(([, value]) => value as string);
}

function groupRecords(records: readonly Record<string, unknown>[]): readonly { readonly key: string; readonly records: readonly Record<string, unknown>[] }[] {
  const groups: Array<{ key: string; records: Record<string, unknown>[]; linkValues: Set<string> }> = [];
  for (const record of records) {
    const values = new Set(links(record));
    const group = groups.find((candidate) => [...values].some((value) => candidate.linkValues.has(value)));
    if (group) { group.records.push(record); for (const value of values) group.linkValues.add(value); }
    else groups.push({ key: [...values].sort()[0] ?? String(record.recordId), records: [record], linkValues: values });
  }
  return groups.map(({ key, records: grouped }) => ({ key, records: grouped }));
}

export interface IngestResult { readonly caseIds: readonly string[]; readonly recordCount: number }
export interface RunResult { readonly caseId: string; readonly status: "clean" | "excepted"; readonly findingCount: number }

export const correctionInputSchema = z.object({
  exceptionId: z.string().uuid(),
  disposition: dispositionSchema,
  notes: z.string().max(4000)
}).strict();

export interface CorrectionResult { readonly correctionId: string; readonly exceptionId: string; readonly state: "corrected" }

export function createReconService(repository: ReconRepository, clock: () => string = () => new Date().toISOString()) {
  return {
    async ingest(actor: ReconActor, packInput: unknown, input: unknown): Promise<IngestResult> {
      requireCapability(actor, "records.ingest");
      const pack = reconPackSchema.parse(packInput);
      if (!Array.isArray(input) || input.length < 1 || input.length > bodyRecordLimit) throw new Error("records must be a nonempty array of at most 500 items");
      const records = packRecords[pack].array().parse(input) as readonly Record<string, unknown>[];
      if (records.some((record) => record.workspaceId !== actor.workspaceId)) throw new Error("workspace isolation violation");
      const groups = groupRecords(records);
      const cases: ReconCase[] = [];
      for (const group of groups) {
        const currentCase: ReconCase = { caseId: caseId(actor.workspaceId, pack, group.key), workspaceId: actor.workspaceId, pack, key: group.key, recordIds: group.records.map((record) => parseUuid(String(record.recordId))), status: "open" };
        cases.push(currentCase);
        for (const record of group.records) await repository.upsertRecord({ ...record, pack, key: group.key, createdAt: record.recordedAt });
        await repository.upsertCase(currentCase);
        await repository.appendEvent({ workspaceId: actor.workspaceId, actorId: actor.actorId, subjectId: currentCase.caseId, type: "records.ingested", payload: { pack, recordIds: currentCase.recordIds } });
      }
      return { caseIds: cases.map((value) => value.caseId), recordCount: records.length };
    },
    async run(actor: ReconActor, caseIdInput: string): Promise<RunResult> {
      requireCapability(actor, "case.run");
      const currentCase = await repository.getCase(actor.workspaceId, parseUuid(caseIdInput));
      if (!currentCase) throw new Error("case not found");
      const records = await repository.getRecords(actor.workspaceId, currentCase.recordIds);
      const result = runReconCase({ caseId: currentCase.caseId, pack: currentCase.pack, records });
      const updated: ReconCase = { ...currentCase, status: result.status };
      await repository.updateCase(updated);
      await repository.appendEvent({ workspaceId: actor.workspaceId, actorId: actor.actorId, subjectId: currentCase.caseId, type: "case.run", payload: { pack: currentCase.pack, status: result.status, findingCount: result.findings.length } });
      for (const finding of result.findings) {
        const exception: ReconException = exceptionSchema.parse({ exceptionId: finding.findingId, workspaceId: actor.workspaceId, caseId: currentCase.caseId, code: finding.code, severity: finding.severity, state: "open", evidence: finding.evidence, variance: finding.variance, createdAt: clock(), updatedAt: clock() });
        await repository.insertException(exception);
        await repository.appendEvent({ workspaceId: actor.workspaceId, actorId: actor.actorId, subjectId: exception.exceptionId, type: "exception.created", payload: { caseId: currentCase.caseId, code: finding.code } });
      }
      return { caseId: currentCase.caseId, status: result.status, findingCount: result.findings.length };
    },
    async list(actor: ReconActor, pack?: string, status?: string) { requireCapability(actor, "records.read"); return repository.listCases(actor.workspaceId, pack === undefined ? undefined : reconPackSchema.parse(pack), status === undefined ? undefined : reconCaseStatusSchema.parse(status)); },
    async get(actor: ReconActor, caseIdInput: string) {
      requireCapability(actor, "records.read");
      const currentCase = await repository.getCase(actor.workspaceId, parseUuid(caseIdInput));
      if (!currentCase) throw new Error("case not found");
      const exceptions = await repository.listExceptions(actor.workspaceId, currentCase.caseId);
      return { case: currentCase, records: await repository.getRecords(actor.workspaceId, currentCase.recordIds), exceptions, drafts: await Promise.all(exceptions.map((exception) => repository.getDraft(actor.workspaceId, exception.exceptionId))), timeline: await repository.listEvents(actor.workspaceId, currentCase.caseId) };
    },
    async draft(actor: ReconActor, caseIdInput: string, exceptionIdInput: string, dependencies: DraftDependencies): Promise<DraftResult> {
      requireCapability(actor, "exception.draft");
      const caseIdValue = parseUuid(caseIdInput);
      const exceptionId = parseUuid(exceptionIdInput);
      const currentCase = await repository.getCase(actor.workspaceId, caseIdValue);
      const exception = await repository.getException(actor.workspaceId, exceptionId);
      if (!currentCase || !exception || exception.caseId !== currentCase.caseId) throw new Error("case not found");
      const records = await repository.getRecords(actor.workspaceId, currentCase.recordIds);
      const result = await draftException({ case: currentCase, records, exception }, { ...dependencies, actorId: dependencies.actorId ?? actor.actorId });
      if (result.ok) {
        await repository.saveDraft(actor.workspaceId, exception.exceptionId, result.draft);
        await repository.updateException({ ...exception, state: "drafted", updatedAt: dependencies.now?.() ?? clock() });
        await repository.appendEvent({ workspaceId: actor.workspaceId, actorId: actor.actorId, subjectId: exception.exceptionId, type: "exception.drafted", payload: { caseId: currentCase.caseId, promptHash: result.draft.promptHash, redactedInputHash: result.draft.redactedInputHash, model: result.draft.model } });
      } else {
        const next = exception.state === "open" ? "needs_human" : exception.state === "drafted" ? "needs_human" : exception.state;
        if (next !== exception.state) await repository.updateException(transitionException(exception, next, dependencies.now?.() ?? clock()));
        await repository.appendEvent({ workspaceId: actor.workspaceId, actorId: actor.actorId, subjectId: exception.exceptionId, type: "exception.draft_failed", payload: { caseId: currentCase.caseId, promptHash: result.promptHash, redactedInputHash: result.redactedInputHash } });
      }
      return result;
    },
    async correct(actor: ReconActor, caseIdInput: string, input: unknown): Promise<CorrectionResult> {
      requireCapability(actor, "correction.write");
      const parsed = correctionInputSchema.parse(input);
      const caseIdValue = parseUuid(caseIdInput);
      const currentCase = await repository.getCase(actor.workspaceId, caseIdValue);
      const exception = await repository.getException(actor.workspaceId, parsed.exceptionId);
      if (!currentCase || !exception || exception.caseId !== currentCase.caseId) throw new Error("case not found");
      const corrected = transitionException(exception, "corrected", clock());
      await repository.updateException(corrected);
      const correction: ReconCorrection = { correctionId: randomUUID(), workspaceId: actor.workspaceId, caseId: currentCase.caseId, exceptionId: exception.exceptionId, actorId: actor.actorId, disposition: parsed.disposition, notes: parsed.notes, createdAt: clock() };
      await repository.insertCorrection(correction);
      await repository.appendEvent({ workspaceId: actor.workspaceId, actorId: actor.actorId, subjectId: exception.exceptionId, type: "exception.corrected", payload: { caseId: currentCase.caseId, correctionId: correction.correctionId, disposition: parsed.disposition } });
      return { correctionId: correction.correctionId, exceptionId: exception.exceptionId, state: "corrected" };
    },
    async verify(actor: ReconActor) { requireCapability(actor, "audit.read"); return repository.verifyEvents(actor.workspaceId); }
  };
}
