import { Link } from "react-router-dom";
import styles from "./Home.module.css";

const features = [
  {
    title: "In-flow capture",
    body: "Grab expressions and problems from any page or notes without breaking your train of thought.",
  },
  {
    title: "Structured answers",
    body: "Question, solution, main concept, and the lecture chunk that matters — not a wall of text.",
  },
  {
    title: "Course-aware RAG",
    body: "Auto-ingestion from your LMS builds a vector index tied to your real syllabus, not generic web math.",
  },
  {
    title: "Misconception graph",
    body: "A persistent model of conceptual slips powers spaced repetition and explanations that sharpen over time.",
  },
];
export function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Browser extension · Active assistant mode</p>
        <h1 className={styles.headline}>
          Math help that stays{" "}
          <span className={styles.headlineAccent}>in your workflow</span>
        </h1>
        <p className={styles.lede}>
          Stop juggling search tabs, calculators, and chatbots. Study Flow gives
          you contextual assistance while you solve — capture from the page,
          get structured guidance in the side panel, and let your course model
          grow smarter every session.
        </p>
        <div className={styles.heroActions}>
          <Link to="/download" className={styles.primaryBtn}>
            Get the extension
          </Link>
          <Link to="/login" className={styles.secondaryBtn}>
            I already have an account
          </Link>
        </div>
        <ul className={styles.meta}>
          <li>
            <span className={styles.metaLabel}>Stack</span>
            React · MV3 · Node · Postgres + pgvector
          </li>
          <li>
            <span className={styles.metaLabel}>AI</span>
            Gemini + embeddings · OCR via Vision API
          </li>
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="how-heading">
        <div className={styles.panelInner}>
          <div className={styles.panelCopy}>
            <h2 id="how-heading" className={styles.sectionTitle}>
              Two modes, one backend
            </h2>
            <p className={styles.sectionText}>
              Passive ingestion quietly syncs materials from your university
              platforms. When you open the side panel, active assistant mode
              layers retrieval, classification, and explanation on top of the
              same data layer — JWT sessions, OAuth toward Canvas, and vector
              search in PostgreSQL.
            </p>
          </div>
          <div className={styles.diagram} role="presentation">
            <div className={styles.diagramRow}>
              <span className={styles.diagramNode}>Extension</span>
              <span className={styles.diagramArrow}>→</span>
              <span className={styles.diagramNodeEm}>API</span>
            </div>
            <div className={styles.diagramSub}>
              <span>Ingestion · AI pipeline · pgvector</span>
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

      <section className={styles.ctaBand}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Ready when your next problem is</h2>
          <p className={styles.ctaText}>
            Install the extension, connect your course materials, and open the
            panel whenever you need structured help — no context reset between
            tabs.
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
