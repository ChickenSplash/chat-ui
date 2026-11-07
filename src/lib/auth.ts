import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, ensureCsrfCookie } from './api'
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

/** Signing in, registering and joining as a guest all end with the same user in the cache. */
function useSignIn<T>(path: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: T) => {
      await ensureCsrfCookie()
      return api<User>('POST', path, input)
    },
    onSuccess: (user) => queryClient.setQueryData(ME, user),
  })
}

export const useLogin = () =>
  useSignIn<{ email: string; password: string; remember: boolean }>('/api/auth/login')

export const useRegister = () =>
  useSignIn<{ display_name: string; email: string; password: string; password_confirmation: string }>(
    '/api/auth/register',
  )

export const useJoinAsGuest = () => useSignIn<{ display_name: string }>('/api/auth/guest')

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api<void>('POST', '/api/auth/logout'),
    onSuccess: () => {
      // Not clear(): that drops the entry useMe is subscribed to, so it would never see the null.
      queryClient.setQueryData(ME, null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME[0] })
    },
  })
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
