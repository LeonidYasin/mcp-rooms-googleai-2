import crypto from 'crypto';
import {
  getWebhooksFromDb,
  saveWebhookDeliveryInDb,
  WebhookDeliveryRecord,
} from './db';

/**
 * Calculates HMAC SHA-256 signature for webhook payload authentication.
 */
export function calculateWebhookSignature(secret: string, payloadString: string): string {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Asynchronously dispatches a webhook event to all subscribed endpoints.
 */
export async function dispatchWebhookEvent(
  eventType: string,
  eventPayload: Record<string, any>,
  targetOwner?: string
): Promise<WebhookDeliveryRecord[]> {
  const allWebhooks = getWebhooksFromDb();
  const matchingWebhooks = allWebhooks.filter((w) => {
    if (w.status !== 'active') return false;
    if (targetOwner && w.owner !== targetOwner) return false;
    return w.events.includes('*') || w.events.includes(eventType);
  });

  const deliveries: WebhookDeliveryRecord[] = [];

  for (const hook of matchingWebhooks) {
    const payload = {
      event_id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      event_type: eventType,
      timestamp: Date.now(),
      data: eventPayload,
    };

    const payloadString = JSON.stringify(payload);
    const signature = calculateWebhookSignature(hook.secret, payloadString);

    let statusCode: number | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Signature': signature,
          'X-MCP-Event': eventType,
          'User-Agent': 'mcp-rooms-webhook/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(5000),
      });

      statusCode = response.status;
      success = response.ok;
      if (!response.ok) {
        errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      }
    } catch (err: any) {
      errorMessage = err?.message || 'Network error / timeout';
    }

    const deliveryRecord: WebhookDeliveryRecord = {
      id: 'del-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      webhookId: hook.id,
      eventType,
      payload,
      statusCode,
      success,
      errorMessage,
      createdAt: Date.now(),
    };

    saveWebhookDeliveryInDb(deliveryRecord);
    deliveries.push(deliveryRecord);
  }

  return deliveries;
}
