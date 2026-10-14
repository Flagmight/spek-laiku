import { useRef } from "react"
import type { MouseEvent } from "react"
import { Outlet } from "react-router-dom"
import { SuccessBanner } from "./successBanner"

export function Layout() {
  const mainRef = useRef<HTMLElement>(null)

  function skipToMainContent(event: MouseEvent<HTMLAnchorElement>) {
    // Move focus explicitly: a hash link alone only scrolls in some browsers.
    event.preventDefault()
    mainRef.current?.focus()
  }

  return (
    <>
      <a href="#main-content" className="skip-link" onClick={skipToMainContent}>
        Skip to main content
      </a>
      <header>
        <nav aria-label="Main" />
      </header>
      <div role="status">
        <SuccessBanner />
      </div>
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}
