import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from '../logger'
import { GamificationResponse } from '@study-flow/shared'

const db = getFirestore()

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

function levelFromXP(xp: number): { level: number, xpIntoLevel: number, nextLevelXP: number } {
  let level = 1
  let accumulated = 0
  while (accumulated + xpForLevel(level) <= xp) {
    accumulated += xpForLevel(level)
    level++
  }
  return { level, xpIntoLevel: xp - accumulated, nextLevelXP: xpForLevel(level) }
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (data: AchievementData) => boolean;
}

interface AchievementData {
  streak: number;
  conceptCount: number;
  maxAccuracy: number;
  quizCount: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_quiz', name: 'First Step', description: 'Complete your first quiz', icon: '⚡', check: (d) => (d.quizCount || 0) >= 1 },
  { id: 'streak_7',   name: 'Week Warrior', description: '7-day streak', icon: '🔥', check: (d) => (d.streak || 0) >= 7 },
  { id: 'streak_30',  name: 'Month Master', description: '30-day streak', icon: '🏆', check: (d) => (d.streak || 0) >= 30 },
  { id: 'concepts_10', name: 'Explorer',  description: '10 concepts tracked', icon: '🧭', check: (d) => (d.conceptCount || 0) >= 10 },
  { id: 'concepts_50', name: 'Scholar',   description: '50 concepts tracked', icon: '📚', check: (d) => (d.conceptCount || 0) >= 50 },
  { id: 'accuracy_90', name: 'Precision', description: '90%+ accuracy on a concept', icon: '🎯', check: (d) => (d.maxAccuracy || 0) >= 0.9 },
]

export async function getGamificationData(uid: string): Promise<GamificationResponse> {
  try {
    const userRef = db.collection('users').doc(uid)
    const gamSnap = await userRef.collection('gamification').doc('stats').get()
    const gam = gamSnap.exists ? (gamSnap.data() as any) : {}
    const conceptCount = gam.conceptCount || 0
    const maxAccuracy = gam.maxAccuracy || 0
    // Compute streak from the already-fetched document — avoids a second Firestore read.
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const streak = (gam.lastActivityDate === today || gam.lastActivityDate === yesterday)
      ? (gam.streak || 0) : 0
    const xp = gam.xp || 0
    const { level, xpIntoLevel, nextLevelXP } = levelFromXP(xp)

    const unlocked = new Set<string>(gam.unlockedAchievements || [])
    const achievementData: AchievementData = { streak, conceptCount, maxAccuracy, quizCount: gam.quizCount || 0 }
    const newlyUnlocked: string[] = []

    for (const a of ACHIEVEMENTS) {
      if (!unlocked.has(a.id) && a.check(achievementData)) {
        unlocked.add(a.id)
        newlyUnlocked.push(a.id)
      }
    }

    if (newlyUnlocked.length > 0) {
      const dates = { ...(gam.achievementDates || {}) }
      const now = new Date().toISOString()
      newlyUnlocked.forEach((id) => { dates[id] = now })
      await userRef.collection('gamification').doc('stats').set(
        { unlockedAchievements: [...unlocked], achievementDates: dates },
        { merge: true }
      )
    }

    return {
      xp,
      level,
      xpIntoLevel,
      nextLevelXP,
      streak,
      achievements: ACHIEVEMENTS.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        unlocked: unlocked.has(a.id),
        unlockedAt: unlocked.has(a.id) ? (gam.achievementDates?.[a.id] ?? null) : null,
      })),
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err, uid }, 'getGamificationData failed')
    return {
      xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 0,
      achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, description: a.description, icon: a.icon, unlocked: false, unlockedAt: null })),
    }
  }
}

export async function addXP(uid: string, points: number, reason: string): Promise<void> {
  try {
    const ref = db.collection('users').doc(uid).collection('gamification').doc('stats')
    const updates: any = {
      xp: FieldValue.increment(points),
      lastActivity: new Date().toISOString(),
    }
    if (reason === 'quiz_correct') updates.quizCount = FieldValue.increment(1)
    await ref.set(updates, { merge: true })
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, uid, reason }, 'addXP failed (non-critical)')
  }
}

export async function updateStreak(uid: string): Promise<void> {
  try {
    const ref = db.collection('users').doc(uid).collection('gamification').doc('stats')
    const snap = await ref.get()
    const current = snap.exists ? (snap.data() as any) : {}
    const today = new Date().toISOString().slice(0, 10)
    if (current.lastActivityDate === today) return

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const newStreak = current.lastActivityDate === yesterday ? (current.streak || 0) + 1 : 1
    // Merge streak update + daily XP bonus in one write (avoids the addXP round-trip).
    await ref.set({
      lastActivityDate: today,
      streak: newStreak,
      xp: FieldValue.increment(20),
      lastActivity: new Date().toISOString(),
    }, { merge: true })
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, uid }, 'updateStreak failed (non-critical)')
  }
}
