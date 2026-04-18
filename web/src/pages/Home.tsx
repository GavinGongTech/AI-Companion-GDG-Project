import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, BookOpen, Target, Network, ChevronRight, ArrowRight } from 'lucide-react'
import { TypewriterTerminal } from '../components/TypewriterTerminal'
import { EASE } from '../lib/motion'
import styles from './Home.module.css'

const features = [
  {
    icon: Zap,
    title: 'Zero-friction ingestion',
    body: 'Extension auto-detects Brightspace and Gradescope, extracts course materials, chunks and embeds them. No uploads needed.',
  },
  {
    icon: BookOpen,
    title: 'Course-grounded explanations',
    body: 'Every answer pulls from your actual syllabus via RAG, not generic web results. Key formulas and relevant lecture sections highlighted.',
  },
  {
    icon: Target,
    title: 'Professor-style quizzes',
    body: 'SM-2 spaced repetition picks your weakest concepts. Gemini generates exam-style MCQs at difficulty calibrated to your accuracy.',
  },
  {
    icon: Network,
    title: 'Misconception graph',
    body: 'A persistent map of what you get wrong, how often, and why. Tracks concept mastery over time and schedules targeted review.',
  },
]

const comparisonRows = [
  {
    feature: 'Knows your syllabus',
    studyFlow: 'Yes (auto-ingest)',
    chatgpt: 'No',
    notebookLM: 'Manual upload',
    anki: 'No',
  },
  {
    feature: 'Tracks misconceptions',
    studyFlow: 'Yes (SMG + SM-2)',
    chatgpt: 'No',
    notebookLM: 'No',
    anki: 'Manual cards',
  },
  {
    feature: 'Professor-style quizzes',
    studyFlow: 'Yes (weighted)',
    chatgpt: 'Generic',
    notebookLM: 'No',
    anki: 'Manual cards',
  },
  {
    feature: 'In-browser workflow',
    studyFlow: 'Side panel',
    chatgpt: 'Separate tab',
    notebookLM: 'Separate tab',
    anki: 'Separate app',
  },
  {
    feature: 'Personalized over time',
    studyFlow: 'Yes (grows smarter)',
    chatgpt: 'Resets each chat',
    notebookLM: 'Static',
    anki: 'Manual',
  },
]

function isYes(value: string) {
  return value.startsWith('Yes')
}

const universities = [
  'NYU',
  'MIT',
  'Cornell',
  'Georgia Tech',
  'Stanford',
  'Carnegie Mellon',
  'Michigan',
  'Berkeley',
]

export function Home() {
  return (
    <div className={styles.page}>
      {/* ── Section 1: Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <motion.div
            className={styles.heroContent}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <span className={styles.badge}>
              <span className={styles.badgeDot} />
              Now with Gemini 3.1 Pro
            </span>
            <h1 className={styles.headline}>
              Stop re-learning what you{' '}
              <span className={styles.headlineAccent}>already forgot</span>
            </h1>
            <p className={styles.lede}>
              Study Flow builds a persistent model of what you misunderstand
              and uses spaced repetition to fix it — grounded in your actual
              course materials, not generic web results.
            </p>
            <div className={styles.heroActions}>
              <Link to="/download" className={styles.primaryBtn}>
                Get the extension <ChevronRight size={16} />
              </Link>
              <Link to="/login" className={styles.ghostBtn}>
                Sign in
              </Link>
            </div>
            <div className={styles.heroMeta}>
              <span>React · MV3 · Node · Firestore</span>
              <span className={styles.metaSep}>·</span>
              <span>Gemini 3.1 Pro · Text Embedding 004</span>
            </div>
          </motion.div>

          <motion.div
            className={styles.heroTerminal}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          >
            <TypewriterTerminal />
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: Proof strip ── */}
      <div className={styles.proofStrip}>
        <span className={styles.proofLabel}>Used by students at</span>
        <div className={styles.marqueeWrap}>
          <div className={styles.marquee}>
            <div className={styles.marqueeInner}>
              {universities.map((u) => (
                <span key={u} className={styles.uni}>{u}</span>
              ))}
              {universities.map((u) => (
                <span key={u + '-clone'} className={styles.uni}>{u}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Features ── */}
      <section className={styles.features} aria-labelledby="features-heading">
        <p className={styles.featuresEyebrow}>01 / Features</p>
        <h2 id="features-heading" className={styles.featuresTitle}>
          Built for deep work
        </h2>
        <div className={styles.featureGrid}>
          {features.map((f, i) => (
            <motion.article
              key={f.title}
              className={styles.featureCard}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            >
              <div className={styles.featureIcon}>
                <f.icon size={20} />
              </div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ── Section 4: How it works ── */}
      <section className={styles.howItWorks} aria-labelledby="how-heading">
        <div className={styles.howInner}>
          <p className={styles.howEyebrow}>02 / How it works</p>
          <h2 id="how-heading" className={styles.howTitle}>
            How Study Flow works
          </h2>
          <div className={styles.steps}>
            <div className={styles.step} data-step="">
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepTitle}>Passive Ingest</div>
              <p className={styles.stepBody}>
                The extension auto-detects your LMS — Brightspace, Gradescope,
                Canvas — and silently syncs syllabi, lecture notes, and problem
                sets into your personal knowledge base.
              </p>
            </div>
            <div className={styles.stepArrow} data-step="" aria-hidden="true">
              <ArrowRight size={24} />
            </div>
            <div className={styles.step} data-step="">
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepTitle}>Grounded Answer</div>
              <p className={styles.stepBody}>
                Ask anything. Gemini retrieves the relevant course chunks via
                RAG and answers with citations to your actual materials — not
                generic web results.
              </p>
            </div>
            <div className={styles.stepArrow} data-step="" aria-hidden="true">
              <ArrowRight size={24} />
            </div>
            <div className={styles.step} data-step="">
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepTitle}>Memory System</div>
              <p className={styles.stepBody}>
                Every interaction updates your Student Misconception Graph.
                SM-2 spaced repetition schedules targeted review precisely when
                forgetting is most likely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Comparison table ── */}
      <section className={styles.comparison} aria-labelledby="comparison-heading">
        <p className={styles.sectionEyebrow}>03 / Comparison</p>
        <h2 id="comparison-heading" className={styles.comparisonTitle}>
          How Study Flow compares
        </h2>
        <div className={styles.comparisonTableWrap}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Study Flow</th>
                <th>ChatGPT / Gemini</th>
                <th>NotebookLM</th>
                <th>Anki</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td className={isYes(row.studyFlow) ? styles.cellYes : undefined}>
                    {isYes(row.studyFlow) ? '✓ ' : ''}{row.studyFlow}
                  </td>
                  <td>{row.chatgpt}</td>
                  <td>{row.notebookLM}</td>
                  <td>{row.anki}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 6: CTA Band ── */}
      <section className={styles.ctaBand}>
        <div className={styles.ctaInner}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <h2 className={styles.ctaTitle}>
              Your next wrong answer is the most useful one
            </h2>
            <p className={styles.ctaText}>
              Every mistake feeds your misconception graph. Over time, Study Flow
              learns exactly what to review and when.
            </p>
            <div className={styles.ctaRow}>
              <Link to="/signup" className={styles.primaryBtn}>
                Create account <ChevronRight size={16} />
              </Link>
              <Link to="/download" className={styles.ghostBtn}>
                Download
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
