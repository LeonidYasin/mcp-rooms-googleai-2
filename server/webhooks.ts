import crypto from 'crypto';
import {
  AgentWebhook,
  getWebhooksFromDb,
  getWebhookByIdFromDb,
  getRoomByIdFromDb,
  updateWebhookDeliveryStatsInDb,
  addAuditLog,
} from './db';

export interface WebhookEventPayload {
  event: string;
  deliveryId: string;
  timestamp: number;
  data: any;
}

export function computeWebhookSignature(secret: string, payloadString: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

export function generateWebhookSecret(): string {
  return 'whsec_' + crypto.randomBytes(24).toString('hex');
}

export interface DeliveryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  initialDelayMs?: number;
}

/**
 * Delivers a webhook payload with HMAC-SHA256 signature and exponential backoff retry.
 */
export async function deliverWebhook(
  webhook: AgentWebhook,
  eventType: string,
  data: any,
  options: DeliveryOptions = {}
): Promise<{ success: boolean; statusCode?: number; error?: string; attempts: number }> {
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 5000;
  const initialDelayMs = options.initialDelayMs ?? 200;

  const deliveryId = 'deliv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const payload: WebhookEventPayload = {
    event: eventType,
    deliveryId,
    timestamp: Date.now(),
    data,
  };

  const payloadString = JSON.stringify(payload);
  const signature = computeWebhookSignature(webhook.secret, payloadString);

  let attempts = 0;
  let lastError: string | undefined;
  let lastStatusCode: number | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    try {
      const response = await fetch(webhook.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Signature': signature,
          'X-MCP-Event': eventType,
          'X-MCP-Delivery': deliveryId,
          'User-Agent': 'Marketplace-OS-Webhook/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(timeoutMs),
      });

      lastStatusCode = response.status;

      if (response.ok) {
        updateWebhookDeliveryStatsInDb(webhook.id, true);
        return { success: true, statusCode: response.status, attempts };
      }

      lastError = `HTTP ${response.status} ${response.statusText}`;
    } catch (err: any) {
      lastError = err?.message || 'Network error';
    }

    if (attempt < maxRetries) {
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  updateWebhookDeliveryStatsInDb(webhook.id, false);
  return { success: false, statusCode: lastStatusCode, error: lastError, attempts };
}

/**
 * Dispatches a notification event to matching subscribed webhooks.
 * Runs asynchronously and never blocks caller flow.
 */
export async function dispatchWebhooksForEvent(
  eventType: string,
  data: any,
  options?: { recipientAgentIds?: string[]; roomId?: string }
): Promise<void> {
  try {
    const webhooks = getWebhooksFromDb();
    if (!webhooks.length) return;

    let roomParticipants: string[] | null = null;
    if (options?.roomId) {
      const room = getRoomByIdFromDb(options.roomId);
      if (room) {
        roomParticipants = room.participants;
      }
    }

    const matchedWebhooks = webhooks.filter((wh) => {
      if (wh.status !== 'active') return false;

      // Event type check
      const eventMatches = wh.events.includes('*') || wh.events.includes(eventType);
      if (!eventMatches) return false;

      // Recipient check
      if (options?.recipientAgentIds && options.recipientAgentIds.length > 0) {
        return options.recipientAgentIds.includes(wh.agentId);
      }

      if (roomParticipants) {
        return roomParticipants.includes(wh.agentId);
      }

      return true;
    });

    for (const wh of matchedWebhooks) {
      // Fire-and-forget in background
      deliverWebhook(wh, eventType, data).catch((err) => {
        // Silently caught, failure logged in DB
      });
    }
  } catch (err) {
    // Non-fatal
  }
}
