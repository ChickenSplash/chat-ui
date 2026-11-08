import { createContext, useContext, type ReactNode } from 'react'

export type ConfirmOptions = {
  title: string
  body?: ReactNode
  /** The confirm button's label. */
  action?: string
  danger?: boolean
  /** Only enabled once this exact text is typed, for things that can't be undone. */
  typeToConfirm?: string
}

/** Asks in a modal; resolves true if confirmed, false if cancelled or dismissed. */
export type Confirm = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<Confirm>(async () => false)

export const useConfirm = () => useContext(ConfirmContext)
