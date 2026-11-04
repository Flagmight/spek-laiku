import { useState } from "react"
import type { KeyboardEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { useLocationSearchStore } from "../stores/useLocationSearchStore"
import type { LocationSearchStatus } from "../stores/useLocationSearchStore"
import { locationLabel, usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { PlanLocation } from "../types/planSetup"

export const locationInputId = "location"
const listId = "location-options"
const statusId = "location-status"
const errorId = "location-error"

function optionId(location: PlanLocation) {
  return `location-option-${location.id}`
}

// What the status region says for each search state (spec FR-007).
function statusText(status: LocationSearchStatus, count: number) {
  switch (status) {
    case "loading":
      return "Searching locations…"
    case "loaded":
      return count === 1 ? "1 location found" : `${count} locations found`
    case "empty":
      return "No location found. Check the spelling or try a larger town."
    default:
      return ""
  }
}

function alertText(status: LocationSearchStatus) {
  switch (status) {
    case "unavailable":
      return formatErrorMessage(
        "Location search is unavailable. Try again later.",
      )
    case "tooManyRequests":
      return formatErrorMessage(
        "Too many requests. Wait a minute and try again.",
      )
    default:
      return ""
  }
}

// Location: an ARIA 1.2 combobox (research section 11). Only a place chosen from the suggestions
// becomes the plan's location; typing clears it (spec FR-006). The arrow keys move through the
// suggestions, Enter chooses, Escape closes, and a click or tap chooses.
export function LocationSearchField({ error }: { error?: string }) {
  const locationText = usePlanSetupStore((state) => state.locationText)
  const status = useLocationSearchStore((state) => state.status)
  const results = useLocationSearchStore((state) => state.results)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)

  const listOpen = open && status === "loaded" && results.length > 0
  const active = listOpen && highlighted < results.length ? highlighted : -1
  const describedBy = [statusId, error && errorId].filter(Boolean).join(" ")

  function changeText(text: string) {
    usePlanSetupStore.getState().setLocationText(text)
    useLocationSearchStore.getState().queryChanged(text)
    setOpen(true)
    setHighlighted(-1)
  }

  function choose(location: PlanLocation) {
    usePlanSetupStore.getState().chooseLocation(location)
    useLocationSearchStore.getState().reset()
    setOpen(false)
    setHighlighted(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results.length
    if (event.key === "ArrowDown" && status === "loaded" && count > 0) {
      event.preventDefault()
      setOpen(true)
      setHighlighted(listOpen ? (active + 1) % count : 0)
    } else if (event.key === "ArrowUp" && listOpen) {
      event.preventDefault()
      setHighlighted(active <= 0 ? count - 1 : active - 1)
    } else if (event.key === "Enter" && active >= 0) {
      // Choosing must not also submit the form around the field.
      event.preventDefault()
      choose(results[active])
    } else if (event.key === "Escape" && listOpen) {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="form-field location-field">
      <label htmlFor={locationInputId}>Location</label>
      <input
        id={locationInputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-activedescendant={
          active >= 0 ? optionId(results[active]) : undefined
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        maxLength={100}
        value={locationText}
        onChange={(event) => changeText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Location suggestions"
        className="location-options"
        hidden={!listOpen}
      >
        {listOpen &&
          results.map((location, index) => (
            <li
              key={location.id}
              id={optionId(location)}
              role="option"
              aria-selected={index === active}
              // Keeps focus in the input, so the blur does not close the list before the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(location)}
            >
              {locationLabel(location)}
            </li>
          ))}
      </ul>
      <p id={statusId} role="status" className="field-hint">
        {statusText(status, results.length)}
      </p>
      <div role="alert" className="field-error">
        {alertText(status)}
      </div>
      {error && (
        <p id={errorId} className="field-error">
          {formatErrorMessage(error)}
        </p>
      )}
    </div>
  )
}
