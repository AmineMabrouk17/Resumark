/**
 * Lightweight structural view of the resume Markdown.
 *
 * Markdown stays the source of truth (PRD §33): this module only groups the
 * *top level* blocks that Markdown already defines, so the renderer can emit
 * real document structure (masthead / section / entry) and apply the page-break
 * rules required by PRD §19.
 *
 * It is intentionally a line scanner rather than a second Markdown parser:
 * headings must be recognised at column 0, everything else is passed to
 * react-markdown untouched. If the scan ever mis-groups something, no content
 * is ever lost — the blocks are still rendered in their original order.
 */

export type HeadingBlock = {
  kind: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  source: string;
  line: number;
};

export type ContentBlock = {
  kind: "content";
  source: string;
  line: number;
};

export type ResumeBlock = HeadingBlock | ContentBlock;

export type ResumeEntry = {
  kind: "entry";
  /** Heading level of the entry (h3 job title, h4 degree, ...). */
  level: number;
  blocks: ResumeBlock[];
};

export type ResumeSection = {
  kind: "section";
  level: number;
  blocks: ResumeBlock[];
  /** Sub-blocks introduced by deeper headings (kept together on one page). */
  entries: ResumeEntry[];
};

export type ResumeMasthead = {
  kind: "masthead";
  level: number;
  blocks: ResumeBlock[];
};

export type ResumeLoose = {
  kind: "loose";
  blocks: ResumeBlock[];
};

export type ResumeNode = ResumeMasthead | ResumeSection | ResumeLoose;

export type ResumeOutline = {
  nodes: ResumeNode[];
  /** Number of top level blocks found; useful for diagnostics and tests. */
  blockCount: number;
};

const ATX_HEADING = /^(#{1,6})[ \t]+(\S.*?)[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM = /^ {0,3}([-*+]|\d{1,9}[.)])([ \t]|$)/;
const TABLE_ROW = /^[ \t]*\|/;

function stripClosingHashes(text: string): string {
  return text.replace(/[ \t]+#+[ \t]*$/, "").trim();
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function indentOf(line: string): number {
  return /^[\t ]*/.exec(line)?.[0].length ?? 0;
}

function isListItem(line: string): boolean {
  return LIST_ITEM.test(line);
}

function isTableRow(line: string): boolean {
  return TABLE_ROW.test(line);
}

/**
 * A blank line only breaks a group when the next line really starts something
 * new. Loose lists, blockquotes and tables keep their internal blank lines.
 */
function continuesGroup(current: string[], next: string): boolean {
  const first = current[0] ?? "";
  if (current.some(isTableRow) && isTableRow(next)) return true;
  if (first.startsWith(">") && next.startsWith(">")) return true;
  if (isListItem(first)) {
    if (isListItem(next) || indentOf(next) >= 2) return true;
  }
  return false;
}

/** Splits a heading-free buffer into top level Markdown blocks. */
function splitBuffer(buffer: string[], firstLine: number): ContentBlock[] {
  const groups: ContentBlock[] = [];
  let current: string[] = [];
  let startIndex = 0;

  const close = () => {
    const source = current
      .join("\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n+$/, "");
    if (source.trim().length > 0) {
      groups.push({ kind: "content", source, line: firstLine + startIndex });
    }
    current = [];
  };

  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer[index] ?? "";

    if (!isBlank(line)) {
      current.push(line);
      continue;
    }

    let next = index;
    while (next < buffer.length && isBlank(buffer[next] ?? "")) next += 1;
    if (next >= buffer.length) break;

    if (current.length > 0 && continuesGroup(current, buffer[next] ?? "")) {
      for (let filler = index; filler < next; filler += 1) {
        current.push(buffer[filler] ?? "");
      }
      index = next - 1;
      continue;
    }

    close();
    startIndex = next;
    index = next - 1;
  }

  close();
  return groups;
}

/** Splits Markdown into heading and content blocks, honouring fenced code. */
export function splitBlocks(markdown: string): ResumeBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ResumeBlock[] = [];
  let buffer: string[] = [];
  let bufferLine = 1;
  let fence: string | null = null;

  const flush = () => {
    blocks.push(...splitBuffer(buffer, bufferLine));
    buffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = FENCE.exec(line);

    if (fenceMatch) {
      const marker = fenceMatch[1] ?? "";
      if (fence === null) {
        flush();
        fence = `${marker[0] ?? ""}${marker.length}`;
      } else if (fence === `${marker[0] ?? ""}${marker.length}`) {
        fence = null;
      }
      if (buffer.length === 0) bufferLine = index + 1;
      buffer.push(line);
      continue;
    }

    if (fence !== null) {
      if (buffer.length === 0) bufferLine = index + 1;
      buffer.push(line);
      continue;
    }

    const heading = ATX_HEADING.exec(line);
    if (heading) {
      flush();
      const level = (heading[1] ?? "#").length as HeadingBlock["level"];
      blocks.push({
        kind: "heading",
        level,
        text: stripClosingHashes(heading[2] ?? ""),
        source: line,
        line: index + 1,
      });
      continue;
    }

    if (buffer.length === 0) bufferLine = index + 1;
    buffer.push(line);
  }

  flush();
  return blocks;
}

/**
 * Groups blocks into masthead (h1), sections (h2) and entries (h3 / h4).
 * Deep headings (h5+) stay inside the current entry as content.
 */
export function buildOutline(markdown: string): ResumeOutline {
  const blocks = splitBlocks(markdown);
  const nodes: ResumeNode[] = [];

  const current = () => nodes[nodes.length - 1];

  for (const block of blocks) {
    if (block.kind === "heading" && block.level <= 2) {
      nodes.push(
        block.level === 1
          ? { kind: "masthead", level: 1, blocks: [block] }
          : { kind: "section", level: 2, blocks: [block], entries: [] },
      );
      continue;
    }

    if (block.kind === "heading" && (block.level === 3 || block.level === 4)) {
      const parent = current();
      if (parent && parent.kind === "section") {
        const lastEntry = parent.entries[parent.entries.length - 1];
        // An h4 below an h3 is a sub-heading of that entry (a university under
        // a degree), not a new entry.
        if (block.level === 4 && lastEntry && lastEntry.level === 3) {
          lastEntry.blocks.push(block);
        } else {
          parent.entries.push({
            kind: "entry",
            level: block.level,
            blocks: [block],
          });
        }
      } else if (parent && parent.kind === "loose") {
        parent.blocks.push(block);
      } else {
        nodes.push({
          kind: "loose",
          blocks: [block],
        });
      }
      continue;
    }

    const parent = current();
    if (parent && parent.kind === "section" && parent.entries.length > 0) {
      parent.entries[parent.entries.length - 1]?.blocks.push(block);
      continue;
    }
    if (parent) {
      parent.blocks.push(block);
      continue;
    }
    nodes.push({ kind: "loose", blocks: [block] });
  }

  return { nodes, blockCount: blocks.length };
}
