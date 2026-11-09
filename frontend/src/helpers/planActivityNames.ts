// The name shown for each activity, by activity id: the category name when the category appears once,
// otherwise "<name> <n>" in list order among that category's activities (research section 3). It is
// worked out from the list and never stored, so the numbers follow the remaining activities.
export function planActivityNames(
  activities: { id: string; categoryId: string; name: string }[],
): Record<string, string> {
  const totals = new Map<string, number>()
  for (const { categoryId } of activities) {
    totals.set(categoryId, (totals.get(categoryId) ?? 0) + 1)
  }

  const names: Record<string, string> = {}
  const numbered = new Map<string, number>()
  for (const { id, categoryId, name } of activities) {
    if (totals.get(categoryId) === 1) {
      names[id] = name
      continue
    }

    const number = (numbered.get(categoryId) ?? 0) + 1
    numbered.set(categoryId, number)
    names[id] = `${name} ${number}`
  }

  return names
}
