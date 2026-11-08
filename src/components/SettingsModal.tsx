import type { ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { CloseButton, Modal } from './Modal'

export type SettingsSection<T extends string> = { id: T; label: string; icon: IconName; group: string }

export type SettingsAction = { label: string; icon: IconName; danger?: boolean; onClick: () => void }

/**
 * Discord's settings layout in a modal: sections listed on the left, the open one on the
 * right. On a phone it fills the screen and the list becomes a row of tabs.
 */
export function SettingsModal<T extends string>({
  label,
  sections,
  active,
  onSelect,
  actions = [],
  footer,
  onClose,
  children,
}: {
  label: string
  sections: SettingsSection<T>[]
  active: T
  onSelect: (id: T) => void
  /** Listed under the sections, Discord style: log out, leave, delete. */
  actions?: SettingsAction[]
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const groups = [...new Set(sections.map((s) => s.group))]
  const current = sections.find((s) => s.id === active)

  return (
    <Modal
      label={label}
      onClose={onClose}
      className="h-[min(46rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-5xl max-md:m-0 max-md:h-dvh max-md:w-screen max-md:max-w-none"
    >
      <div className="flex h-full overflow-hidden rounded-xl bg-main shadow-2xl ring-1 ring-black/30 max-md:flex-col max-md:rounded-none max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]">
        <nav
          aria-label={label}
          className="flex w-60 shrink-0 flex-col overflow-y-auto bg-side px-3 py-6 max-md:w-full max-md:flex-row max-md:items-center max-md:gap-1 max-md:overflow-x-auto max-md:border-b max-md:border-black/20 max-md:p-2"
        >
          {groups.map((group) => (
            <div key={group} className="mb-4 max-md:mb-0 max-md:flex max-md:gap-1">
              <h3 className="truncate px-2.5 pb-1.5 text-xs font-semibold tracking-wide text-zinc-400 uppercase max-md:hidden">{group}</h3>
              {sections
                .filter((s) => s.group === group)
                .map((section) => (
                  <NavItem
                    key={section.id}
                    icon={section.icon}
                    active={section.id === active}
                    onClick={() => onSelect(section.id)}
                  >
                    {section.label}
                  </NavItem>
                ))}
            </div>
          ))}

          {actions.length > 0 && (
            <div className="mt-auto border-t border-white/5 pt-3 max-md:mt-0 max-md:flex max-md:gap-1 max-md:border-t-0 max-md:border-l max-md:pt-0 max-md:pl-1">
              {actions.map((action) => (
                <NavItem key={action.label} icon={action.icon} danger={action.danger} onClick={action.onClick}>
                  {action.label}
                </NavItem>
              ))}
            </div>
          )}
          {footer && <div className="px-2.5 pt-3 text-xs text-zinc-500 max-md:hidden">{footer}</div>}
        </nav>

        <section aria-label={current?.label} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-3 px-6 pt-6 pb-2 md:px-10 md:pt-8">
            <h2 className="flex-1 truncate text-xl font-semibold text-white">{current?.label}</h2>
            <CloseButton onClick={onClose} />
          </header>
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-10 md:px-10">
            <div className="max-w-2xl space-y-8">{children}</div>
          </div>
        </section>
      </div>
    </Modal>
  )
}

function NavItem({
  icon,
  active,
  danger,
  onClick,
  children,
}: {
  icon: IconName
  active?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[15px] font-medium whitespace-nowrap transition max-md:w-auto ${
        active
          ? 'bg-hover text-white'
          : danger
            ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
            : 'text-zinc-400 hover:bg-hover/60 hover:text-zinc-200'
      }`}
    >
      <Icon name={icon} className="size-5 shrink-0" />
      {children}
    </button>
  )
}

/** A titled block inside a settings section. */
export function SettingsBlock({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
