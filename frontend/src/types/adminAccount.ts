// One account on the User accounts page (feature 014 contracts/admin-accounts-api.md). The server sends exactly
// these five values, never a password or any other sign-in secret (spec FR-011).
export interface AdminAccount {
  id: string
  email: string
  role: "Registered User" | "Administrator"
  accountStatus: "Active" | "Suspended"
  registrationDate: string
}

// At most 50 accounts, newest registration first; hasMore when more match (spec FR-001).
export interface AdminAccountList {
  accounts: AdminAccount[]
  hasMore: boolean
}

export type AccountStatus = AdminAccount["accountStatus"]
