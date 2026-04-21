import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { GraphData } from '../types/api'

export function useGraph() {
  return useQuery({
    queryKey: ['graph'],
    queryFn: () => apiFetch<GraphData>('/api/v1/graph').catch(() => ({ nodes: [] })),
    staleTime: 60_000,
    placeholderData: { nodes: [] },
  })
}
