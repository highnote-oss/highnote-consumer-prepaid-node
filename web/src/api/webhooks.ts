import { request } from "./client";

export interface WebhookEvent {
  id: number;
  eventId: string | null;
  eventType: string;
  isReplay: boolean;
  payload: string;
  receivedAt: string;
}

export interface WebhookEventsResponse {
  events: WebhookEvent[];
  total: number;
  limit: number;
  offset: number;
}

export type WebhookRegistrationStatus =
  | "NOT_REGISTERED"
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "DEACTIVATED"
  | "REGISTRATION_FAILED";

export type WebhookRegistrationSource = "auto" | "manual" | "none";

export interface WebhookStatus {
  targetId: string | null;
  name: string | null;
  status: WebhookRegistrationStatus;
  registeredAt: string | null;
  lastError: string | null;
  hasSecret: boolean;
  source: WebhookRegistrationSource;
  subscriptionCount: number;
  publicUrl: string | null;
}

export function getWebhookEvents(limit = 50, offset = 0) {
  return request<WebhookEventsResponse>(
    `/api/webhooks/events?limit=${limit}&offset=${offset}`,
  );
}

export function getWebhookStatus() {
  return request<WebhookStatus>(`/api/webhooks/status`);
}

export function reregisterWebhook() {
  return request<WebhookStatus>(`/api/webhooks/register`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface DeliveryAttempt {
  eventId: string | null;
  eventName: string | null;
  createdAt: string | null;
  hasSuccessfulDelivery: boolean | null;
}

export interface DeliveryAttemptsResponse {
  attempts: DeliveryAttempt[];
  targetId: string | null;
}

export function getDeliveryAttempts(unsuccessfulOnly = false, limit = 50) {
  const params = new URLSearchParams();
  if (unsuccessfulOnly) params.set("unsuccessfulOnly", "true");
  params.set("limit", String(limit));
  return request<DeliveryAttemptsResponse>(`/api/webhooks/delivery-attempts?${params}`);
}

export function replayWebhookEvent(id: number) {
  return request<{ replayed: boolean; eventId: string; targetIds?: string[] }>(
    `/api/webhooks/events/${id}/replay`,
    { method: "POST" },
  );
}
