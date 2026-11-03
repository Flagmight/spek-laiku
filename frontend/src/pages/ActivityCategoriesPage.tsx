import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CategoryForm } from "../components/categoryForm"
import { CategoryList } from "../components/categoryList"
import { usePageTitle } from "../hooks/usePageTitle"
import { useActivityCategoriesStore } from "../stores/useActivityCategoriesStore"
import { useCategoryFormStore } from "../stores/useCategoryFormStore"
import type { NavigationState } from "../types/navigationState"

// Which form is open: none, the create form, or (US2) the edit form for a category id.
type OpenForm = { kind: "none" } | { kind: "create" }

export function ActivityCategoriesPage() {
  usePageTitle("Activity categories")
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const status = useActivityCategoriesStore((state) => state.status)
  const [openForm, setOpenForm] = useState<OpenForm>({ kind: "none" })

  // The stores outlive the page, so leaving it aborts pending requests and the next visit starts fresh.
  useEffect(() => {
    void useActivityCategoriesStore.getState().load()
    return () => {
      useActivityCategoriesStore.getState().reset()
      useCategoryFormStore.getState().reset()
    }
  }, [])

  function openCreateForm() {
    useCategoryFormStore.getState().reset()
    setOpenForm({ kind: "create" })
  }

  function closeForm() {
    useCategoryFormStore.getState().reset()
    setOpenForm({ kind: "none" })
  }

  function saved() {
    closeForm()
    // The layout's banner shows the message until it is dismissed (FR-012).
    const state: NavigationState = { successMessage: "Category saved." }
    navigate(pathname, { replace: true, state })
  }

  return (
    <>
      <h1>Activity categories</h1>
      {status === "loaded" && (
        <button type="button" onClick={openCreateForm}>
          Create category
        </button>
      )}
      <div className="categories-layout">
        <div className="categories-list-part">
          {/* US2 opens the edit form from here. */}
          <CategoryList onEdit={() => {}} />
        </div>
        {openForm.kind === "create" && (
          <div className="categories-form-part">
            <CategoryForm
              category={null}
              onSaved={saved}
              onCancel={closeForm}
            />
          </div>
        )}
      </div>
    </>
  )
}
