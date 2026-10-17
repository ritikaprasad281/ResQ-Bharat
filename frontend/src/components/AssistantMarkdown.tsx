import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Shared renderer for Gemini assistant responses in AI Help and Flood
 * Intelligence. Interprets the Markdown the model returns (bold headings,
 * numbered/bulleted lists, paragraphs, links) instead of showing raw
 * `**` / `#` syntax. react-markdown does not emit raw HTML, so model output
 * cannot inject markup; links are additionally restricted to safe protocols
 * and opened in a new tab.
 */

const SAFE_LINK = /^(https?:|tel:|mailto:)/i;

function AssistantMarkdownBase({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={`assistant-md space-y-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => (
            <h3 className="text-[15px] font-semibold text-white mt-1">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-[14px] font-semibold text-white mt-1">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-[13px] font-semibold text-white mt-1">
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 marker:text-slate-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 marker:text-slate-500">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-amber-400/50 bg-amber-400/5 pl-3 py-1 text-amber-100/90 rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-ink-900/80 border border-white/10 px-1 py-0.5 text-[0.85em]">
              {children}
            </code>
          ),
          a: ({ href, children }) => {
            const safe = href && SAFE_LINK.test(href) ? href : undefined;
            return (
              <a
                href={safe}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

const AssistantMarkdown = memo(AssistantMarkdownBase);
export default AssistantMarkdown;
