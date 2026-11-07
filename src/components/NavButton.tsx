import { useLocation, useNavigate } from 'react-router'
import { NAV } from '../lib/nav'
import { Icon } from './icons'

/** Phones only: back from a page to the navigation, without adding a history entry. */
export function NavButton() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <button
      onClick={() => navigate(location.pathname, { replace: true, state: NAV.open })}
      aria-label="Open navigation"
      title="Open navigation"
      className="-ml-1 shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-200 md:hidden"
    >
      <Icon name="menu" />
    </button>
  )
}
