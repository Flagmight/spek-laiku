import { describe, expect, it } from "vitest"
import { clearSignedInData } from "../helpers/clearSignedInData"
import {
  initialAccountStatusState,
  useAccountStatusStore,
} from "../stores/useAccountStatusStore"
import {
  initialAdminAccountsState,
  useAdminAccountsStore,
} from "../stores/useAdminAccountsStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import {
  initialPlanSetupState,
  usePlanSetupStore,
} from "../stores/usePlanSetupStore"
import { activeUser } from "./adminAccountsFixtures"
import { signedInUser } from "./renderApp"

// The data of a session that ended on purpose, shared by logout and account deletion (feature 016 research
// section 11). useLogoutStore.test.tsx checks the same through logout.
describe("clearSignedInData", () => {
  it("signs the user out without marking the session as expired", () => {
    useCurrentUserStore.getState().setSignedIn(signedInUser())

    clearSignedInData()

    expect(useCurrentUserStore.getState()).toMatchObject({
      status: "signedOut",
      user: null,
      sessionExpired: false,
    })
  })

  it("clears the plan in progress, a kept schedule and an edit", () => {
    usePlanSetupStore.getState().setLocationText("Kaunas")
    usePlanSetupStore.getState().addDate("2026-11-28")
    useKeptScheduleStore.setState({
      kept: {
        key: "plan",
        schedule: {
          generatedScheduleId: null,
          scheduled: [],
          unscheduled: [],
          travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
        },
      },
    })
    usePlanEditStore.setState({
      edit: {
        planId: "plan-1",
        planName: "Weekend in Kaunas",
        ownerEmail: "user@example.com",
      },
      savedPlanKey: "saved",
    })

    clearSignedInData()

    expect(usePlanSetupStore.getState()).toMatchObject(initialPlanSetupState)
    expect(useKeptScheduleStore.getState().kept).toBeNull()
    expect(usePlanEditStore.getState().edit).toBeNull()
    expect(usePlanEditStore.getState().savedPlanKey).toBeNull()
  })

  it("resets the administrator's account list and status change", () => {
    useAdminAccountsStore.setState({
      status: "loaded",
      accounts: [activeUser],
      search: "ana",
    })
    useAccountStatusStore.setState({ notice: "✓ Success: Account suspended." })

    clearSignedInData()

    expect(useAdminAccountsStore.getState()).toMatchObject(
      initialAdminAccountsState,
    )
    expect(useAccountStatusStore.getState()).toMatchObject(
      initialAccountStatusState,
    )
  })
})
