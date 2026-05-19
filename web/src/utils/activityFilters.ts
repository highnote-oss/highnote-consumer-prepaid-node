import type { FinancialAccountActivity } from "../api/client";

export type ActivityStatusFilter = "all" | "authorized" | "cleared" | "declined";

export function filterActivitiesBySearch(
  activities: FinancialAccountActivity[],
  query: string,
): FinancialAccountActivity[] {
  if (!query) return activities;
  const q = query.toLowerCase();
  return activities.filter((a) => {
    const events = (a.source as any)?.transactionEvents ?? [];
    const merchantName = events.find((e: any) => e.merchantDetails?.name)?.merchantDetails?.name ?? "";
    const sourceType = a.source?.__typename ?? "";
    return merchantName.toLowerCase().includes(q) || sourceType.toLowerCase().includes(q);
  });
}

export function filterActivitiesByStatus(
  activities: FinancialAccountActivity[],
  status: ActivityStatusFilter,
): FinancialAccountActivity[] {
  if (status === "all") return activities;
  return activities.filter((a) => {
    const isCardTx = a.source?.__typename === "DebitTransaction" || a.source?.__typename === "CreditTransaction";
    const events = (a.source as any)?.transactionEvents ?? [];
    const authEvent = events.find((e: any) =>
      e.__typename === "AuthorizationEvent" ||
      e.__typename === "AuthorizationAndClearEvent" ||
      e.__typename === "VerificationEvent",
    );
    const responseCode = (authEvent ?? events[0])?.responseCode;
    const isApproved = !responseCode || responseCode === "APPROVED" || responseCode === "APPROVED_FOR_PARTIAL_AMOUNT";

    switch (status) {
      case "authorized": return isCardTx && !a.isComplete && isApproved;
      case "cleared": return a.isComplete;
      case "declined": return isCardTx && !isApproved;
      default: return true;
    }
  });
}
