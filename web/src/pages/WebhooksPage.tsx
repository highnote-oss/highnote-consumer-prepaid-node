import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavBar } from "../components/NavBar";
import { PageHeader } from "../components/PageHeader";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import {
  getWebhookEvents,
  getWebhookStatus,
  reregisterWebhook,
  getDeliveryAttempts,
  replayWebhookEvent,
  type WebhookRegistrationStatus,
} from "../api/webhooks";

const STATUS_BADGE: Record<WebhookRegistrationStatus, { label: string; classes: string }> = {
  ACTIVE: { label: "Active", classes: "bg-green-50 text-green-700 ring-green-200" },
  PENDING_VERIFICATION: {
    label: "Pending verification",
    classes: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  DEACTIVATED: {
    label: "Deactivated",
    classes: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  REGISTRATION_FAILED: {
    label: "Registration failed",
    classes: "bg-red-50 text-red-700 ring-red-200",
  },
  NOT_REGISTERED: { label: "Not registered", classes: "bg-gray-100 text-gray-600 ring-gray-200" },
};

function StatusPanel() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["webhook-status"],
    queryFn: getWebhookStatus,
    refetchInterval: 10_000,
  });

  const reregister = useMutation({
    mutationFn: reregisterWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-status"] });
    },
  });

  if (isLoading || !status) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <LoadingSpinner />
      </div>
    );
  }

  const badge = STATUS_BADGE[status.status];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${badge.classes}`}
            >
              {badge.label}
            </span>
            <span className="text-xs text-gray-400">
              source: {status.source}
            </span>
          </div>
          {status.name && (
            <p className="text-sm text-gray-700">
              <span className="text-gray-400">Target:</span> {status.name}
              {status.targetId && (
                <span className="text-xs text-gray-400 ml-2">({status.targetId})</span>
              )}
            </p>
          )}
          {status.publicUrl && (
            <p className="text-xs text-gray-500 font-mono break-all">{status.publicUrl}</p>
          )}
          <p className="text-xs text-gray-500">
            {status.subscriptionCount > 0
              ? `${status.subscriptionCount} subscription${status.subscriptionCount !== 1 ? "s" : ""}`
              : "No subscriptions"}
            {status.registeredAt && (
              <> · registered {new Date(status.registeredAt).toLocaleString()}</>
            )}
            {status.hasSecret ? " · signing key in memory" : " · no signing key (verification skipped)"}
          </p>
          {status.lastError && (
            <p className="text-xs text-red-600 mt-1">Error: {status.lastError}</p>
          )}
        </div>
        <button
          onClick={() => reregister.mutate()}
          disabled={reregister.isPending}
          className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {reregister.isPending ? "Re-registering…" : "Re-register"}
        </button>
      </div>
      {reregister.error && (
        <ErrorMessage message={(reregister.error as Error).message} />
      )}
    </div>
  );
}

function DeliveryAttemptsPanel() {
  const [unsuccessfulOnly, setUnsuccessfulOnly] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["webhook-delivery-attempts", unsuccessfulOnly],
    queryFn: () => getDeliveryAttempts(unsuccessfulOnly),
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Highnote delivery log</h3>
          <p className="text-xs text-gray-500">
            What Highnote tried to send to this target — independent of our local event log.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={unsuccessfulOnly}
              onChange={(e) => setUnsuccessfulOnly(e.target.checked)}
              className="rounded"
            />
            Failed only
          </label>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs text-purple-700 hover:text-purple-900 disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={(error as Error).message} />}

      {data && data.attempts.length === 0 && !isLoading && (
        <p className="text-xs text-gray-400 text-center py-4">
          {data.targetId
            ? "No delivery attempts yet."
            : "No registered target — delivery log unavailable."}
        </p>
      )}

      {data && data.attempts.length > 0 && (
        <div className="space-y-1">
          {data.attempts.map((a, i) => (
            <div
              key={`${a.eventId ?? i}`}
              className="flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-gray-50 rounded text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {a.hasSuccessfulDelivery === true ? (
                  <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-200">
                    delivered
                  </span>
                ) : a.hasSuccessfulDelivery === false ? (
                  <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
                    failed
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200">
                    pending
                  </span>
                )}
                <span className="text-gray-700 truncate">{a.eventName ?? "—"}</span>
                {a.eventId && (
                  <span className="text-[10px] text-gray-400 font-mono truncate">{a.eventId}</span>
                )}
              </div>
              {a.createdAt && (
                <span className="text-[10px] text-gray-400 shrink-0">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WebhooksPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["webhook-events"],
    queryFn: () => getWebhookEvents(),
    refetchInterval: 10_000,
  });

  const replay = useMutation({
    mutationFn: (id: number) => replayWebhookEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-delivery-attempts"] });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <PageHeader title="Webhook Events" showBack />
        <p className="text-sm text-gray-500 mb-6">
          Events received from Highnote webhooks. Auto-refreshes every 10 seconds.
        </p>

        <StatusPanel />

        <DeliveryAttemptsPanel />

        {replay.error && (
          <div className="mb-4">
            <ErrorMessage message={(replay.error as Error).message} />
          </div>
        )}

        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message={error.message} />}

        {data && data.events.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">No webhook events yet</p>
            <p className="text-sm mt-1">
              Register a webhook target and trigger events to see them here.
            </p>
          </div>
        )}

        {data && data.events.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">
              {data.total} total event{data.total !== 1 ? "s" : ""}
            </p>
            {data.events.map((event) => {
              const isExpanded = expandedId === event.id;
              let parsedPayload: string;
              try {
                parsedPayload = JSON.stringify(JSON.parse(event.payload), null, 2);
              } catch {
                parsedPayload = event.payload;
              }

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0"
                    >
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                        {event.eventType}
                      </span>
                      {event.isReplay && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          replay
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(event.receivedAt).toLocaleString()}
                      </span>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      {event.eventId && (
                        <button
                          onClick={() => replay.mutate(event.id)}
                          disabled={replay.isPending && replay.variables === event.id}
                          className="text-xs text-purple-700 hover:text-purple-900 disabled:opacity-50"
                          title="Ask Highnote to replay this event"
                        >
                          {replay.isPending && replay.variables === event.id
                            ? "Replaying…"
                            : "Replay"}
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : event.id)}
                        className="text-gray-400 text-sm"
                      >
                        {isExpanded ? "▼" : "▶"}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <pre className="px-4 pb-4 text-xs text-gray-600 overflow-x-auto bg-gray-50 mx-4 mb-4 rounded-md p-3">
                      {parsedPayload}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
