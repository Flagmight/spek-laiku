import type {
  AccountStatus,
  AdminAccount,
  AdminAccountList,
} from "../types/adminAccount"

// Shared data for the User accounts page tests (feature 014). Dates are in November 2026, UTC.

export const activeUser: AdminAccount = {
  id: "8d3f0c2e-6a1b-4f7e-9c55-1b2a3c4d5e6f",
  email: "ana@example.com",
  role: "Registered User",
  accountStatus: "Active",
  registrationDate: "2026-11-21T12:05:00Z",
}

export const suspendedUser: AdminAccount = {
  id: "4a7c1e9b-2d3f-4b8a-9e01-6c5d4b3a2f10",
  email: "bob@example.com",
  role: "Registered User",
  accountStatus: "Suspended",
  registrationDate: "2026-11-18T09:30:00Z",
}

export const administrator: AdminAccount = {
  id: "3b9a7d10-2c4e-4f61-8a0e-0d1c2b3a4f5e",
  email: "admin@example.com",
  role: "Administrator",
  accountStatus: "Active",
  registrationDate: "2026-11-05T08:00:00Z",
}

export const suspendedAdministrator: AdminAccount = {
  id: "9e2b5c7a-1f4d-4a3b-8c6e-7d0a1b2c3d4e",
  email: "old-admin@example.com",
  role: "Administrator",
  accountStatus: "Suspended",
  registrationDate: "2026-11-01T07:15:00Z",
}

export const allAccounts = [
  activeUser,
  suspendedUser,
  administrator,
  suspendedAdministrator,
]

export function accountList(
  accounts: AdminAccount[] = allAccounts,
  hasMore = false,
): AdminAccountList {
  return { accounts, hasMore }
}

export function withStatus(
  account: AdminAccount,
  accountStatus: AccountStatus,
): AdminAccount {
  return { ...account, accountStatus }
}
