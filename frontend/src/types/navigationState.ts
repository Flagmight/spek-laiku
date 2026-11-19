// Router state passed with navigate(); the layout shows successMessage in the banner.
export interface NavigationState {
  successMessage?: string
  // Why the user was sent to log in; the Log in page shows the matching message (FR-020).
  loginReason?: "required" | "expired"
  // Set by step 3's "Change activity": Activity selection moves focus to that activity once (feature 007
  // FR-021).
  focusActivityId?: string
  // Set after a delete or duplicate from the plan page; My plans or the copy's page shows "Plan deleted." or
  // "Plan duplicated." in its own status region (feature 011 research section 12).
  planNotice?: "deleted" | "duplicated"
}
