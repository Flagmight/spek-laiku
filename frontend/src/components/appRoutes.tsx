import { Route, Routes } from "react-router-dom"
import { AccountSuspendedPage } from "../pages/AccountSuspendedPage"
import { ActivitySelectionPage } from "../pages/ActivitySelectionPage"
import { ActivityCategoriesPage } from "../pages/ActivityCategoriesPage"
import { HomePage } from "../pages/HomePage"
import { LoginPage } from "../pages/LoginPage"
import { PlanSetupPage } from "../pages/PlanSetupPage"
import { RegisterPage } from "../pages/RegisterPage"
import { AdministratorOnly } from "./administratorOnly"
import { Layout } from "./layout"
import { PlanCreatorOnly } from "./planCreatorOnly"
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
