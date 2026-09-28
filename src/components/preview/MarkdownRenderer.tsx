"use client";

import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown → resume HTML (PRD §8).
 *
 * GFM (tables, strikethrough, task lists, autolinks) is enabled and every
 * element is rendered explicitly so the resume typography is fully controlled
 * by `resume.css` instead of browser defaults.
 */

const REMARK_PLUGINS = [remarkGfm];

/**
 * Give a bare host an explicit `https://` before it reaches the DOM.
 *
 * `react-markdown`'s default transform keeps any value without a protocol, so
 * `- linkedin.com/in/jane` produces `href="linkedin.com/in/jane"`. The DOM
 * resolves that against the deployment origin and the *PDF* records whatever
 * host the app happens to be served from — a link annotation that points at a
 * page which does not exist. Only values that look like a bare host and carry
 * no scheme are rewritten; `mailto:`, `#anchor` and `data:` are left alone.
 */
const BARE_HOST = /^[\w-]+(\.[\w-]+)+([/?#]|$)/;

function urlTransform(url: string): string {
  if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return BARE_HOST.test(url) ? `https://${url}` : url;
}

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, children: ReactNode) {
  const Tag = `h${level}` as const;
  return (
    <Tag className={`rm-heading rm-heading--${level}`} data-level={level}>
      {children}
    </Tag>
  );
}

const COMPONENTS: Components = {
  h1: ({ children }) => heading(1, children),
  h2: ({ children }) => heading(2, children),
  h3: ({ children }) => heading(3, children),
  h4: ({ children }) => heading(4, children),
  h5: ({ children }) => heading(5, children),
  h6: ({ children }) => heading(6, children),
  p: ({ children }) => <p className="rm-paragraph">{children}</p>,
  ul: ({ children }) => <ul className="rm-list">{children}</ul>,
  ol: ({ children }) => <ol className="rm-list rm-list--ordered">{children}</ol>,
  li: ({ children }) => <li className="rm-list-item">{children}</li>,
  a: ({ children, href }) => (
    <a className="rm-link" href={href} rel="noopener noreferrer">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="rm-strong">{children}</strong>,
  em: ({ children }) => <em className="rm-em">{children}</em>,
  del: ({ children }) => <del className="rm-del">{children}</del>,
  blockquote: ({ children }) => <blockquote className="rm-quote">{children}</blockquote>,
  code: ({ children }) => <code className="rm-code">{children}</code>,
  pre: ({ children }) => <pre className="rm-pre">{children}</pre>,
  hr: () => <hr className="rm-rule" />,
  table: ({ children }) => (
    <div className="rm-table-wrap">
      <table className="rm-table">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="rm-th">{children}</th>,
  td: ({ children }) => <td className="rm-td">{children}</td>,
  /*
   * Resume images come from the user's Markdown and must render identically in
   * the preview and in the printed PDF, so they bypass next/image on purpose.
   */
  // eslint-disable-next-line @next/next/no-img-element
  img: ({ src, alt }) => <img className="rm-image" src={src} alt={alt ?? ""} />,
};

/** Renders one Markdown block (a heading line or a content chunk). */
export function MarkdownBlock({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      components={COMPONENTS}
      urlTransform={urlTransform}
      skipHtml
    >
      {source}
    </ReactMarkdown>
  );
}
