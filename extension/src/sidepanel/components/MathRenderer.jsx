import { useMemo } from "react";
import katex from "katex";

/**
 * Renders text with inline ($...$) and display ($$...$$) LaTeX math.
 * Non-math text is rendered as plain text spans.
 */
export function MathRenderer({ text }) {
  const parts = useMemo(() => {
    if (!text) return [];
    const result = [];
    // Match $$...$$ (display) and $...$ (inline), non-greedy
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Text before this match
      if (match.index > lastIndex) {
        result.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      const raw = match[0];
      const isDisplay = raw.startsWith("$$");
      const latex = isDisplay ? raw.slice(2, -2).trim() : raw.slice(1, -1).trim();
      try {
        const html = katex.renderToString(latex, {
          displayMode: isDisplay,
          throwOnError: false,
        });
        result.push({ type: "math", html, isDisplay });
      } catch {
        result.push({ type: "text", content: raw });
      }
      lastIndex = match.index + raw.length;
    }

    if (lastIndex < text.length) {
      result.push({ type: "text", content: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  return (
    <span>
      {parts.map((part, i) =>
        part.type === "math" ? (
          part.isDisplay ? (
            <div
              key={i}
              dangerouslySetInnerHTML={{ __html: part.html }}
              style={{ margin: "0.5rem 0", overflowX: "auto" }}
            />
          ) : (
            <span key={i} dangerouslySetInnerHTML={{ __html: part.html }} />
          )
        ) : (
          <span key={i}>{part.content}</span>
        ),
      )}
    </span>
  );
}
