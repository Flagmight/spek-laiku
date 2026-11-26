// What POST /api/account/delete answered (feature 016 contracts/account-deletion-api.md). Any other status throws
// ApiError, and a network error or an abort rejects.
export type AccountDeletionAnswer =
  | { kind: "deleted" }
  // A 400: the first message of errors.password, without "Error:".
  | { kind: "invalid"; message: string }
  // A 429: the account is locked for login (5 failed attempts in a row).
  | { kind: "locked" }
  // A 401: the session already ended.
  | { kind: "signedOut" }
  // A 403: not an Active Registered User, or the account no longer exists.
  | { kind: "forbidden" }
