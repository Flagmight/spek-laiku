import { useAccountDeletionStore } from "../stores/useAccountDeletionStore"
import { useAccountStatusStore } from "../stores/useAccountStatusStore"
import { useAdminAccountsStore } from "../stores/useAdminAccountsStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

// Everything that belongs to a session that ended on purpose: logout (feature 002) and account deletion
// (feature 016, research section 11). A later feature that keeps session data adds its store here.
export function clearSignedInData(): void {
  // Signed out on purpose, so a protected page later says "Log in to continue.", not expired.
  useCurrentUserStore.getState().setSignedOut()
  // The plan in progress belongs to the session that ended (feature 004, spec FR-017).
  usePlanSetupStore.getState().clear()
  // The activities go with it (feature 005, spec FR-019).
  usePlanActivitiesStore.getState().clear()
  // And a schedule kept for saving after login (feature 010, spec FR-007).
  useKeptScheduleStore.getState().clear()
  // And an edit of a saved plan with the saved marker (feature 011, spec FR-013).
  usePlanEditStore.getState().clearAll()
  // And the administrator's account list and any status change in progress (feature 014).
  useAdminAccountsStore.getState().reset()
  useAccountStatusStore.getState().reset()
  // And the account deletion dialog with any password typed into it (feature 016, research section 14).
  useAccountDeletionStore.getState().reset()
}
