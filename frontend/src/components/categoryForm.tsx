import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import {
  categoryFieldErrors,
  categoryFormValues,
  categoryRequest,
} from "../helpers/categoryFormValues"
import type { CategoryFormValues } from "../helpers/categoryFormValues"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { useCategoryFormStore } from "../stores/useCategoryFormStore"
import type { ActivityCategory } from "../types/activityCategory"
import { CategoryTypeField } from "./categoryTypeField"
import { ErrorSummary } from "./errorSummary"
import { TextField } from "./textField"
import { WeatherLimitFields } from "./weatherLimitFields"

interface CategoryFormProps {
  // null opens the create form.
  category: ActivityCategory | null
  onSaved: (category: ActivityCategory) => void
  onCancel: () => void
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
  const reloadCategory = useCategoryFormStore((state) => state.reloadCategory)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [values, setValues] = useState(() => categoryFormValues(category))
  // The version saves are compared against: the opened one, or the reloaded one (FR-026).
  const [version, setVersion] = useState(category?.version ?? 0)
  const pending = status === "pending"
  const heading = category ? `Edit ${category.name}` : "Create category"

  // Focusing the heading also scrolls it into view, so the form is seen when it opens (FR-013).
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // After refused values, focus the first invalid field (FR-011). errors is a new object after
  // every refused save, so focus moves each time.
  useEffect(() => {
    if (status === "invalid") {
      const [first] = categoryFieldErrors(errors)
      if (first) {
        document.getElementById(first.fieldId)?.focus()
      }
    }
  }, [status, errors])

  function change<K extends keyof CategoryFormValues>(
    field: K,
    value: CategoryFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function finish(saved: ActivityCategory | undefined) {
    if (saved) {
      onSaved(saved)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = category ? { id: category.id, version } : undefined
    finish(await submit(categoryRequest(values), target))
  }

  async function reload() {
    if (!category) {
      return
    }

    const stored = await reloadCategory(category.id)
    if (stored) {
      setValues(categoryFormValues(stored))
      setVersion(stored.version)
    }
  }

  return (
    <section className="category-form" aria-labelledby="category-form-heading">
      <h2 id="category-form-heading" ref={headingRef} tabIndex={-1}>
        {heading}
      </h2>
      {/* noValidate: the browser's own bubbles must never replace the server's messages. */}
      <form noValidate onSubmit={(event) => void save(event)}>
        {status === "conflict" && (
          <div role="alert" className="form-error">
            <p>
              {formatErrorMessage(
                "This category was changed by someone else. Reload it and try again.",
              )}
            </p>
            <button type="button" onClick={() => void reload()}>
              Reload
            </button>
          </div>
        )}
        <ErrorSummary errors={categoryFieldErrors(errors)} />
        <TextField
          id="category-name"
          label="Name"
          type="text"
          autoComplete="off"
          value={values.name}
          error={errors.name}
          onChange={(value) => change("name", value)}
        />
        <CategoryTypeField
          value={values.type}
          error={errors.type}
          onChange={(value) => change("type", value)}
        />
        <TextField
          id="category-defaultDurationHours"
          label="Default duration (h)"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          hint="0.5 to 12, in steps of 0.5"
          value={values.duration}
          error={errors.defaultDurationHours}
          onChange={(value) => change("duration", value)}
        />
        {values.type === "Outdoor" && (
          <WeatherLimitFields values={values} errors={errors} onChange={change} />
        )}
        <div className="form-field checkbox-field">
          <input
            id="category-requiresDaylight"
            type="checkbox"
            checked={values.requiresDaylight}
            onChange={(event) => change("requiresDaylight", event.target.checked)}
          />
          <label htmlFor="category-requiresDaylight">Requires daylight</label>
        </div>
        <TextField
          id="category-placeTags"
          label="Map place tags"
          type="text"
          autoComplete="off"
          hint="key=value pairs separated by commas, for example leisure=slipway"
          value={values.placeTags}
          error={errors.placeTags}
          onChange={(value) => change("placeTags", value)}
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
