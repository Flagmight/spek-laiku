import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { useActivityCategoriesStore } from "../stores/useActivityCategoriesStore"
import type { ActivityCategory } from "../types/activityCategory"

interface CategoryListProps {
  onEdit: (category: ActivityCategory) => void
}

// The categories in the order the API returns them (alphabetical), each with an Edit button.
export function CategoryList({ onEdit }: CategoryListProps) {
  const status = useActivityCategoriesStore((state) => state.status)
  const categories = useActivityCategoriesStore((state) => state.categories)
  const load = useActivityCategoriesStore((state) => state.load)

  if (status === "loading") {
    return <p role="status">Loading activity categories…</p>
  }

  if (status === "error") {
    return (
      <div role="alert" className="server-error">
        <p>{formatErrorMessage("Activity categories could not be loaded.")}</p>
        <button type="button" onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  if (categories.length === 0) {
    return <p>No categories yet. Create the first category.</p>
  }

  return (
    <ul aria-label="Activity categories" className="category-list">
      {categories.map((category) => (
        <li key={category.id}>
          <span className="category-name">{category.name}</span>
          <span className="category-type">{category.type}</span>
          <button
            type="button"
            aria-label={`Edit ${category.name}`}
            onClick={() => onEdit(category)}
          >
            Edit
          </button>
        </li>
      ))}
    </ul>
  )
}
