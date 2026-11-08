import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ConfirmContext, type Confirm, type ConfirmOptions } from '../lib/confirm'
import { Icon } from './icons'
import { Button, Field } from './ui'

/**
 * A native modal dialog: focus stays inside, Esc or a click on the backdrop closes it. Mount
 * it to open it and unmount it to close it. An element marked `data-autofocus` gets focus.
 */
export function Modal({
  label,
  onClose,
  className = '',
  children,
}: {
  label: string
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOnBackdrop = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      // Not for the close() on unmount, nor a stale one when StrictMode reopens it at once.
      onClose={(e) => e.currentTarget.isConnected && !e.currentTarget.open && onClose()}
      // Esc would otherwise reach the page too (the chat uses it to drop the unread line).
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
      // Only a click that starts and ends on the backdrop, so dragging out of a field doesn't close it.
      onMouseDown={(e) => (pressedOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => pressedOnBackdrop.current && e.target === e.currentTarget && onClose()}
      className={`m-auto max-h-none overflow-visible border-0 bg-transparent p-0 text-zinc-100 transition-[opacity,scale] duration-150 backdrop:bg-black/70 starting:scale-95 starting:opacity-0 ${className}`}
    >
      {children}
    </dialog>
  )
}

export function CloseButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      title="Close (Esc)"
      className={`rounded-md p-1 text-zinc-400 transition hover:bg-hover hover:text-zinc-100 ${className}`}
    >
      <Icon name="x" className="size-6" />
    </button>
  )
}

/** The usual modal: a title, a body and a footer of buttons. Give `onSubmit` to make it a form. */
export function Dialog({
  title,
  description,
  onClose,
  onSubmit,
  footer,
  className = 'max-w-md',
  children,
}: {
  title: string
  description?: ReactNode
  onClose: () => void
  onSubmit?: (event: FormEvent) => void
  footer?: ReactNode
  className?: string
  children?: ReactNode
}) {
  const content = (
    <>
      <div className="relative px-6 pt-6 pb-5">
        <CloseButton onClick={onClose} className="absolute top-3 right-3" />
        <h2 className="pr-8 text-xl font-semibold text-white">{title}</h2>
        {description && <div className="mt-2 text-sm text-zinc-400">{description}</div>}
        {children && <div className="mt-5 space-y-4">{children}</div>}
      </div>
      {footer && <div className="flex items-center justify-end gap-2 bg-side px-6 py-4">{footer}</div>}
    </>
  )

  return (
    <Modal label={title} onClose={onClose} className={`w-[calc(100vw-2rem)] ${className}`}>
      <div className="overflow-hidden rounded-xl bg-main shadow-2xl ring-1 ring-black/30">
        {onSubmit ? <form onSubmit={onSubmit}>{content}</form> : content}
      </div>
    </Modal>
  )
}

/** Provides `useConfirm()`: the app's replacement for the browser's confirm() and prompt(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ id: number; options: ConfirmOptions } | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<Confirm>((options) => {
    resolver.current?.(false)
    return new Promise((resolve) => {
      resolver.current = resolve
      setRequest((previous) => ({ id: (previous?.id ?? 0) + 1, options }))
    })
  }, [])

  const finish = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog key={request.id} options={request.options} onFinish={finish} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ options, onFinish }: { options: ConfirmOptions; onFinish: (ok: boolean) => void }) {
  const { title, body, action = 'Confirm', danger, typeToConfirm } = options
  const [typed, setTyped] = useState('')
  const ready = !typeToConfirm || typed === typeToConfirm

  return (
    <Dialog
      title={title}
      description={body}
      onClose={() => onFinish(false)}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) onFinish(true)
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onFinish(false)}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={!ready} data-autofocus={typeToConfirm ? undefined : true}>
            {action}
          </Button>
        </>
      }
    >
      {typeToConfirm && (
        <Field
          label={`Type ${typeToConfirm} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          data-autofocus
        />
      )}
    </Dialog>
  )
}
