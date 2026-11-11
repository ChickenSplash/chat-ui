import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { goToSignIn } from './accounts'
import { api, ApiError, ensureCsrfCookie } from './api'
import { useConfirm } from './confirm'
import type { Preference } from './presence'

export type User = {
  id: string
  display_name: string
  is_guest: boolean
  email?: string | null
  /** Your chosen status (online, idle, dnd, invisible). Only ever sent about yourself. */
  status: Preference
}

export const ME = ['me']

export function useMe() {
  return useQuery({
    queryKey: ME,
    queryFn: async () => {
      try {
        return await api<User>('GET', '/api/auth/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: Infinity,
    retry: false,
  })
}

/** Logging out ends the shared session, so every app is signed out, and lands on the sign-in site. */
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await ensureCsrfCookie()
      await api<void>('POST', '/api/auth/logout')
    },
    onSuccess: () => goToSignIn(window.location.origin),
  })
}

/** Log out after asking first; a guest is warned their account goes with it. */
export function useSignOut(user: User) {
  const logout = useLogout()
  const confirm = useConfirm()

  const signOut = async () => {
    const ok = await confirm(
      user.is_guest
        ? {
            title: 'Log out and delete this guest account?',
            body: "Guest accounts are deleted when they log out, in Chat and Music alike, and can't be recovered.",
            action: 'Log out',
            danger: true,
          }
        : { title: 'Log out', body: 'This logs you out of Chat and Music.', action: 'Log out', danger: true },
    )
    if (ok) logout.mutate()
  }

  return { signOut, pending: logout.isPending }
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { display_name: string }) => api<User>('PATCH', '/api/auth/me', input),
    onSuccess: (user) => queryClient.setQueryData(ME, user),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { current_password: string; password: string; password_confirmation: string }) =>
      api<void>('PUT', '/api/auth/password', input),
  })
}
