import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import {
  initialCurrentUserState,
  useCurrentUserStore,
} from "../stores/useCurrentUserStore"
import { useRegistrationStore } from "../stores/useRegistrationStore"

afterEach(() => {
  cleanup()
  // The stores are module-level, so each test starts from the initial state.
  useCurrentUserStore.setState(initialCurrentUserState)
  useRegistrationStore.getState().reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
