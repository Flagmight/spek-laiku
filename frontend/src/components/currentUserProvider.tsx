import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { getCurrentUser } from "../api/authApi"
import { CurrentUserContext } from "../hooks/useCurrentUser"
import type { CurrentUserState } from "../hooks/useCurrentUser"
import type { CurrentUser } from "../types/currentUser"

interface LoadedState {
  status: CurrentUserState["status"]
  user: CurrentUser | null
}

async function loadCurrentUser(): Promise<LoadedState> {
  try {
    const user = await getCurrentUser()
    return { status: user ? "signedIn" : "signedOut", user }
  } catch {
    return { status: "error", user: null }
  }
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadedState>({
    status: "loading",
    user: null,
  })
  // Only the most recent request may update the state.
  const latestRequest = useRef(0)

  const load = useCallback(() => {
    const request = ++latestRequest.current
    return loadCurrentUser().then((loaded) => {
      if (request === latestRequest.current) {
        setState(loaded)
      }
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo(() => ({ ...state, refresh: load }), [state, load])

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  )
}
