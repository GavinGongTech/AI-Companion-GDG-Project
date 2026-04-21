import { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate, type Transition } from 'framer-motion'
import type { ReactNode } from 'react'
import { EASE } from '../lib/motion'
import styles from './AnimatedStatCard.module.css'

interface Props {
  value: number
  label: string
  suffix?: string
  icon?: ReactNode
  delay?: number
}

export function AnimatedStatCard({ value, label, suffix = '', icon, delay = 0 }: Props) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v) + suffix)

  useEffect(() => {
    // Animates from the current motion-value position to the new value on every change,
    // so fresh data from React Query re-plays the counter rather than silently jumping.
    const controls = animate(count, value, { duration: 1.2, delay, ease: EASE })
    return () => { controls.stop() }
  }, [count, value, delay])

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [...EASE] } satisfies Transition}
    >
      {icon && <div className={styles.icon}>{icon}</div>}
      <motion.span className={styles.value}>{rounded}</motion.span>
      <span className={styles.label}>{label}</span>
    </motion.div>
  )
}
