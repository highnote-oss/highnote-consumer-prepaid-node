import { request } from "./client";

// --- Transaction Simulations ---

export function simulateAuthorize(cardId: string, amount: number, merchantName?: string, categoryCode?: string) {
  return request<any>("/api/simulate/transactions/authorize", {
    method: "POST",
    body: JSON.stringify({ cardId, amount, merchantName, categoryCode }),
  });
}

export function simulateVerify(cardId: string, amount?: number, merchantName?: string) {
  return request<any>("/api/simulate/transactions/verify", {
    method: "POST",
    body: JSON.stringify({ cardId, ...(amount !== undefined && { amount }), ...(merchantName && { merchantName }) }),
  });
}

export function simulateAuthAndClear(cardId: string, amount: number, merchantName?: string, categoryCode?: string) {
  return request<any>("/api/simulate/transactions/auth-and-clear", {
    method: "POST",
    body: JSON.stringify({ cardId, amount, merchantName, categoryCode }),
  });
}

export function simulateClear(transactionId: string, amount?: number) {
  return request<any>("/api/simulate/transactions/clear", {
    method: "POST",
    body: JSON.stringify({ transactionId, amount }),
  });
}

export function simulateReverse(transactionId: string, amount?: number) {
  return request<any>("/api/simulate/transactions/reverse", {
    method: "POST",
    body: JSON.stringify({ transactionId, amount }),
  });
}

export function simulateRefund(transactionId: string) {
  return request<any>("/api/simulate/transactions/refund", {
    method: "POST",
    body: JSON.stringify({ transactionId }),
  });
}

export function simulateAdjust(transactionId: string, amount: number, adjustmentType: string) {
  return request<any>("/api/simulate/transactions/adjust", {
    method: "POST",
    body: JSON.stringify({ transactionId, amount, adjustmentType }),
  });
}

// --- Deposit Simulation ---

export function simulateDeposit(financialAccountId: string, amount: number, memo?: string) {
  return request<any>("/api/simulate/deposits", {
    method: "POST",
    body: JSON.stringify({ financialAccountId, amount, memo }),
  });
}

// --- Application Simulations ---

export function simulateApplicationStatus(applicationId: string, newStatus: string) {
  return request<any>("/api/simulate/applications/status", {
    method: "POST",
    body: JSON.stringify({ applicationId, newStatus }),
  });
}

export function simulateApplicationVerification(applicantId: string, applicationId: string, newStatus: string) {
  return request<any>("/api/simulate/applications/verification-status", {
    method: "POST",
    body: JSON.stringify({ applicantId, applicationId, newStatus }),
  });
}

export function simulateDocumentReview(applicationId: string, documentUploadLinkId: string, documentUploadSessionId: string, newReviewStatus: string) {
  return request<any>("/api/simulate/applications/document-review", {
    method: "POST",
    body: JSON.stringify({ applicationId, documentUploadLinkId, documentUploadSessionId, newReviewStatus }),
  });
}

export function simulateDocumentUploadSessions(applicationId: string, requestedDocuments: Array<{ applicantId: string; documentTypes: string[] }>, memo?: string) {
  return request<any>("/api/simulate/applications/document-upload-sessions", {
    method: "POST",
    body: JSON.stringify({ applicationId, requestedDocuments, memo }),
  });
}

// --- ACH Simulations ---

export function simulateAchProcessing(transferId: string) {
  return request<any>("/api/simulate/ach/processing", {
    method: "POST",
    body: JSON.stringify({ transferId }),
  });
}

export function simulateAchReturn(transferId: string, statusFailureReason: string) {
  return request<any>("/api/simulate/ach/return", {
    method: "POST",
    body: JSON.stringify({ transferId, statusFailureReason }),
  });
}

export function simulateExternallyInitiatedAch(financialAccountId: string, amount: number) {
  return request<any>("/api/simulate/ach/externally-initiated", {
    method: "POST",
    body: JSON.stringify({ financialAccountId, amount }),
  });
}

export function simulateNonOriginatedAch(financialAccountId: string, amount: number, companyName?: string, purpose?: string) {
  return request<any>("/api/simulate/ach/non-originated", {
    method: "POST",
    body: JSON.stringify({ financialAccountId, amount, companyName, purpose }),
  });
}

// --- Physical Card Simulations ---

export function simulatePhysicalCardSendToPrinter(physicalPaymentCardOrderId: string) {
  return request<any>("/api/simulate/physical-cards/send-to-printer", {
    method: "POST",
    body: JSON.stringify({ physicalPaymentCardOrderId }),
  });
}

export function simulatePhysicalCardApprove(physicalPaymentCardOrderId: string) {
  return request<any>("/api/simulate/physical-cards/approve", {
    method: "POST",
    body: JSON.stringify({ physicalPaymentCardOrderId }),
  });
}

export function simulatePhysicalCardShip(physicalPaymentCardOrderId: string, trackingNumber?: string, actualShipDate?: string) {
  return request<any>("/api/simulate/physical-cards/ship", {
    method: "POST",
    body: JSON.stringify({ physicalPaymentCardOrderId, trackingNumber, actualShipDate }),
  });
}

export function simulatePhysicalCardFailShipment(physicalPaymentCardOrderId: string) {
  return request<any>("/api/simulate/physical-cards/fail-shipment", {
    method: "POST",
    body: JSON.stringify({ physicalPaymentCardOrderId }),
  });
}

// --- Financial Account Simulations ---

export function simulateFinancialAccountInitiateClosure(financialAccountId: string) {
  return request<any>("/api/simulate/financial-accounts/initiate-closure", {
    method: "POST",
    body: JSON.stringify({ financialAccountId }),
  });
}

export function simulateFinancialAccountClose(financialAccountId: string) {
  return request<any>("/api/simulate/financial-accounts/close", {
    method: "POST",
    body: JSON.stringify({ financialAccountId }),
  });
}
