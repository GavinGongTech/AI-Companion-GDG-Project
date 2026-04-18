import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { GamificationData } from '../types/gamification'

const PLACEHOLDER: GamificationData = {
  xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 0, achievements: [],
}

export function useGamification() {
  return useQuery({
    queryKey: ['gamification'],
    queryFn: () => apiFetch<GamificationData>('/api/v1/gamification').catch(() => PLACEHOLDER),
    staleTime: 60_000,
    placeholderData: PLACEHOLDER,
  })
}
