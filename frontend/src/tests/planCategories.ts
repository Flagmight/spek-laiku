import { fireEvent, screen } from "@testing-library/react"

// Waits until the Activity selection categories have loaded, whether their list is open or closed
// (feature 005 FR-023).
export function categoriesLoaded() {
  return screen.findAllByRole("button", { name: /^Add /, hidden: true })
}

// Waits for the categories and opens their list when it starts closed because the plan already has
// activities.
export async function openCategories() {
  await categoriesLoaded()
  const toggle = screen.getByRole("button", { name: "Activity categories" })
  if (toggle.getAttribute("aria-expanded") === "false") {
    fireEvent.click(toggle)
  }
}
