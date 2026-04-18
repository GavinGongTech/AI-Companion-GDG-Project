import { motion, type Transition } from 'framer-motion'
import { Network, Zap, Target, BookOpen } from 'lucide-react'
import { EASE } from '../lib/motion'
import { useAuth } from '../lib/auth'
import { useGraph } from '../hooks/useGraph'
import { useDrillQueue } from '../hooks/useDrillQueue'
import { useEvents } from '../hooks/useEvents'
import { useGamification } from '../hooks/useGamification'
import { GamificationHeader } from '../components/GamificationHeader'
import { D3ConceptGraph } from '../components/D3ConceptGraph'
import { AnimatedStatCard } from '../components/AnimatedStatCard'
import { AchievementBadge } from '../components/AchievementBadge'
import { DrillQueueCard } from '../components/DrillQueueCard'
import styles from './Dashboard.module.css'

function formatDate(ts: { _seconds: number } | string | undefined): string {
  if (!ts) return ''
  const date =
    typeof ts === 'object' && '_seconds' in ts
      ? new Date(ts._seconds * 1000)
      : new Date(ts)
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: EASE } satisfies Transition,
})

export default function Dashboard() {
  const user = useAuth()
  const { data: graphData } = useGraph()
  const { data: drillData } = useDrillQueue()
  const { data: eventsData } = useEvents()
  const { data: gamData } = useGamification()

  const nodes = graphData?.nodes ?? []
  const drill = drillData?.queue ?? []
  const events = eventsData?.events ?? []

  const totalInteractions = nodes.reduce((s, n) => s + (n.interactionCount || 0), 0)
  const avgAccuracy = nodes.length > 0
    ? nodes.reduce((s, n) => s + (n.accuracyRate || 0), 0) / nodes.length
    : 0
  const dueForReview = drill.filter((d) => d.urgency > 0).length

  return (
    <div className={styles.page}>
      <motion.div {...fadeUp(0)}>
        <h1 className={styles.heading}>
          Dashboard{user?.displayName ? ` — ${user.displayName}` : ''}
        </h1>
        <p className={styles.subheading}>
          Your progress, review queue, and study activity.
        </p>
      </motion.div>

      <motion.div {...fadeUp(0.05)}>
        <GamificationHeader data={gamData} />
      </motion.div>

      <motion.div className={styles.statRow} {...fadeUp(0.1)}>
        <AnimatedStatCard value={nodes.length} label="Concepts tracked" icon={<Network size={18} />} delay={0.1} />
        <AnimatedStatCard value={totalInteractions} label="Total interactions" icon={<Zap size={18} />} delay={0.15} />
        <AnimatedStatCard value={Math.round(avgAccuracy * 100)} label="Avg accuracy" suffix="%" icon={<Target size={18} />} delay={0.2} />
        <AnimatedStatCard value={dueForReview} label="Due for review" icon={<BookOpen size={18} />} delay={0.25} />
      </motion.div>

      <div className={styles.grid}>
        <motion.div className={styles.panel} {...fadeUp(0.15)}>
          <h2 className={styles.panelTitle}>Concept Network</h2>
          <D3ConceptGraph nodes={nodes} />
        </motion.div>

        <motion.div className={styles.panel} {...fadeUp(0.2)}>
          <h2 className={styles.panelTitle}>Drill Queue</h2>
          {drill.length > 0 ? (
            <div className={styles.drillList}>
              {drill.slice(0, 10).map((item, i) => (
                <DrillQueueCard key={item.conceptNode} item={item} index={i} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No items in drill queue yet.</p>
          )}
        </motion.div>

        {(gamData?.achievements?.length ?? 0) > 0 && (
          <motion.div className={`${styles.panel} ${styles.fullWidth}`} {...fadeUp(0.25)}>
            <h2 className={styles.panelTitle}>Achievements</h2>
            <AchievementBadge achievements={gamData?.achievements ?? []} />
          </motion.div>
        )}

        <motion.div className={`${styles.panel} ${styles.fullWidth}`} {...fadeUp(0.3)}>
          <h2 className={styles.panelTitle}>Recent Activity</h2>
          {events.length > 0 ? (
            <div className={styles.eventList}>
              {events.map((evt) => (
                <div key={evt.eventId} className={styles.eventItem}>
                  <span className={styles.eventType} data-type={evt.eventType}>
                    {evt.eventType?.replace(/_/g, ' ')}
                  </span>
                  <span className={styles.eventContent}>
                    {evt.content?.slice(0, 90)}{evt.content?.length > 90 ? '…' : ''}
                  </span>
                  <span className={styles.eventTime}>{formatDate(evt.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No activity yet — start studying!</p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
