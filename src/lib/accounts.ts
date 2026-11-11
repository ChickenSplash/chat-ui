// Signing in happens on the homelab's shared sign-in site (HMS), not in this app. Its session
// cookie covers every app's subdomain, so coming back here you're already signed in.

export const ACCOUNTS_URL = import.meta.env.VITE_ACCOUNTS_URL ?? 'https://chickensplash.dpdns.org'

export const TERMS_URL = `${ACCOUNTS_URL}/terms`

/** Off to sign in, then back to `returnTo` (only this app's own origin is accepted there). */
export function goToSignIn(returnTo = window.location.href) {
  window.location.replace(`${ACCOUNTS_URL}/login?return=${encodeURIComponent(returnTo)}`)
}
