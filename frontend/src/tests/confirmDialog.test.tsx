import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "../components/confirmDialog"

const question = "Delete 'Weekend in Kaunas'? This cannot be undone."

function renderDialog(
  props: Partial<Parameters<typeof ConfirmDialog>[0]> = {},
) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      question={question}
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onConfirm, onCancel }
}

// The confirmation dialog for deleting a plan and for replacing an unsaved plan (feature 011 spec FR-002,
// FR-013, FR-020, research section 9).
describe("ConfirmDialog", () => {
  it("is a modal dialog named by its question", () => {
    renderDialog()

    const dialog = screen.getByRole("dialog", { name: question })
    expect(dialog).toHaveAttribute("aria-modal", "true")
  })

  it("moves focus to the confirm button when it opens", () => {
    renderDialog()

    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus()
  })

  it("keeps Tab and Shift+Tab inside the dialog", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.tab()
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
  })

  it("cancels once with Escape", async () => {
    const user = userEvent.setup()
    const { onCancel, onConfirm } = renderDialog()

    await user.keyboard("{Escape}")

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("cancels once with the Cancel button", async () => {
    const user = userEvent.setup()
    const { onCancel, onConfirm } = renderDialog()

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("confirms with the confirm button", async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = renderDialog()

    await user.click(screen.getByRole("button", { name: "Delete" }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("disables the confirm button while busy", () => {
    renderDialog({ busy: true })

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })

  it("shows a question with markup as plain text", () => {
    const markup = "Delete '<script>alert(1)</script>'? This cannot be undone."
    renderDialog({ question: markup })

    expect(screen.getByText(markup)).toBeInTheDocument()
    expect(document.querySelector("script")).toBeNull()
  })
})
