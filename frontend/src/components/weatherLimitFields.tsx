import type { ActivityCategoryFieldErrors } from "../types/activityCategory"
import { TextField } from "./textField"

export interface WeatherLimitValues {
  maxWindMs: string
  maxRainMmPerHour: string
  minTemperatureC: string
  maxTemperatureC: string
}

interface WeatherLimitFieldsProps {
  values: WeatherLimitValues
  errors: ActivityCategoryFieldErrors
  onChange: (field: keyof WeatherLimitValues, value: string) => void
}

const fields: {
  field: keyof WeatherLimitValues
  label: string
  hint: string
}[] = [
  { field: "maxWindMs", label: "Max wind (m/s)", hint: "0 to 30" },
  { field: "maxRainMmPerHour", label: "Max rain (mm/h)", hint: "0 to 20" },
  { field: "minTemperatureC", label: "Min temperature (°C)", hint: "-30 to 45" },
  { field: "maxTemperatureC", label: "Max temperature (°C)", hint: "-30 to 45" },
]

// The four weather limits of an Outdoor category, typed as text so the server gives the range
// message for anything that is not a number (research section 6).
export function WeatherLimitFields({
  values,
  errors,
  onChange,
}: WeatherLimitFieldsProps) {
  return (
    <>
      {fields.map(({ field, label, hint }) => (
        <TextField
          key={field}
          id={`category-${field}`}
          label={label}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          hint={hint}
          value={values[field]}
          error={errors[field]}
          onChange={(value) => onChange(field, value)}
        />
      ))}
    </>
  )
}
