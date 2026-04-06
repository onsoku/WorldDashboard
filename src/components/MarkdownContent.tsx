import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Convert **text** / __text__ to <strong>text</strong> when adjacent to CJK
 * characters, where the CommonMark parser fails to recognise emphasis boundaries.
 * Non-CJK cases are left untouched for the normal parser to handle.
 */
function fixCjkEmphasis(text: string): string {
  // Process line by line to avoid breaking code blocks / headings
  return text.split('\n').map(line => {
    // Skip lines that are code fences, headings-only, or indented code
    if (/^(```|~~~|    |\t)/.test(line)) return line;
    // Replace **text** where inner content has no ** and at least one side is CJK
    const CJK = '\\u3000-\\u9fff\\uf900-\\ufaff\\u3040-\\u309f\\u30a0-\\u30ff';
    const re = new RegExp(
      `(?<=[${CJK}])\\*\\*([^*]+)\\*\\*|\\*\\*([^*]+)\\*\\*(?=[${CJK}])`,
      'gu',
    );
    return line.replace(re, (_, g1, g2) => `<strong>${g1 ?? g2}</strong>`);
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
