import { Link } from "react-router-dom"

interface PlanStep {
  name: string
  // Only steps whose page exists can be links; later features add theirs.
  path?: string
}

const steps: PlanStep[] = [
  { name: "Plan setup", path: "/plan/setup" },
  { name: "Activities", path: "/plan/activities" },
  { name: "Places and forecast" },
  { name: "Schedule" },
]

// The four plan steps (spec FR-020). Completed steps are links back, the current step is marked for
// assistive technology, and later steps cannot be selected. Phones show the compact
// "Step n of 4: <name>" line instead of the list (styles.css); it is hidden from screen readers so
// the steps are read once.
export function PlanProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="Plan progress" className="plan-progress">
      <ol>
        {steps.map((step, index) => {
          const number = index + 1
          if (number === current) {
            return (
              <li key={step.name}>
                <span aria-current="step">{step.name}</span>
              </li>
            )
          }

          return (
            <li key={step.name}>
              {number < current && step.path ? (
                <Link to={step.path}>{step.name}</Link>
              ) : (
                <span>{step.name}</span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="plan-progress-compact" aria-hidden="true">
        Step {current} of {steps.length}: {steps[current - 1].name}
        <span className="plan-progress-segments">
          {steps.map((step, index) => (
            <span
              key={step.name}
              className={index < current ? "done" : undefined}
            />
          ))}
        </span>
      </p>
    </nav>
  )
}
