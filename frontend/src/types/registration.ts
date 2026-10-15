export interface RegistrationRequest {
  email: string
  password: string
  passwordConfirmation: string
}

export type RegistrationField = keyof RegistrationRequest

// One message per failing field, as returned in errors of a 400 response.
export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>
