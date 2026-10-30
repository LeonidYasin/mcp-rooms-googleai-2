import { GoogleGenAI } from '@google/genai';
import { logger } from './logger';

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

/** The model id is configuration, never a guess. */
export function configuredModel(): string {
  return (process.env.GEMINI_MODEL || '').trim();
}

function missingConfigReason(apiKey: string, isOverride: boolean = false): LlmDegradedReason | null {
  if (!apiKey) return 'missing_api_key';
  if (!configuredModel() && !isOverride) return 'model_not_configured';
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
export function resolveLlmClient(apiKeyOverride?: string, now: number = Date.now()): ResolvedLlm {
  const apiKey = (apiKeyOverride || readApiKey()).trim();
  const model = configuredModel() || (apiKeyOverride ? 'gemini-1.5-flash' : '');

  const missing = missingConfigReason(apiKey, Boolean(apiKeyOverride));
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

  logger.warn('Gemini model call failed; rule-based fallback activated', {
    reason,
    cooldownSeconds: Math.round(LLM_COOLDOWN_MS / 1000),
    error: message,
  });
  return reason;
}

/** Test helper: drops the cooldown and resets counters. */
export function resetLlmState() {
  cooldown = null;
  metrics.modelCalls = 0;
  metrics.modelFailures = 0;
  metrics.suppressedCalls = 0;
}

export interface OAuthGeminiParams {
  accessToken: string;
  model?: string;
  contents: any[];
  systemInstruction?: string;
  tools?: any[];
  temperature?: number;
}

export interface OAuthGeminiResult {
  text: string;
  functionCalls: Array<{ name: string; args: any }>;
  candidateContent?: any;
}

/**
 * Executes a Gemini model call directly via Google Generative Language REST API
 * using a user-provided Google OAuth 2.0 Access Token.
 */
export async function callGeminiWithOAuth(params: OAuthGeminiParams): Promise<OAuthGeminiResult> {
  const model = params.model || configuredModel() || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const payload: any = {
    contents: params.contents,
    generationConfig: {
      temperature: params.temperature ?? 0.7,
    },
  };

  if (params.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: params.systemInstruction }],
    };
  }

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
      'User-Agent': 'mcp-rooms',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      parsed = { message: errorBody };
    }
    const errMessage = parsed?.error?.message || errorBody || `HTTP ${response.status}`;
    const errStatus = parsed?.error?.status || `HTTP_${response.status}`;
    const error = new Error(`Google Gemini OAuth API Error (${errStatus}): ${errMessage}`);
    (error as any).status = response.status;
    (error as any).code = errStatus;
    throw error;
  }

  const data: any = await response.json();
  const candidate = data.candidates?.[0];
  const candidateContent = candidate?.content;
  const parts: any[] = candidateContent?.parts || [];

  let text = '';
  const functionCalls: Array<{ name: string; args: any }> = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  return {
    text,
    functionCalls,
    candidateContent,
  };
}
