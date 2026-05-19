import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/client";
import { NavBar } from "../components/NavBar";
import { PageHeader } from "../components/PageHeader";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";

export function ProfilePage() {
  const [copiedId, setCopiedId] = useState(false);
  const {
    data: meData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  const accountHolder = meData?.accountHolder;
  const holder = accountHolder;
  const name = holder?.name ?? null;
  const email = holder?.email ?? meData?.user?.email;
  const dob = holder?.dateOfBirth ?? null;
  const address = holder?.billingAddress ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Profile" showBack />

        {isLoading && <LoadingSpinner message="Loading profile..." />}

        {error && (
          <ErrorMessage
            message={error instanceof Error ? error.message : "Failed to load profile"}
          />
        )}

        {holder && (
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                {name ? `${(name.givenName?.[0] ?? "").toUpperCase()}${(name.familyName?.[0] ?? "").toUpperCase()}` : (email?.[0] ?? "?").toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {name ? `${name.givenName} ${name.familyName}` : "Account Holder"}
                </p>
                {email && <p className="text-sm text-gray-500">{email}</p>}
              </div>
            </div>

            {/* Personal Information */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-gray-900">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Personal Information
              </h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {name && (
                  <>
                    <Field label="First Name" value={name.givenName} />
                    <Field label="Last Name" value={name.familyName} />
                    {name.middleName && <Field label="Middle Name" value={name.middleName} />}
                  </>
                )}
                {email && <Field label="Email" value={email} />}
                {dob && <Field label="Date of Birth" value={dob} />}
              </dl>
            </div>

            {/* Address */}
            {address && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-gray-900">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  Billing Address
                </h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Street" value={address.streetAddress} />
                  {address.extendedAddress && <Field label="Apt / Suite" value={address.extendedAddress} />}
                  <Field label="City" value={address.locality} />
                  <Field label="State" value={address.region} />
                  <Field label="Postal Code" value={address.postalCode} />
                  <Field label="Country" value={address.countryCodeAlpha3} />
                </dl>
              </div>
            )}

            {/* Account Holder ID */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-gray-900">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
                Account Details
              </h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Account Holder ID</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="truncate font-mono text-xs text-gray-900" title={holder.id}>{holder.id}</span>
                    <button
                      onClick={() => { void navigator.clipboard.writeText(holder.id); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title="Copy ID"
                    >
                      {copiedId ? (
                        <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      )}
                    </button>
                  </dd>
                </div>
                {holder.externalId && <Field label="External ID" value={holder.externalId} mono />}
                {holder.createdAt && <Field label="Created" value={new Date(holder.createdAt).toLocaleDateString()} />}
              </dl>
            </div>

            {/* Linked Bank Accounts */}
            {accountHolder?.externalFinancialAccounts?.edges && accountHolder.externalFinancialAccounts.edges.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Linked Bank Accounts</h2>
                <div className="space-y-3">
                  {accountHolder.externalFinancialAccounts.edges.map(({ node: acct }) => (
                    <div key={acct.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {acct.name || "Bank Account"}
                          {acct.externalBankAccountDetails?.type && (
                            <span className="ml-2 text-xs text-gray-500">({acct.externalBankAccountDetails.type})</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {acct.externalBankAccountDetails?.last4 ? `****${acct.externalBankAccountDetails.last4}` : ""}
                          {acct.externalBankAccountDetails?.routingNumber ? ` · RTN ${acct.externalBankAccountDetails.routingNumber}` : ""}
                        </p>
                        <p className="mt-1 font-mono text-xs text-gray-400">{acct.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          acct.accountStatus === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                        }`}>
                          {acct.accountStatus || "UNKNOWN"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {acct.__typename === "NonVerifiedExternalUSFinancialBankAccount" ? "Non-Verified" : "Verified"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {accountHolder?.externalFinancialAccounts?.edges?.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 mb-2">Linked Bank Accounts</h2>
                <p className="text-sm text-gray-500">No external bank accounts linked yet.</p>
              </div>
            )}
          </div>
        )}

        {!isLoading && !holder && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No account holder found. Complete onboarding first.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`mt-1 text-sm text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
