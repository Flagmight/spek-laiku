export interface CurrentUser {
  email: string
  role: string
  accountStatus: "Active" | "Suspended"
}
