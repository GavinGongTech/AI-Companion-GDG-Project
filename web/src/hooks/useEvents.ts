import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { EventsData } from '../types/api'

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => apiFetch<EventsData>('/api/v1/events?limit=20').catch(() => ({ events: [] })),
    staleTime: 30_000,
    placeholderData: { events: [] },
  })
}
