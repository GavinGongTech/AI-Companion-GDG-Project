import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { DrillData } from '../types/api'

export function useDrillQueue() {
  return useQuery({
    queryKey: ['drill'],
    queryFn: () => apiFetch<DrillData>('/api/v1/graph/drill').catch(() => ({ queue: [] })),
    staleTime: 60_000,
    placeholderData: { queue: [] },
  })
}
