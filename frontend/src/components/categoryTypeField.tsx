import { formatErrorMessage } from "../helpers/formatErrorMessage"
import type { ActivityType } from "../types/activityCategory"

interface CategoryTypeFieldProps {
  value: ActivityType | null
  error?: string
  onChange: (value: ActivityType) => void
}

const types: ActivityType[] = ["Indoor", "Outdoor"]
export const categoryTypeFieldId = "category-type"
const errorId = `${categoryTypeFieldId}-error`

// Type as two radio buttons in a fieldset; none is selected until the administrator chooses.
export function CategoryTypeField({
  value,
  error,
  onChange,
}: CategoryTypeFieldProps) {
  return (
    <fieldset
      className="form-field"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend>Type</legend>
      {types.map((type, index) => (
        <label key={type} className="radio-option">
          <input
            // The first radio carries the field id, so the error summary can move focus to it.
            id={index === 0 ? categoryTypeFieldId : undefined}
            type="radio"
            name="category-type"
            value={type}
            checked={value === type}
            onChange={() => onChange(type)}
          />
          {type}
        </label>
      ))}
      {error && (
        <p id={errorId} className="field-error">
          {formatErrorMessage(error)}
        </p>
      )}
    </fieldset>
  )
}
