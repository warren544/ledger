import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { redact } from "../../core/redaction.js";

export const DEFAULT_LLM_MODEL = "gpt-5-mini";
export const DEFAULT_ADAPTER_TIMEOUT_MS = 10_000;
export const DEFAULT_ADAPTER_RETRIES = 1;

const neutralMessageSchema = z.object({ message: z.string().min(1) }).strict();
export type NeutralMessage = z.infer<typeof neutralMessageSchema>;

export interface LlmRequestOptions {
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly signal?: AbortSignal;
}

export interface StructuredRequestOptions {
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly signal?: AbortSignal;
  readonly temperature?: number;
}

export interface StructuredResponsesClient {
  responses: {
    parse(request: unknown, options?: LlmRequestOptions | StructuredRequestOptions): Promise<{ readonly output_parsed?: unknown | null; readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number; readonly total_tokens?: number } | null }>;
  };
}

export type OpenAIClientFactory = (apiKey: string, options: { readonly timeout: number; readonly maxRetries: number }) => StructuredResponsesClient;

export interface LlmConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

function boundedInteger(value: number | undefined, fallback: number, name: string): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 0 || result > 5) throw new RangeError(`${name} must be a safe integer from 0 through 5`);
  return result;
}

function timeout(value: number | undefined): number {
  const result = value ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  if (!Number.isSafeInteger(result) || result < 1 || result > 120_000) throw new RangeError("timeoutMs must be a positive safe integer no greater than 120000");
  return result;
}

function redactedError(error: unknown, secrets: readonly string[]): Error {
  return new Error(`OpenAI operation failed: ${JSON.stringify(redact(error, { secrets }))}`);
}

function isAborted(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === "AbortError");
}

function supportsTemperature(model: string): boolean {
  return !/^gpt-5(?:$|-)/i.test(model);
}

export function createOpenAIClient(config: LlmConfig, factory: OpenAIClientFactory = (apiKey, options) => new OpenAI({ apiKey, timeout: options.timeout, maxRetries: options.maxRetries }) as unknown as StructuredResponsesClient): StructuredResponsesClient {
  const timeoutMs = timeout(config.timeoutMs);
  const maxRetries = boundedInteger(config.maxRetries, DEFAULT_ADAPTER_RETRIES, "maxRetries");
  if (config.apiKey.trim() === "") throw new Error("OpenAI API key is required");
  return factory(config.apiKey, { timeout: timeoutMs, maxRetries });
}

export async function requestNeutralMessage(client: StructuredResponsesClient, config: Pick<LlmConfig, "apiKey" | "model" | "timeoutMs" | "maxRetries"> & { readonly signal?: AbortSignal }): Promise<NeutralMessage> {
  const timeoutMs = timeout(config.timeoutMs);
  const maxRetries = boundedInteger(config.maxRetries, DEFAULT_ADAPTER_RETRIES, "maxRetries");
  const model = config.model ?? DEFAULT_LLM_MODEL;
  if (model.trim() === "") throw new Error("LLM model is required");
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (config.signal?.aborted) throw new Error("OpenAI request aborted");
    try {
      const response = await client.responses.parse({
        model,
        input: "Return one short neutral connectivity message.",
        text: { format: zodTextFormat(neutralMessageSchema, "neutral_message") }
      }, { timeout: timeoutMs, maxRetries: 0, signal: config.signal });
      return neutralMessageSchema.parse(response.output_parsed);
    } catch (error) {
      if (isAborted(error, config.signal)) throw new Error("OpenAI request aborted");
      lastError = error;
    }
  }
  throw redactedError(lastError, [config.apiKey]);
}

export async function requestStructuredOutput<T>(
  client: StructuredResponsesClient,
  config: Pick<LlmConfig, "apiKey" | "model" | "timeoutMs" | "maxRetries"> & { readonly signal?: AbortSignal; readonly temperature?: number },
  input: string,
  schema: z.ZodType<T>,
  schemaName: string,
): Promise<{ readonly value: T; readonly usage: { readonly inputTokens: number | null; readonly outputTokens: number | null; readonly totalTokens: number | null } }> {
  const timeoutMs = timeout(config.timeoutMs);
  const maxRetries = boundedInteger(config.maxRetries, DEFAULT_ADAPTER_RETRIES, "maxRetries");
  const model = config.model ?? DEFAULT_LLM_MODEL;
  if (model.trim() === "") throw new Error("LLM model is required");
  const temperature = config.temperature ?? 0.2;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error("LLM temperature must be between 0 and 2");
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (config.signal?.aborted) throw new Error("OpenAI request aborted");
    try {
      const request = {
        model,
        input,
        text: { format: zodTextFormat(schema, schemaName) }
      } as Record<string, unknown>;
      if (supportsTemperature(model)) request.temperature = temperature;
      const response = await client.responses.parse(request, { timeout: timeoutMs, maxRetries: 0, signal: config.signal });
      const value = schema.parse(response.output_parsed);
      const usage = response.usage;
      return { value, usage: { inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null, totalTokens: usage?.total_tokens ?? null } };
    } catch (error) {
      if (isAborted(error, config.signal)) throw new Error("OpenAI request aborted");
      lastError = error;
    }
  }
  throw redactedError(lastError, [config.apiKey]);
}

export { neutralMessageSchema };
