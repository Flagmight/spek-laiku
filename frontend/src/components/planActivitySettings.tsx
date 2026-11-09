import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { activityFieldId } from "../helpers/planActivityFieldIds"
import type { PlanActivityChanges } from "../stores/usePlanActivitiesStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import type { PlanActivity, PlanActivityField } from "../types/planActivity"
import { TextField } from "./textField"
import { WeatherLimitFields } from "./weatherLimitFields"
import type { WeatherLimitValues } from "./weatherLimitFields"

interface PlanActivitySettingsProps {
  activity: PlanActivity
  // "Cycling 2" when the category appears more than once.
  shownName: string
  errors: Partial<Record<PlanActivityField, string>>
  onRemove: () => void
}

const limitChanges: Record<
  keyof WeatherLimitValues,
  (value: string) => PlanActivityChanges
> = {
  maxWindMs: (maxWindText) => ({ maxWindText }),
  maxRainMmPerHour: (maxRainText) => ({ maxRainText }),
  minTemperatureC: (minTemperatureText) => ({ minTemperatureText }),
  maxTemperatureC: (maxTemperatureText) => ({ maxTemperatureText }),
}

// One activity's settings for this plan only (Form 4, spec FR-008, FR-010).
export function PlanActivitySettings({
  activity,
  shownName,
  errors,
  onRemove,
}: PlanActivitySettingsProps) {
  const groupId = activityFieldId(activity.id, "activity")
  const errorId = `${groupId}-error`

  function update(changes: PlanActivityChanges) {
    usePlanActivitiesStore.getState().update(activity.id, changes)
  }

  return (
    // tabIndex: the error summary and the first-error focus can move here for a whole-activity message.
    <fieldset
      id={groupId}
      className="form-field"
      tabIndex={-1}
      aria-describedby={errors.activity ? errorId : undefined}
    >
      <legend>
        <h3 id={`${groupId}-heading`} tabIndex={-1}>
          {shownName}
        </h3>
      </legend>
      {errors.activity && (
        <p id={errorId} className="field-error">
          {formatErrorMessage(errors.activity)}
        </p>
      )}
      <TextField
        id={activityFieldId(activity.id, "durationHours")}
        label="Duration (h)"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        hint="0.5 to 12"
        value={activity.durationText}
        error={errors.durationHours}
        onChange={(durationText) => update({ durationText })}
      />
      <div className="form-field checkbox-field">
        <input
          id={`${groupId}-requiresDaylight`}
          type="checkbox"
          checked={activity.requiresDaylight}
          onChange={(event) =>
            update({ requiresDaylight: event.target.checked })
          }
        />
        <label htmlFor={`${groupId}-requiresDaylight`}>Requires daylight</label>
      </div>
      {activity.type === "Outdoor" && (
        <WeatherLimitFields
          idPrefix={groupId}
          values={{
            maxWindMs: activity.maxWindText,
            maxRainMmPerHour: activity.maxRainText,
            minTemperatureC: activity.minTemperatureText,
            maxTemperatureC: activity.maxTemperatureText,
          }}
          errors={errors}
          onChange={(field, value) => update(limitChanges[field](value))}
        />
      )}
      <button
        type="button"
        aria-label={`Remove ${shownName}`}
        onClick={onRemove}
      >
        Remove
      </button>
    </fieldset>
  )
}
