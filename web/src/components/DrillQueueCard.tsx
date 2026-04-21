import { motion, type Transition } from 'framer-motion'
import * as Progress from '@radix-ui/react-progress'
import type { DrillItem } from '../types/api'
import { accuracyColor } from '../lib/colors'
import { formatConceptLabel } from '../lib/format'
import { EASE } from '../lib/motion'
import styles from './DrillQueueCard.module.css'

interface Props {
  item: DrillItem
  index: number
}

export function DrillQueueCard({ item, index }: Props) {
  const pct = Math.max(5, Math.round(item.accuracyRate * 100))
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [...EASE] } satisfies Transition}
    >
      <div className={styles.top}>
        <span className={styles.name}>{formatConceptLabel(item.conceptNode)}</span>
        <span className={styles.pct} style={{ color: accuracyColor(item.accuracyRate) }}>
          {pct}%
        </span>
      </div>
      <Progress.Root className={styles.track} value={pct}>
        <Progress.Indicator
          className={styles.fill}
          style={{
            transform: `translateX(-${100 - pct}%)`,
            background: accuracyColor(item.accuracyRate),
          }}
        />
      </Progress.Root>
    </motion.div>
  )
}
