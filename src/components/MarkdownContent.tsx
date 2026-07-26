import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Markdown here is LLM-generated from web search results, so raw HTML in it is
 * attacker-influenced. rehype-raw has to stay — fixCjkEmphasis() below emits
 * <strong> tags that only it can parse — so rehype-sanitize runs immediately
 * after it to strip everything the schema does not allow (issue #34).
 *
 * The default schema already covers GFM tables, headings, lists and inline
 * code; we only widen it for the table alignment styles remark-gfm emits.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    td: [...(defaultSchema.attributes?.td ?? []), ['style', /^text-align:(left|right|center)$/]],
    th: [...(defaultSchema.attributes?.th ?? []), ['style', /^text-align:(left|right|center)$/]],
  },
};

/**
 * Convert **text** to <strong>text</strong> when at least one side is NOT an
 * ASCII word character.  CommonMark fails to recognise emphasis boundaries next
 * to CJK characters and fullwidth punctuation (（）「」 etc.); converting to raw
 * HTML lets rehype-raw handle it correctly.  Cases where both sides are ASCII
 * word chars (e.g. a**b**c) are left for the normal parser.
 */
function fixCjkEmphasis(text: string): string {
  return text.split('\n').map(line => {
    // Skip code fences and indented code blocks
    if (/^(```|~~~| {4}|\t)/.test(line)) return line;
    // Split on inline code spans so we never touch content inside backticks
    const parts = line.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) return part;           // inline code span — skip
      return part.replace(
        /(?<![a-zA-Z0-9_])\*\*([^*]+)\*\*|\*\*([^*]+)\*\*(?![a-zA-Z0-9_])/gu,
        (_, g1, g2) => `<strong>${g1 ?? g2}</strong>`,
      );
    }).join('');
  }).join('\n');
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      >
        {fixCjkEmphasis(content)}
      </ReactMarkdown>
    </div>
  );
}
