import { Route, Routes } from "react-router-dom"
import { AccountSuspendedPage } from "../pages/AccountSuspendedPage"
import { ActivityCategoriesPage } from "../pages/ActivityCategoriesPage"
import { HomePage } from "../pages/HomePage"
import { LoginPage } from "../pages/LoginPage"
import { PlanSetupPage } from "../pages/PlanSetupPage"
import { RegisterPage } from "../pages/RegisterPage"
import { AdministratorOnly } from "./administratorOnly"
import { Layout } from "./layout"
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
        <Route path="plan/setup" element={<PlanSetupPage />} />
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
