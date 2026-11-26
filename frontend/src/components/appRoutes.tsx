import { Route, Routes } from "react-router-dom"
import { AccountPage } from "../pages/AccountPage"
import { AccountSuspendedPage } from "../pages/AccountSuspendedPage"
import { ActivitySelectionPage } from "../pages/ActivitySelectionPage"
import { ActivityCategoriesPage } from "../pages/ActivityCategoriesPage"
import { HomePage } from "../pages/HomePage"
import { LoginPage } from "../pages/LoginPage"
import { MyPlansPage } from "../pages/MyPlansPage"
import { PlacesAndForecastPage } from "../pages/PlacesAndForecastPage"
import { PlanDetailsPage } from "../pages/PlanDetailsPage"
import { PlanSetupPage } from "../pages/PlanSetupPage"
import { ScheduleOverviewPage } from "../pages/ScheduleOverviewPage"
import { RegisterPage } from "../pages/RegisterPage"
import { UserAccountsPage } from "../pages/UserAccountsPage"
import { AdministratorOnly } from "./administratorOnly"
import { Layout } from "./layout"
import { PlanCreatorOnly } from "./planCreatorOnly"
import { RegisteredUserOnly } from "./registeredUserOnly"
import { SignedInOnly } from "./signedInOnly"
import { SignedOutOnly } from "./signedOutOnly"
import { SuspendedOnly } from "./suspendedOnly"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route
          path="register"
          element={
            <SignedOutOnly>
              <RegisterPage />
            </SignedOutOnly>
          }
        />
        <Route
          path="login"
          element={
            <SignedOutOnly>
              <LoginPage />
            </SignedOutOnly>
          }
        />
        <Route
          path="plan/setup"
          element={
            <PlanCreatorOnly>
              <PlanSetupPage />
            </PlanCreatorOnly>
          }
        />
        <Route
          path="plan/activities"
          element={
            <PlanCreatorOnly>
              <ActivitySelectionPage />
            </PlanCreatorOnly>
          }
        />
        <Route
          path="plan/places"
          element={
            <PlanCreatorOnly>
              <PlacesAndForecastPage />
            </PlanCreatorOnly>
          }
        />
        <Route
          path="plan/schedule"
          element={
            <PlanCreatorOnly>
              <ScheduleOverviewPage />
            </PlanCreatorOnly>
          }
        />
        <Route
          path="plans"
          element={
            <SignedInOnly>
              <RegisteredUserOnly>
                <MyPlansPage />
              </RegisteredUserOnly>
            </SignedInOnly>
          }
        />
        <Route
          path="plans/:planId"
          element={
            <SignedInOnly>
              <RegisteredUserOnly>
                <PlanDetailsPage />
              </RegisteredUserOnly>
            </SignedInOnly>
          }
        />
        <Route
          path="account"
          element={
            <SignedInOnly>
              <RegisteredUserOnly>
                <AccountPage />
              </RegisteredUserOnly>
            </SignedInOnly>
          }
        />
        <Route
          path="admin/categories"
          element={
            <SignedInOnly>
              <AdministratorOnly>
                <ActivityCategoriesPage />
              </AdministratorOnly>
            </SignedInOnly>
          }
        />
        <Route
          path="admin/users"
          element={
            <SignedInOnly>
              <AdministratorOnly>
                <UserAccountsPage />
              </AdministratorOnly>
            </SignedInOnly>
          }
        />
        <Route
          path="account-suspended"
          element={
            <SuspendedOnly>
              <AccountSuspendedPage />
            </SuspendedOnly>
          }
        />
      </Route>
    </Routes>
  )
}
