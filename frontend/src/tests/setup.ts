import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import { useActivityCategoriesStore } from "../stores/useActivityCategoriesStore"
import { useCategoryFormStore } from "../stores/useCategoryFormStore"
import {
  initialCurrentUserState,
  useCurrentUserStore,
} from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { useLoginStore } from "../stores/useLoginStore"
import { useLocationSearchStore } from "../stores/useLocationSearchStore"
import { useLogoutStore } from "../stores/useLogoutStore"
import { usePlanActionsStore } from "../stores/usePlanActionsStore"
import { usePlanActivitiesCheckStore } from "../stores/usePlanActivitiesCheckStore"
import {
  initialPlanEditState,
  usePlanEditStore,
} from "../stores/usePlanEditStore"
import {
  initialPlanActivitiesState,
  usePlanActivitiesStore,
} from "../stores/usePlanActivitiesStore"
import { usePlanCategoriesStore } from "../stores/usePlanCategoriesStore"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
import { usePlanPeriodStore } from "../stores/usePlanPeriodStore"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"
import { usePlanScheduleStore } from "../stores/usePlanScheduleStore"
import { usePlanSetupCheckStore } from "../stores/usePlanSetupCheckStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import { useRegistrationStore } from "../stores/useRegistrationStore"
import { useRenamePlanStore } from "../stores/useRenamePlanStore"
import { useSavePlanStore } from "../stores/useSavePlanStore"
import { useSavedPlanStore } from "../stores/useSavedPlanStore"
import { useSavedPlansStore } from "../stores/useSavedPlansStore"

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
  usePlanSetupCheckStore.getState().reset()
  useLocationSearchStore.getState().reset()
  usePlanSetupStore.getState().clear()
  usePlanActivitiesStore.setState(initialPlanActivitiesState)
  usePlanCategoriesStore.getState().reset()
  usePlanActivitiesCheckStore.getState().reset()
  usePlanForecastStore.getState().reset()
  usePlanPlacesStore.getState().reset()
  usePlanScheduleStore.getState().reset()
  useSavePlanStore.getState().reset()
  useKeptScheduleStore.getState().clear()
  useSavedPlansStore.getState().reset()
  useSavedPlanStore.getState().reset()
  usePlanCheckStore.getState().reset()
  usePlanActionsStore.getState().reset()
  usePlanEditStore.setState(initialPlanEditState)
  useRenamePlanStore.getState().reset()
  // The plan setup store saves itself to sessionStorage; nothing may carry over to the next test.
  sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
