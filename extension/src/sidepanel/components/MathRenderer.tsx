import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MathRendererProps {
  text: string;
}

export function MathRenderer({ text }: MathRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {text || ""}
    </ReactMarkdown>
  );
}
