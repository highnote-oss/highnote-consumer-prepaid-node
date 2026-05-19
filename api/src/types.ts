/** Zod schemas for request validation and OpenAPI spec generation. */

import { z } from "zod";

// --- Auth ---

export const SignupBodySchema = z.object({
  email: z.string().email("Must be a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignupBody = z.infer<typeof SignupBodySchema>;

export const LoginBodySchema = z.object({
  email: z.string().email("Must be a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginBody = z.infer<typeof LoginBodySchema>;

export const OnboardBodySchema = z.object({
  givenName: z.string().min(1, "givenName is required"),
  familyName: z.string().min(1, "familyName is required"),
  middleName: z.string().optional(),
  email: z.string().email("Must be a valid email").optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
  streetAddress: z.string().min(1, "streetAddress is required"),
  extendedAddress: z.string().optional(),
  locality: z.string().min(1, "locality is required"),
  region: z.string().min(1, "region is required"),
  postalCode: z.string().min(1, "postalCode is required"),
  phoneCountryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  ssn: z
    .string()
    .regex(/^\d{3}-?\d{2}-?\d{4}$/, "SSN must be NNN-NN-NNNN or NNNNNNNNN")
    .optional(),
});

export type OnboardBody = z.infer<typeof OnboardBodySchema>;

// --- Shared schemas ---

export const IdParamsSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

// --- Account Holders ---

export const CreateAccountHolderBodySchema = z.object({
  givenName: z.string().min(1, "givenName is required"),
  familyName: z.string().min(1, "familyName is required"),
  middleName: z.string().optional(),
  email: z.string().email("Must be a valid email").optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
  streetAddress: z.string().min(1, "streetAddress is required"),
  extendedAddress: z.string().optional(),
  locality: z.string().min(1, "locality is required"),
  region: z.string().min(1, "region is required"),
  postalCode: z.string().min(1, "postalCode is required"),
  phoneCountryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  ssn: z
    .string()
    .regex(/^\d{3}-?\d{2}-?\d{4}$/, "SSN must be NNN-NN-NNNN or NNNNNNNNN")
    .optional(),
});

export type CreateAccountHolderBody = z.infer<
  typeof CreateAccountHolderBodySchema
>;

// --- Applications ---

export const CreateApplicationBodySchema = z.object({
  cardProductId: z.string().optional(),
});

export type CreateApplicationBody = z.infer<typeof CreateApplicationBodySchema>;

// --- Document Upload ---

export const DocumentTokenBodySchema = z.object({
  documentUploadSessionId: z.string().min(1, "documentUploadSessionId is required"),
});

export type DocumentTokenBody = z.infer<typeof DocumentTokenBodySchema>;

// --- Provisioning ---

export const ProvisionBodySchema = z.object({
  cardProductId: z.string().min(1).optional(),
  financialAccountName: z.string().optional(),
});

export type ProvisionBody = z.infer<typeof ProvisionBodySchema>;

// --- Financial Accounts ---

export const IssueFinancialAccountBodySchema = z.object({
  applicationId: z
    .string()
    .min(1, "applicationId is required"),
  name: z.string().min(1, "name is required"),
});

export type IssueFinancialAccountBody = z.infer<
  typeof IssueFinancialAccountBodySchema
>;

export const SuspendFinancialAccountBodySchema = z.object({
  memo: z.string().min(1, "memo is required").max(2048),
  suspensionReason: z.string().min(1, "suspensionReason is required"),
});

export const UnsuspendFinancialAccountBodySchema = z.object({
  memo: z.string().min(1, "memo is required").max(2048),
});

// --- Cards ---

export const IssueCardBodySchema = z.object({
  financialAccountId: z
    .string()
    .min(1, "financialAccountId is required"),
  activateOnCreate: z.boolean().optional(),
  expirationDate: z.string().datetime({ offset: true }).optional(),
});

export type IssueCardBody = z.infer<typeof IssueCardBodySchema>;

// --- Card Reissue ---

export const ReissueCardBodySchema = z.object({
  reason: z.enum(["LOST", "EXPIRED", "OTHER", "STOLEN"]),
  cardLostDate: z.string().datetime({ offset: true }).optional(),
  activateOnCreate: z.boolean().optional().default(true),
  financialAccountId: z.string().optional(),
  copyNumber: z.boolean().optional().default(false),
  copyPin: z.boolean().optional().default(false),
});

export type ReissueCardBody = z.infer<typeof ReissueCardBodySchema>;

// --- Client Tokens ---

export const CreateClientTokenBodySchema = z.object({
  paymentCardId: z
    .string()
    .min(1, "paymentCardId is required"),
  permissions: z.array(z.string()).optional(),
});

export type CreateClientTokenBody = z.infer<typeof CreateClientTokenBodySchema>;

// --- Transactions ---

export const TransactionQuerySchema = z.object({
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(20),
});

// --- Simulation ---

export const SimulateAuthorizeBodySchema = z.object({
  cardId: z.string().min(1),
  amount: z.number().positive(),
  merchantName: z.string().optional(),
  categoryCode: z.string().optional(),
});

export const SimulateClearBodySchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().positive().optional(),
});

export const SimulateAuthAndClearBodySchema = z.object({
  cardId: z.string().min(1),
  amount: z.number().positive(),
  merchantName: z.string().optional(),
  categoryCode: z.string().optional(),
});

export const SimulateReverseBodySchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().positive().optional(),
});

export const SimulateRefundBodySchema = z.object({
  transactionId: z.string().min(1),
});

export const SimulateAdjustBodySchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().positive(),
  adjustmentType: z.enum(["ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT"]),
});

export const SimulateVerifyBodySchema = z.object({
  cardId: z.string().min(1, "cardId is required"),
  amount: z.number().nonnegative().optional(),
  merchantName: z.string().optional(),
});

export const SimulateDepositBodySchema = z.object({
  financialAccountId: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().optional(),
});

export const SimulateAppStatusBodySchema = z.object({
  applicationId: z.string().min(1),
  newStatus: z.string().min(1),
});

export const SimulateAppVerificationBodySchema = z.object({
  applicantId: z.string().min(1),
  applicationId: z.string().min(1),
  newStatus: z.string().min(1),
});

export const SimulateDocReviewBodySchema = z.object({
  applicationId: z.string().min(1),
  documentUploadLinkId: z.string().min(1),
  documentUploadSessionId: z.string().min(1),
  newReviewStatus: z.string().min(1),
});

export const SimulateDocUploadSessionsBodySchema = z.object({
  applicationId: z.string().min(1),
  memo: z.string().optional(),
  requestedDocuments: z.array(z.object({
    applicantId: z.string().min(1),
    documentTypes: z.array(z.string().min(1)),
  })),
});

export const SimulateAchProcessingBodySchema = z.object({
  transferId: z.string().min(1),
});

export const SimulateAchReturnBodySchema = z.object({
  transferId: z.string().min(1),
  statusFailureReason: z.string().min(1, "statusFailureReason is required"),
});

export const SimulateExternallyInitiatedAchBodySchema = z.object({
  financialAccountId: z.string().min(1),
  amount: z.number().positive(),
});

export const SimulateNonOriginatedAchBodySchema = z.object({
  financialAccountId: z.string().min(1),
  amount: z.number().positive(),
  companyName: z.string().optional().default("TEST COMPANY"),
  purpose: z.string().optional().default("DEPOSIT"),
});

export const SimulatePhysicalCardOrderIdBodySchema = z.object({
  physicalPaymentCardOrderId: z.string().min(1),
});

export const SimulatePhysicalCardShipBodySchema = z.object({
  physicalPaymentCardOrderId: z.string().min(1),
  trackingNumber: z.string().optional(),
  actualShipDate: z.string().optional(),
});

export const SimulateFinancialAccountBodySchema = z.object({
  financialAccountId: z.string().min(1),
});

// --- ACH Transfers ---

export const CreateOneTimeAchTransferBodySchema = z.object({
  fromFinancialAccountId: z.string().min(1),
  toFinancialAccountId: z.string().min(1),
  amount: z.number().positive(),
  scheduledDate: z.string().optional(),
  companyEntryDescription: z.string().max(10).optional().default("PAYMENT"),
  individualName: z.string().max(22).optional().default("ACCOUNT HOLDER"),
});

export const CreateRecurringAchTransferBodySchema = z.object({
  fromFinancialAccountId: z.string().min(1),
  toFinancialAccountId: z.string().min(1),
  amount: z.number().positive(),
  dayOfMonth: z.number().int().min(1).max(28),
  companyEntryDescription: z.string().max(10).optional().default("PAYMENT"),
  individualName: z.string().max(22).optional().default("ACCOUNT HOLDER"),
});

export const CancelScheduledTransferBodySchema = z.object({
  scheduledTransferId: z.string().min(1),
});

export const InitiateAchTransferBodySchema = z.object({
  fromFinancialAccountId: z.string().min(1),
  toFinancialAccountId: z.string().min(1),
  amount: z.number().positive(),
  purpose: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  companyEntryDescription: z.string().max(10).optional().default("PAYMENT"),
  individualName: z.string().max(22).optional().default("ACCOUNT HOLDER"),
});

// --- Physical Card Order ---

export const OrderPhysicalCardBodySchema = z.object({
  nameOnCard: z.string().min(1, "Name on card is required"),
  recipientGivenName: z.string().min(1, "Recipient first name is required"),
  recipientFamilyName: z.string().min(1, "Recipient last name is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  extendedAddress: z.string().optional(),
  locality: z.string().min(1, "City is required"),
  region: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  countryCodeAlpha3: z.string().length(3).default("USA"),
});

// --- External Bank Accounts ---

export const AddPlaidBankAccountBodySchema = z.object({
  accountHolderId: z.string().min(1, "accountHolderId is required"),
  processorToken: z.string().min(1, "processorToken is required"),
});

export const AddFinicityBankAccountBodySchema = z.object({
  accountHolderId: z.string().min(1, "accountHolderId is required"),
  name: z.string().min(1, "name is required"),
  bankAccountType: z.enum(["CHECKING", "SAVINGS"]),
  receiptId: z.string().min(1, "receiptId is required"),
  customerId: z.string().min(1, "customerId is required"),
});

// --- ATM Locator ---

export const FindATMLocationsBodySchema = z.object({
  cardId: z.string().min(1),
  latitude: z.string().min(1),
  longitude: z.string().min(1),
  radiusMiles: z.number().positive().optional().default(10),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const AddNonVerifiedBankAccountBodySchema = z.object({
  accountHolderId: z.string().min(1, "accountHolderId is required"),
  routingNumber: z.string().min(1, "routingNumber is required"),
  accountNumber: z.string().min(1, "accountNumber is required"),
  bankAccountType: z.enum(["CHECKING", "SAVINGS"]),
  name: z.string().optional(),
});

// --- Webhooks ---

export const WebhookEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const WebhookRegisterBodySchema = z.object({
  name: z.string().min(1).max(255),
  subscriptions: z.array(z.string().min(1)),
});
