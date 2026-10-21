import { Route, Routes } from "react-router-dom"
import { HomePage } from "../pages/HomePage"
import { RegisterPage } from "../pages/RegisterPage"
import { Layout } from "./layout"
import { SignedOutOnly } from "./signedOutOnly"

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
      </Route>
    </Routes>
  )
}
