import * as Progress from '@radix-ui/react-progress'
import { Flame, Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { EASE } from '../lib/motion'
import type { GamificationData } from '../types/gamification'
import styles from './GamificationHeader.module.css'

interface Props {
  data: GamificationData | undefined
}

function CalendarHeatmap({ streak }: { streak: number }) {
  const days = 35
  const cells = Array.from({ length: days }, (_, i) => {
    const daysAgo = days - 1 - i
    // Color cells based on streak recency (fake but visually meaningful)
    const active = daysAgo < streak
    const hot = daysAgo < Math.min(streak, 7)
    return { daysAgo, active, hot }
  })
  return (
    <div className={styles.heatmap}>
      {cells.map((c, i) => (
        <div
          key={i}
          className={styles.heatCell}
          style={{
            background: c.hot
              ? 'var(--accent)'
              : c.active
              ? 'var(--accent-dim)'
              : 'var(--bg-muted)',
            opacity: c.hot ? 1 : c.active ? 0.6 : 0.3,
          }}
          title={`${c.daysAgo} days ago`}
        />
      ))}
    </div>
  )
}

export function GamificationHeader({ data }: Props) {
  const xp = data?.xp ?? 0
  const level = data?.level ?? 1
  const xpIntoLevel = data?.xpIntoLevel ?? 0
  const nextLevelXP = data?.nextLevelXP ?? 100
  const streak = data?.streak ?? 0
  const pct = Math.round((xpIntoLevel / nextLevelXP) * 100)

  return (
    <motion.div
      className={styles.wrap}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className={styles.streakBlock}>
        <Flame size={20} className={styles.flame} />
        <span className={styles.streakNum}>{streak}</span>
        <span className={styles.streakLabel}>day streak</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.xpBlock}>
        <div className={styles.xpTop}>
          <span className={styles.levelBadge}>
            <Star size={12} />
            Level {level}
          </span>
          <span className={styles.xpText}>{xp.toLocaleString()} XP total</span>
        </div>
        <Progress.Root className={styles.progressRoot} value={pct}>
          <Progress.Indicator
            className={styles.progressBar}
            style={{ transform: `translateX(-${100 - pct}%)` }}
          />
        </Progress.Root>
        <span className={styles.xpNext}>{xpIntoLevel} / {nextLevelXP} to Level {level + 1}</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.calBlock}>
        <span className={styles.calLabel}>Last 5 weeks</span>
        <CalendarHeatmap streak={streak} />
      </div>
    </motion.div>
  )
}
