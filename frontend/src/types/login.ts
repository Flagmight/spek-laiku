export interface LoginRequest {
  email: string
  password: string
}

export type LoginField = "email" | "password"

// One message per failing field, as returned in errors of a 400 response.
export type LoginFieldErrors = Partial<Record<LoginField, string>>
