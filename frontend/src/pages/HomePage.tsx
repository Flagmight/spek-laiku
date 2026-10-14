import { usePageTitle } from "../hooks/usePageTitle"

export function HomePage() {
  usePageTitle("Home")

  return <h1>Spėk laiku</h1>
}
