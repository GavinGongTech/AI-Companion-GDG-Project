import { useEffect, useRef, useState } from 'react'
import styles from './TypewriterTerminal.module.css'

const SCENARIOS = [
  {
    lines: [
      { prefix: '❯ ', text: 'Why does this integral diverge?', color: '#a78bfa', delay: 60 },
      { prefix: '', text: '', color: '#f4f4f5', delay: 400 },
      { prefix: '  AI  ', text: 'Misconception detected: p-series confusion', color: '#22c55e', delay: 40 },
      { prefix: '', text: '  The series Σ 1/n diverges (harmonic series)', color: '#f4f4f5', delay: 35 },
      { prefix: '', text: '  because p = 1, and p-series diverges when p ≤ 1', color: '#f4f4f5', delay: 35 },
      { prefix: '', text: '', color: '#f4f4f5', delay: 300 },
      { prefix: '✓ ', text: 'SMG updated: integral_convergence  0.32 → 0.61', color: '#22c55e', delay: 30 },
    ],
  },
  {
    lines: [
      { prefix: '❯ ', text: "What's the rank-nullity theorem?", color: '#a78bfa', delay: 60 },
      { prefix: '', text: '', color: '#f4f4f5', delay: 400 },
      { prefix: '  AI  ', text: 'From your lecture notes (Week 4, Strang)', color: '#22c55e', delay: 40 },
      { prefix: '', text: '  rank(A) + nullity(A) = n  (number of columns)', color: '#f4f4f5', delay: 35 },
      { prefix: '', text: '  Your past error: confusing rank with trace', color: '#eab308', delay: 35 },
      { prefix: '', text: '', color: '#f4f4f5', delay: 300 },
      { prefix: '✓ ', text: 'SMG updated: linear_algebra_rank  0.45 → 0.72', color: '#22c55e', delay: 30 },
    ],
  },
  {
    lines: [
      { prefix: '❯ ', text: 'When do I reject the null hypothesis?', color: '#a78bfa', delay: 55 },
      { prefix: '', text: '', color: '#f4f4f5', delay: 400 },
      { prefix: '  AI  ', text: 'Based on your stats syllabus (Module 3)', color: '#22c55e', delay: 40 },
      { prefix: '', text: '  Reject H₀ when p-value < α (significance level)', color: '#f4f4f5', delay: 35 },
      { prefix: '', text: "  You've missed this 3× — common procedural error", color: '#ef4444', delay: 35 },
      { prefix: '', text: '', color: '#f4f4f5', delay: 300 },
      { prefix: '✓ ', text: 'SMG updated: hypothesis_testing  0.28 → 0.55', color: '#22c55e', delay: 30 },
    ],
  },
]

type Line = { prefix: string; text: string; color: string; delay: number }
type DisplayLine = { prefix: string; displayText: string; color: string; done: boolean }

export function TypewriterTerminal() {
  const [displayLines, setDisplayLines] = useState<DisplayLine[]>([])
  const [scenarioIdx, setScenarioIdx] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Blink cursor
  useEffect(() => {
    const id = setInterval(() => setShowCursor((v) => !v), 530)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    timeoutRef.current.forEach(clearTimeout)
    timeoutRef.current = []

    const resetT = setTimeout(() => setDisplayLines([]), 0)
    timeoutRef.current.push(resetT)

    const scenario = SCENARIOS[scenarioIdx]
    let totalDelay = 600

    scenario.lines.forEach((line: Line, lineIdx: number) => {
      // Start the line (empty)
      const startDelay = totalDelay
      const t0 = setTimeout(() => {
        setDisplayLines((prev) => [
          ...prev,
          { prefix: line.prefix, displayText: '', color: line.color, done: false },
        ])
      }, startDelay)
      timeoutRef.current.push(t0)

      // Type each character
      for (let charIdx = 0; charIdx <= line.text.length; charIdx++) {
        const charDelay = startDelay + charIdx * line.delay
        const partial = line.text.slice(0, charIdx)
        const isLast = charIdx === line.text.length
        const t = setTimeout(() => {
          setDisplayLines((prev) =>
            prev.map((dl, idx) =>
              idx === lineIdx ? { ...dl, displayText: partial, done: isLast } : dl
            )
          )
        }, charDelay)
        timeoutRef.current.push(t)
      }

      totalDelay += line.delay * line.text.length + (line.text.length === 0 ? line.delay : 80)
    })

    // Loop to next scenario
    const loopDelay = totalDelay + 1800
    const loopT = setTimeout(() => {
      setScenarioIdx((i) => (i + 1) % SCENARIOS.length)
    }, loopDelay)
    timeoutRef.current.push(loopT)

    return () => timeoutRef.current.forEach(clearTimeout)
  }, [scenarioIdx])

  return (
    <div className={styles.terminal}>
      <div className={styles.titleBar}>
        <span className={styles.dot} style={{ background: '#ff5f57' }} />
        <span className={styles.dot} style={{ background: '#febc2e' }} />
        <span className={styles.dot} style={{ background: '#28c840' }} />
        <span className={styles.termTitle}>study-flow — AI companion</span>
      </div>
      <div className={styles.body}>
        {displayLines.map((line, i) => (
          <div key={i} className={styles.line}>
            {line.prefix && (
              <span className={styles.prefix} style={{ color: line.color }}>
                {line.prefix}
              </span>
            )}
            <span style={{ color: line.color }}>{line.displayText}</span>
            {i === displayLines.length - 1 && !line.done && (
              <span
                className={styles.cursor}
                style={{ opacity: showCursor ? 1 : 0 }}
              />
            )}
          </div>
        ))}
        {displayLines.length > 0 &&
          displayLines[displayLines.length - 1].done && (
            <div className={styles.line}>
              <span className={styles.prefix} style={{ color: '#a78bfa' }}>
                {'❯ '}
              </span>
              <span
                className={styles.cursor}
                style={{ opacity: showCursor ? 1 : 0 }}
              />
            </div>
          )}
      </div>
    </div>
  )
}
