// Tells the user why step 3 sent them back: the server found this step's values out of date
// (feature 006 spec FR-005). The page shows it until the next successful Continue.
export function RecheckNotice({ children }: { children: string }) {
  return (
    <p role="status" className="recheck-notice">
      {children}
    </p>
  )
}
