import type { JSX } from 'react';
import { Fragment } from 'react';

/**
 * Strip markdown syntax to plain text. Use for previews / single-line contexts
 * (cards, modals, meta descriptions) where formatting must not appear.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^\s*[-*+]\s+/gm, '') // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
    .replace(/^\s*>\s?/gm, '') // blockquote markers
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Matches ![alt](url) image, **bold**, __bold__, *italic*, _italic_, `code`, [label](url).
// Image before link (image is a superset starting with `!`); bold before italic.
const INLINE_RE = /(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

// A root-relative internal link ("/about") is correct as-is on a real vendor's
// own domain (where the storefront IS the domain root), but the exact same
// content also renders inside `/preview/[theme]/*`, where the theme's own
// pages live under a `/preview/<slug>` prefix — without this, every internal
// link written into admin-editable markdown (footer columns, taglines, page
// content) 404s in preview. Only touches root-relative paths; external URLs,
// hash anchors, and empty basePath (the real-vendor case) pass through
// untouched.
function withBasePath(href: string, basePath?: string): string {
  if (!basePath || !href.startsWith('/') || href.startsWith('//')) return href;
  return `${basePath}${href}`;
}

function parseInline(text: string, keyPrefix: string, basePath?: string): React.ReactNode[] {
  const parts = text.split(INLINE_RE).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    const imageMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const [, alt, src] = imageMatch;
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          key={key}
          src={src}
          alt={alt}
          loading="lazy"
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        />
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      return (
        <a key={key} href={withBasePath(href, basePath)} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {label}
        </a>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

// Render the lines of a single paragraph block, preserving single line breaks as <br>.
function renderParagraphLines(block: string, keyPrefix: string, basePath?: string): React.ReactNode[] {
  const lines = block.split('\n');
  return lines.flatMap((line, i) => {
    const content = parseInline(line, `${keyPrefix}-l${i}`, basePath);
    return i < lines.length - 1
      ? [...content, <br key={`${keyPrefix}-br${i}`} />]
      : content;
  });
}

// Split a GFM table row into trimmed cells, tolerating optional leading/trailing pipes.
function tableCells(row: string): string[] {
  return row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/**
 * Render a GFM-style table block, or null if it isn't one. Shape:
 *   | Head A | Head B |
 *   | --- | --- |
 *   | a1 | b1 |
 */
function renderTable(block: string, key: string, basePath?: string): JSX.Element | null {
  const rows = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rows.length < 2 || !rows[0].includes('|')) return null;
  // Second line must be the separator: only |, -, :, and spaces, with at least one dash.
  if (!/^\|?[\s:|-]+\|?$/.test(rows[1]) || !rows[1].includes('-')) return null;

  const headers = tableCells(rows[0]);
  const bodyRows = rows.slice(2).map(tableCells);

  return (
    <table key={key}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{parseInline(h, `${key}-h${i}`, basePath)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bodyRows.map((cells, r) => (
          <tr key={r}>
            {cells.map((c, i) => (
              <td key={i}>{parseInline(c, `${key}-r${r}-${i}`, basePath)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A heading only ever occupies its own first line — `block.match` here is
// deliberately anchored to the start of the block (not per-line via `m`), so
// a block is a heading only when IT, not some later line, opens with 1-3 `#`.
// Anything after that first line (list, paragraph, even another heading) is
// real content of its own, not part of the heading text — see renderBlock.
const HEADING_RE = /^(#{1,3})[ \t]+([^\n]*)(?:\n([\s\S]*))?$/;

/**
 * Render one blank-line-delimited block into its element(s) — usually one,
 * but a heading with no blank line before whatever follows it yields two:
 * the heading (its first line only) plus that remainder re-processed through
 * this same function. Without the split, "### Heading\n- item\n- item" (no
 * blank line — the shape a merchant's pasted copy actually produces) read as
 * ONE heading whose text was the literal list, since `block.startsWith('### ')`
 * used to consume the whole block, list markers and all.
 */
function renderBlock(block: string, key: string, basePath?: string): JSX.Element[] {
  const headingMatch = block.match(HEADING_RE);
  if (headingMatch) {
    const [, hashes, headingText, rest] = headingMatch;
    const headingKey = `${key}-h`;
    const inline = parseInline(headingText, headingKey, basePath);
    const heading =
      hashes.length === 1 ? <h1 key={headingKey}>{inline}</h1> :
      hashes.length === 2 ? <h2 key={headingKey}>{inline}</h2> :
      <h3 key={headingKey}>{inline}</h3>;

    if (!rest || !rest.trim()) return [heading];
    return [heading, ...renderBlock(rest.trim(), `${key}-r`, basePath)];
  }

  return [renderNonHeadingBlock(block, key, basePath)];
}

function renderNonHeadingBlock(block: string, key: string, basePath?: string): JSX.Element {
  // Horizontal rule — a line of only ---, *** or ___ (3+).
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) return <hr key={key} />;

  // GFM table — a header row, a |---|---| separator, then body rows. Without
  // this the pipes render as literal text (the "markdown not rendered" case).
  const tableEl = renderTable(block, key, basePath);
  if (tableEl) return tableEl;

  // Unordered list — every non-empty line starts with -, * or +
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines.every((l) => /^[-*+]\s+/.test(l))) {
    return (
      <ul key={key}>
        {lines.map((line, i) => (
          <li key={i}>{parseInline(line.replace(/^[-*+]\s+/, ''), `${key}-${i}`, basePath)}</li>
        ))}
      </ul>
    );
  }

  // Ordered list — every non-empty line starts with "N. "
  if (lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l))) {
    return (
      <ol key={key}>
        {lines.map((line, i) => (
          <li key={i}>{parseInline(line.replace(/^\d+\.\s+/, ''), `${key}-${i}`, basePath)}</li>
        ))}
      </ol>
    );
  }

  // Blockquote — every non-empty line starts with ">"
  if (lines.length > 0 && lines.every((l) => /^>\s?/.test(l))) {
    const inner = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
    return <blockquote key={key}>{renderParagraphLines(inner, key, basePath)}</blockquote>;
  }

  return <p key={key}>{renderParagraphLines(block, key, basePath)}</p>;
}

/**
 * Convert a markdown string to React elements. Supports headings, bold, italic,
 * inline code, links, ordered/unordered lists, blockquotes, tables, horizontal
 * rules, and line breaks. Returns block-level elements — render inside a wrapper.
 *
 * `basePath` prefixes root-relative links (`/about`) so the same admin-authored
 * content works both on a real vendor's own domain (basePath '') and inside
 * `/preview/[theme]/*` (basePath `/preview/<slug>`) — see `withBasePath` above.
 * Optional and additive; omit it and behavior is unchanged.
 */
export function renderMarkdown(markdown: string, basePath?: string): JSX.Element[] {
  if (!markdown || !markdown.trim()) return [];

  return markdown
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block, index) => renderBlock(block, String(index), basePath));
}
