import type { MouseEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"

export interface FieldError {
  fieldId: string
  message: string
}

interface ErrorSummaryProps {
  errors: FieldError[]
}

// Lists every message when two or more fields fail; each link moves focus to its field (FR-020).
export function ErrorSummary({ errors }: ErrorSummaryProps) {
  if (errors.length < 2) {
    return null
  }

  function focusField(event: MouseEvent<HTMLAnchorElement>, fieldId: string) {
    // Move focus explicitly: a hash link alone only scrolls in some browsers.
    event.preventDefault()
    document.getElementById(fieldId)?.focus()
  }

  return (
    <div role="alert" aria-label="Error summary" className="error-summary">
      <ul>
        {errors.map(({ fieldId, message }) => (
          <li key={fieldId}>
            <a
              href={`#${fieldId}`}
              onClick={(event) => focusField(event, fieldId)}
            >
              {formatErrorMessage(message)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
