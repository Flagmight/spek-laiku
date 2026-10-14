import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AppRoutes } from "./components/appRoutes"
import { CurrentUserProvider } from "./components/currentUserProvider"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element was not found.")
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <CurrentUserProvider>
        <AppRoutes />
      </CurrentUserProvider>
    </BrowserRouter>
  </StrictMode>,
)
