import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

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
    if (/^(```|~~~|    |\t)/.test(line)) return line;
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {fixCjkEmphasis(content)}
      </ReactMarkdown>
    </div>
  );
}
