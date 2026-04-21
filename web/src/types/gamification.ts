export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: { _seconds: number } | string | null
}

export interface GamificationData {
  xp: number
  level: number
  xpIntoLevel: number
  nextLevelXP: number
  streak: number
  lastActivityDate?: string
  achievements: Achievement[]
}
