import { GoogleGenAI } from '@google/genai';

/**
 * F-15: the model id used to be hard-coded (`gemini-3.8-flash`) and unverified,
 * and a failing key produced a silent 30-second "negative cache" plus a
 * keyword fallback that did not say why the model was skipped.
 *
 * This module makes the LLM layer explicit and observable:
 *
 * - the model comes from `GEMINI_MODEL`; there is no invented default, so a
 *   key without a model is a configuration error, not a guessed call;
 * - `llmStatus()` reports configuration and the cooldown, never a live probe;
 * - every skip/failure has one stable reason code
 *   (`missing_api_key`, `model_not_configured`, `invalid_api_key`, `model_error`);
 * - a failure opens an explicit circuit breaker for `LLM_COOLDOWN_MS`, and a
 *   suppressed call is counted instead of being silently dropped.
 *
 * Deliberately not here: a real probe of the model at startup (needs network
 * and a paid key, so CI cannot verify it) and automatic retries (they hide the
 * failure and double the cost).
 */

export type LlmProvider = 'gemini' | 'openai' | 'claude' | 'mock';

export type LlmDegradedReason =
  | 'missing_api_key'
  | 'model_not_configured'
  | 'invalid_api_key'
  | 'model_error';

export interface LlmStatus {
  /** True only when a model call would be attempted right now. */
  configured: boolean;
  /** Model id from `GEMINI_MODEL`, or null when it is not set. */
  model: string | null;
  degradedReason: LlmDegradedReason | null;
  /** ISO timestamp while the circuit breaker is open, else null. */
  cooldownUntil: string | null;
  metrics: {
    /** Model calls that were attempted (and may later fail). */
    modelCalls: number;
    /** Failed model calls; each one opens exactly one cooldown. */
    modelFailures: number;
    /** Requests that answered from rules because the cooldown was open. */
    suppressedCalls: number;
  };
}

export const LLM_COOLDOWN_MS = 30_000;

interface Cooldown {
  until: number;
  reason: LlmDegradedReason;
  /** Cooldown applies only to the key/model that failed. */
  apiKey: string;
  model: string;
}

const metrics = { modelCalls: 0, modelFailures: 0, suppressedCalls: 0 };

let cooldown: Cooldown | null = null;

function readApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!key || key === 'YOUR_API_KEY' || key.length < 15) return '';
  return key;
}

/** Detects or configures active LLM Provider (gemini, openai, claude, mock). */
export function configuredProvider(): LlmProvider {
  const explicit = (process.env.LLM_PROVIDER || '').toLowerCase().trim();
  if (explicit === 'openai' || explicit === 'claude' || explicit === 'mock' || explicit === 'gemini') {
    return explicit as LlmProvider;
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10) return 'openai';
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10) return 'claude';
  return 'gemini';
}

/** The model id is configuration, never a guess. */
export function configuredModel(): string {
  const provider = configuredProvider();
  if (provider === 'openai') return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (provider === 'claude') return process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet';
  if (provider === 'mock') return 'mock-rules-engine';
  return (process.env.GEMINI_MODEL || '').trim();
}

function missingConfigReason(apiKey: string): LlmDegradedReason | null {
  if (!apiKey) return 'missing_api_key';
  if (!configuredModel()) return 'model_not_configured';
  return null;
}

function activeCooldown(apiKey: string, model: string, now: number): Cooldown | null {
  if (!cooldown) return null;
  if (cooldown.until <= now) {
    cooldown = null;
    return null;
  }
  // Reconfiguring the key or the model must not inherit an old failure.
  if (cooldown.apiKey !== apiKey || cooldown.model !== model) return null;
  return cooldown;
}

export function llmStatus(now: number = Date.now()): LlmStatus {
  const apiKey = readApiKey();
  const model = configuredModel();
  const missing = missingConfigReason(apiKey);
  const cooling = missing ? null : activeCooldown(apiKey, model, now);

  return {
    configured: !missing && !cooling,
    model: model || null,
    degradedReason: missing ?? cooling?.reason ?? null,
    cooldownUntil: cooling ? new Date(cooling.until).toISOString() : null,
    metrics: { ...metrics },
  };
}

export interface ResolvedLlm {
  client: GoogleGenAI | null;
  /** Why no client was created; null when a call will be attempted. */
  reason: LlmDegradedReason | null;
}

/**
 * Returns a client only when the call may actually be attempted. The caller
 * must report `reason` to the user instead of pretending the model answered.
 */
export function resolveLlmClient(now: number = Date.now()): ResolvedLlm {
  const apiKey = readApiKey();
  const model = configuredModel();

  const missing = missingConfigReason(apiKey);
  if (missing) return { client: null, reason: missing };

  const cooling = activeCooldown(apiKey, model, now);
  if (cooling) {
    metrics.suppressedCalls += 1;
    return { client: null, reason: cooling.reason };
  }

  metrics.modelCalls += 1;
  return {
    client: new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'mcp-rooms',
        },
      },
    }),
    reason: null,
  };
}

function isInvalidKeyError(message: string): boolean {
  return (
    message.includes('API_KEY_INVALID') ||
    message.includes('API key not valid') ||
    message.includes('PERMISSION_DENIED')
  );
}

/**
 * Opens the circuit breaker after a failed model call and logs exactly one line.
 * Returns the reason code the response must expose.
 */
export function recordLlmFailure(error: unknown, now: number = Date.now()): LlmDegradedReason {
  const message = String((error as { message?: string } | null)?.message ?? error);
  const reason: LlmDegradedReason = isInvalidKeyError(message) ? 'invalid_api_key' : 'model_error';

  cooldown = { until: now + LLM_COOLDOWN_MS, reason, apiKey: readApiKey(), model: configuredModel() };
  metrics.modelFailures += 1;

  console.warn(
    `[llm] model call failed (${reason}); rule-based fallback for ${Math.round(
      LLM_COOLDOWN_MS / 1000
    )}s: ${message}`
  );
  return reason;
}

/** Test helper: drops the cooldown and resets counters. */
export function resetLlmState() {
  cooldown = null;
  metrics.modelCalls = 0;
  metrics.modelFailures = 0;
  metrics.suppressedCalls = 0;
}
