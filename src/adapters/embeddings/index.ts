import OpenAI from "openai";
import { redact } from "../../core/redaction.js";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingRequestOptions {
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly signal?: AbortSignal;
}
export interface EmbeddingClient {
  embeddings: { create(request: unknown, options?: EmbeddingRequestOptions): Promise<{ readonly data?: readonly { readonly embedding?: readonly number[] }[] }> };
}
export type EmbeddingClientFactory = (apiKey: string, options: { readonly timeout: number; readonly maxRetries: number }) => EmbeddingClient;
export interface EmbeddingConfig { readonly apiKey: string; readonly model?: string; readonly timeoutMs?: number; readonly maxRetries?: number; }

function settings(config: Pick<EmbeddingConfig, "timeoutMs" | "maxRetries">): { timeout: number; maxRetries: number } {
  const timeout = config.timeoutMs ?? 10_000;
  const maxRetries = config.maxRetries ?? 1;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120_000) throw new RangeError("timeoutMs must be a positive safe integer no greater than 120000");
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) throw new RangeError("maxRetries must be a safe integer from 0 through 5");
  return { timeout, maxRetries };
}

function redactedError(error: unknown, secrets: readonly string[]): Error { return new Error(`OpenAI embedding operation failed: ${JSON.stringify(redact(error, { secrets }))}`); }

export function createEmbeddingClient(config: EmbeddingConfig, factory: EmbeddingClientFactory = (apiKey, options) => new OpenAI({ apiKey, timeout: options.timeout, maxRetries: options.maxRetries }) as unknown as EmbeddingClient): EmbeddingClient {
  const options = settings(config);
  if (config.apiKey.trim() === "") throw new Error("OpenAI API key is required");
  return factory(config.apiKey, options);
}

export async function createEmbedding(client: EmbeddingClient, config: Pick<EmbeddingConfig, "apiKey" | "model" | "timeoutMs" | "maxRetries"> & { readonly signal?: AbortSignal }, input: string): Promise<number[]> {
  if (input.trim() === "") throw new Error("embedding input must be nonempty");
  const { timeout, maxRetries } = settings(config);
  const model = config.model ?? DEFAULT_EMBEDDING_MODEL;
  if (model.trim() === "") throw new Error("embedding model is required");
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (config.signal?.aborted) throw new Error("OpenAI embedding request aborted");
    try {
      const response = await client.embeddings.create({ model, input, dimensions: EMBEDDING_DIMENSIONS, encoding_format: "float" }, { timeout, maxRetries: 0, signal: config.signal });
      if (!response.data || response.data.length !== 1 || !response.data[0]?.embedding) throw new Error("embedding response must contain exactly one vector");
      const vector = [...response.data[0].embedding];
      if (vector.length !== EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) throw new Error("embedding response has invalid dimensions or values");
      return vector;
    } catch (error) {
      if (config.signal?.aborted) throw new Error("OpenAI embedding request aborted");
      lastError = error;
    }
  }
  throw redactedError(lastError, [config.apiKey]);
}
