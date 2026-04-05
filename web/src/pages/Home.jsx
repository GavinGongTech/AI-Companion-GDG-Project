import { Link } from "react-router-dom";
import styles from "./Home.module.css";

const features = [
  {
    title: "Zero-friction ingestion",
    body: "Extension auto-detects Brightspace and Gradescope, extracts course materials, chunks and embeds them. No uploads needed.",
  },
  {
    title: "Course-grounded explanations",
    body: "Every answer pulls from your actual syllabus via RAG, not generic web results. Key formulas and relevant lecture sections highlighted.",
  },
  {
    title: "Professor-style quizzes",
    body: "SM-2 spaced repetition picks your weakest concepts. Gemini generates exam-style MCQs at difficulty calibrated to your accuracy.",
  },
  {
    title: "Misconception graph",
    body: "A persistent map of what you get wrong, how often, and why. Tracks concept mastery over time and schedules targeted review.",
  },
];

const comparisonRows = [
  {
    feature: "Knows your syllabus",
    studyFlow: "Yes (auto-ingest)",
    chatgpt: "No",
    notebookLM: "Manual upload",
    anki: "No",
  },
  {
    feature: "Tracks misconceptions",
    studyFlow: "Yes (SMG + SM-2)",
    chatgpt: "No",
    notebookLM: "No",
    anki: "Manual cards",
  },
  {
    feature: "Professor-style quizzes",
    studyFlow: "Yes (weighted)",
    chatgpt: "Generic",
    notebookLM: "No",
    anki: "Manual cards",
  },
  {
    feature: "In-browser workflow",
    studyFlow: "Side panel",
    chatgpt: "Separate tab",
    notebookLM: "Separate tab",
    anki: "Separate app",
  },
  {
    feature: "Personalized over time",
    studyFlow: "Yes (grows smarter)",
    chatgpt: "Resets each chat",
    notebookLM: "Static",
    anki: "Manual",
  },
];

function isYes(value) {
  return value.startsWith("Yes");
}

export function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Chrome extension + web dashboard</p>
        <h1 className={styles.headline}>
          Stop re-learning what you{" "}
          <span className={styles.headlineAccent}>already forgot</span>
        </h1>
        <p className={styles.lede}>
          Study Flow builds a persistent model of what you misunderstand and
          uses spaced repetition to fix it — grounded in your actual course
          materials, not generic web results.
        </p>
        <div className={styles.heroActions}>
          <Link to="/download" className={styles.primaryBtn}>
            Get the extension
          </Link>
          <Link to="/login" className={styles.secondaryBtn}>
            Sign in
          </Link>
        </div>
        <ul className={styles.meta}>
          <li>
            <span className={styles.metaLabel}>Stack</span>
            React · MV3 · Node · Firestore
          </li>
          <li>
            <span className={styles.metaLabel}>AI</span>
            Gemini 2.0 Flash · text-embedding-004 · Cloud Vision OCR
          </li>
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="how-heading">
        <div className={styles.panelInner}>
          <div className={styles.panelCopy}>
            <h2 id="how-heading" className={styles.sectionTitle}>
              Ingestion + Intelligence, one loop
            </h2>
            <p className={styles.sectionText}>
              Passive ingestion auto-syncs materials from Brightspace and
              Gradescope without any manual uploads. When you ask a question,
              active assistant mode retrieves relevant chunks via RAG and feeds
              them to Gemini for grounded explanations. Every wrong answer
              updates your misconception graph, and SM-2 spaced repetition
              schedules the right review at the right time.
            </p>
          </div>
          <div className={styles.diagram} role="presentation">
            <div className={styles.diagramRow}>
              <span className={styles.diagramNode}>Extension</span>
              <span className={styles.diagramArrow}>&rarr;</span>
              <span className={styles.diagramNodeEm}>API</span>
              <span className={styles.diagramArrow}>&rarr;</span>
              <span className={styles.diagramNode}>Gemini + Firestore</span>
            </div>
            <div className={styles.diagramSub}>
              <span>Ingestion · RAG pipeline · Misconception graph</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-heading">
        <h2 id="features-heading" className={styles.featuresTitle}>
          Built for deep work
        </h2>
        <div className={styles.featureGrid}>
          {features.map((f) => (
            <article key={f.title} className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className={styles.comparison}
        aria-labelledby="comparison-heading"
      >
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
                    {row.studyFlow}
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

      <section className={styles.ctaBand}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            Your next wrong answer is the most useful one
          </h2>
          <p className={styles.ctaText}>
            Every mistake feeds your misconception graph. Over time, Study Flow
            learns exactly what to review and when.
          </p>
          <div className={styles.ctaRow}>
            <Link to="/signup" className={styles.primaryBtn}>
              Create account
            </Link>
            <Link to="/download" className={styles.ghostBtn}>
              Download
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
