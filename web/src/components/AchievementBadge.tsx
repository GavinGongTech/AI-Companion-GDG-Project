import { motion } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { Achievement } from '../types/gamification'
import styles from './AchievementBadge.module.css'

interface Props {
  achievements: Achievement[]
}

export function AchievementBadge({ achievements }: Props) {
  if (achievements.length === 0) return null
  return (
    <Tooltip.Provider delayDuration={200}>
      <div className={styles.grid}>
        {achievements.map((a, i) => (
          <Tooltip.Root key={a.id}>
            <Tooltip.Trigger asChild>
              <motion.div
                className={`${styles.badge} ${a.unlocked ? styles.unlocked : styles.locked}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: a.unlocked ? 1 : 0.35 }}
                transition={{ delay: i * 0.05, duration: 0.3, type: 'spring', stiffness: 260 }}
              >
                <span className={styles.icon}>{a.icon}</span>
                <span className={styles.name}>{a.name}</span>
              </motion.div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={6}>
                <strong>{a.name}</strong>
                <span>{a.description}</span>
                {a.unlocked ? <span className={styles.unlockLabel}>Unlocked!</span> : <span className={styles.lockLabel}>Locked</span>}
                <Tooltip.Arrow className={styles.tooltipArrow} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  )
}
