import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import { useActivityCategoriesStore } from "../stores/useActivityCategoriesStore"
import { useCategoryFormStore } from "../stores/useCategoryFormStore"
import {
  initialCurrentUserState,
  useCurrentUserStore,
} from "../stores/useCurrentUserStore"
import { useLoginStore } from "../stores/useLoginStore"
import { useLocationSearchStore } from "../stores/useLocationSearchStore"
import { useLogoutStore } from "../stores/useLogoutStore"
import { usePlanPeriodStore } from "../stores/usePlanPeriodStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import { useRegistrationStore } from "../stores/useRegistrationStore"

afterEach(() => {
  cleanup()
  // The stores are module-level, so each test starts from the initial state.
  useCurrentUserStore.setState(initialCurrentUserState)
  useRegistrationStore.getState().reset()
  useLoginStore.getState().reset()
  useLogoutStore.getState().reset()
  useActivityCategoriesStore.getState().reset()
  useCategoryFormStore.getState().reset()
  usePlanPeriodStore.getState().reset()
  useLocationSearchStore.getState().reset()
  usePlanSetupStore.getState().clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
