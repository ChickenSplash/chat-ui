import { useLocation } from 'react-router'

/**
 * Phones show one panel at a time: the navigation (rail and sidebar) or the page. Links say
 * which they lead to in their state; without it, only the home page shows the navigation.
 */
export const NAV = { open: { nav: true }, closed: { nav: false } }

export function useNavOpen() {
  const location = useLocation()
  const state = location.state as { nav?: boolean } | null
  return state?.nav ?? location.pathname === '/'
}
