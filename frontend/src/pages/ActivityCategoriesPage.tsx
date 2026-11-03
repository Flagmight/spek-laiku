import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CategoryForm } from "../components/categoryForm"
import { CategoryList } from "../components/categoryList"
import { usePageTitle } from "../hooks/usePageTitle"
import { useActivityCategoriesStore } from "../stores/useActivityCategoriesStore"
import { useCategoryFormStore } from "../stores/useCategoryFormStore"
import type { ActivityCategory } from "../types/activityCategory"
import type { NavigationState } from "../types/navigationState"

// Which form is open: none, the create form, or the edit form. The edit form keeps the category
// as selected, so it stays open with its message when a reload of the list no longer has it.
type OpenForm =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; category: ActivityCategory }

export function ActivityCategoriesPage() {
  usePageTitle("Activity categories")
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const status = useActivityCategoriesStore((state) => state.status)
  const [openForm, setOpenForm] = useState<OpenForm>({ kind: "none" })
  const editing = openForm.kind === "edit" ? openForm.category : null

  // The stores outlive the page, so leaving it aborts pending requests and the next visit starts fresh.
  useEffect(() => {
    void useActivityCategoriesStore.getState().load()
    return () => {
      useActivityCategoriesStore.getState().reset()
      useCategoryFormStore.getState().reset()
    }
  }, [])

  // Opening a form replaces any open one without a warning (spec Edge Cases).
  function open(form: OpenForm) {
    useCategoryFormStore.getState().reset()
    setOpenForm(form)
  }

  function closeForm() {
    open({ kind: "none" })
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
        <button type="button" onClick={() => open({ kind: "create" })}>
          Create category
        </button>
      )}
      {/* Two columns on wider screens only while a form is open (styles.css). */}
      <div
        className={
          openForm.kind === "none"
            ? "categories-layout"
            : "categories-layout with-form"
        }
      >
        <div className="categories-list-part">
          <CategoryList
            onEdit={(category) => open({ kind: "edit", category })}
          />
        </div>
        {openForm.kind !== "none" && (
          <div className="categories-form-part">
            {/* A new key mounts a fresh form, so its fields and focus start from the selection. */}
            <CategoryForm
              key={editing?.id ?? "create"}
              category={editing}
              onSaved={saved}
              onCancel={closeForm}
            />
          </div>
        )}
      </div>
    </>
  )
}
