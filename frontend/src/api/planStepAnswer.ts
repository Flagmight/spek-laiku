// How both step 3 APIs, the forecast and the places, read a 400 or 503 answer, so the two requests treat an
// out-of-date plan and a failed service the same way (feature 007 research section 2).

// Which part of the plan a 400 answer refuses, or undefined when it names neither.
export async function outdatedPart(
  response: Response,
): Promise<"setupOutdated" | "activitiesOutdated" | undefined> {
  let keys: string[]
  try {
    const problem = (await response.json()) as { errors?: object }
    keys = Object.keys(problem.errors ?? {})
  } catch {
    return undefined
  }

  if (keys.some((key) => key.startsWith("setup"))) {
    return "setupOutdated"
  }

  return keys.some((key) => key.startsWith("activities"))
    ? "activitiesOutdated"
    : undefined
}

// The service named in a 503 answer, or undefined when the body cannot be read.
export async function failedService(response: Response): Promise<unknown> {
  try {
    const problem = (await response.json()) as { service?: unknown }
    return problem.service
  } catch {
    return undefined
  }
}
