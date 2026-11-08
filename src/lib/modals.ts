import { createContext, useContext } from 'react'

/** The modals the layout owns, so pages can open them too. */
export type Modals = {
  openSettings: () => void
  openGroupSettings: (groupId: number) => void
  openNewGroup: () => void
}

const none = () => {}

export const ModalsContext = createContext<Modals>({ openSettings: none, openGroupSettings: none, openNewGroup: none })

export const useModals = () => useContext(ModalsContext)
