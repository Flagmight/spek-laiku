import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { parseDecimal } from "../helpers/parseDecimal"
import { useCategoryFormStore } from "../stores/useCategoryFormStore"
import type {
  ActivityCategory,
  ActivityCategoryRequest,
  ActivityType,
} from "../types/activityCategory"
import { CategoryTypeField } from "./categoryTypeField"
import { TextField } from "./textField"
import { WeatherLimitFields } from "./weatherLimitFields"
import type { WeatherLimitValues } from "./weatherLimitFields"

interface CategoryFormProps {
  // null opens the create form.
  category: ActivityCategory | null
  onSaved: (category: ActivityCategory) => void
  onCancel: () => void
}

function numberText(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value)
}

function initialLimits(category: ActivityCategory | null): WeatherLimitValues {
  return {
    maxWindMs: numberText(category?.maxWindMs),
    maxRainMmPerHour: numberText(category?.maxRainMmPerHour),
    minTemperatureC: numberText(category?.minTemperatureC),
    maxTemperatureC: numberText(category?.maxTemperatureC),
  }
}

export function CategoryForm({
  category,
  onSaved,
  onCancel,
}: CategoryFormProps) {
  const status = useCategoryFormStore((state) => state.status)
  const errors = useCategoryFormStore((state) => state.errors)
  const submit = useCategoryFormStore((state) => state.submit)
  const retry = useCategoryFormStore((state) => state.retry)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const [name, setName] = useState(category?.name ?? "")
  const [type, setType] = useState<ActivityType | null>(category?.type ?? null)
  const [duration, setDuration] = useState(
    numberText(category?.defaultDurationHours),
  )
  const [limits, setLimits] = useState(() => initialLimits(category))
  const [requiresDaylight, setRequiresDaylight] = useState(
    category?.requiresDaylight ?? false,
  )
  const [placeTags, setPlaceTags] = useState(
    category?.placeTags.join(", ") ?? "",
  )
  const pending = status === "pending"
  const outdoor = type === "Outdoor"

  // Focusing the heading also scrolls it into view, so the form is seen when it opens (FR-013).
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  function toRequest(): ActivityCategoryRequest {
    // The name and tags are sent exactly as typed, so the server applies the 200-character
    // limit to the text as entered (FR-009). An Indoor category has no weather limits (FR-007).
    return {
      name,
      type,
      defaultDurationHours: parseDecimal(duration),
      requiresDaylight,
      maxWindMs: outdoor ? parseDecimal(limits.maxWindMs) : null,
      maxRainMmPerHour: outdoor ? parseDecimal(limits.maxRainMmPerHour) : null,
      minTemperatureC: outdoor ? parseDecimal(limits.minTemperatureC) : null,
      maxTemperatureC: outdoor ? parseDecimal(limits.maxTemperatureC) : null,
      placeTags,
    }
  }

  function finish(saved: ActivityCategory | undefined) {
    if (saved) {
      onSaved(saved)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    finish(await submit(toRequest()))
  }

  return (
    <section className="category-form" aria-labelledby="category-form-heading">
      <h2 id="category-form-heading" ref={headingRef} tabIndex={-1}>
        {category ? `Edit ${category.name}` : "Create category"}
      </h2>
      {/* noValidate: the browser's own bubbles must never replace the server's messages. */}
      <form noValidate onSubmit={(event) => void save(event)}>
        <TextField
          id="category-name"
          label="Name"
          type="text"
          autoComplete="off"
          value={name}
          error={errors.name}
          onChange={setName}
        />
        <CategoryTypeField value={type} error={errors.type} onChange={setType} />
        <TextField
          id="category-defaultDurationHours"
          label="Default duration (h)"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          hint="0.5 to 12, in steps of 0.5"
          value={duration}
          error={errors.defaultDurationHours}
          onChange={setDuration}
        />
        {outdoor && (
          <WeatherLimitFields
            values={limits}
            errors={errors}
            onChange={(field, value) =>
              setLimits((current) => ({ ...current, [field]: value }))
            }
          />
        )}
        <div className="form-field checkbox-field">
          <input
            id="category-requiresDaylight"
            type="checkbox"
            checked={requiresDaylight}
            onChange={(event) => setRequiresDaylight(event.target.checked)}
          />
          <label htmlFor="category-requiresDaylight">Requires daylight</label>
        </div>
        <TextField
          id="category-placeTags"
          label="Map place tags"
          type="text"
          autoComplete="off"
          hint="key=value pairs separated by commas, for example leisure=slipway"
          value={placeTags}
          error={errors.placeTags}
          onChange={setPlaceTags}
        />
        <div className="form-actions">
          <button type="submit" disabled={pending}>
            Save
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        {/* Always rendered, so screen readers announce the text when it appears. */}
        <p role="status" className="loading-status">
          {pending ? "Saving category…" : ""}
        </p>
        {/* A server error keeps every value, so Retry sends the same request. */}
        {status === "serverError" && (
          <div className="server-error">
            <p role="alert">
              {formatErrorMessage("Something went wrong. Try again.")}
            </p>
            <button type="button" onClick={() => void retry().then(finish)}>
              Retry
            </button>
          </div>
        )}
      </form>
    </section>
  )
}
