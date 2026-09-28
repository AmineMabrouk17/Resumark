import { describe, expect, it } from "vitest";

import { buildOutline, splitBlocks } from "@/lib/markdown/resumeOutline";

const SAMPLE = `# Ada Lovelace

Mathematician

[ada@example.com](mailto:ada@example.com) · [example.com](https://example.com)

## Summary

Wrote the first algorithm.

## Experience

### Analyst — Analytical Engine Co

1843 — 1852

- Designed the notes.
- Published them.

## Education

### Mathematics

## Skills

- Mathematics
- Logic
`;

describe("splitBlocks", () => {
  it("keeps headings and content blocks in source order", () => {
    const blocks = splitBlocks(SAMPLE);
    expect(blocks.map((block) => block.kind)).toEqual([
      "heading", // # Ada Lovelace
      "content", // Mathematician
      "content", // contact line
      "heading", // ## Summary
      "content", // paragraph
      "heading", // ## Experience
      "heading", // ### Analyst
      "content", // dates
      "content", // bullets
      "heading", // ## Education
      "heading", // ### Mathematics
      "heading", // ## Skills
      "content", // bullets
    ]);
  });

  it("reads the heading level and cleaned text", () => {
    const [first] = splitBlocks("# Amine Mabrouk\n\nBody");
    expect(first).toMatchObject({
      kind: "heading",
      level: 1,
      text: "Amine Mabrouk",
    });
  });

  it("strips closing hashes from ATX headings", () => {
    const [first] = splitBlocks("## Experience ##\n");
    expect(first).toMatchObject({ level: 2, text: "Experience" });
  });

  it("ignores hash lines inside fenced code blocks", () => {
    const blocks = splitBlocks(
      "## Real\n\n```md\n# not a heading\n```\n\n# Also real\n",
    );
    const headings = blocks.filter((block) => block.kind === "heading");
    expect(headings.map((block) => block.text)).toEqual(["Real", "Also real"]);
    const code = blocks.filter((block) => block.kind === "content")[0];
    expect(code?.source).toContain("# not a heading");
  });

  it("handles tilde fences and normalised line endings", () => {
    const blocks = splitBlocks("~~~\r\n## fake\r\n~~~\r\n\r\n## real\r\n");
    const headings = blocks.filter((block) => block.kind === "heading");
    expect(headings).toHaveLength(1);
    expect(headings[0]).toMatchObject({ level: 2, text: "real" });
  });

  it("does not treat list items or quotes as headings", () => {
    const blocks = splitBlocks("- # not a heading\n\n> ## not either\n");
    expect(blocks.every((block) => block.kind === "content")).toBe(true);
  });

  it("keeps loose lists together but splits plain paragraphs", () => {
    const blocks = splitBlocks("- one\n\n- two\n\nText after\n");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.source).toBe("- one\n\n- two");
    expect(blocks[1]?.source).toBe("Text after");
  });

  it("reports 1-based line numbers", () => {
    const blocks = splitBlocks("intro\n\n## Later\n\nbody\n");
    expect(blocks.map((block) => block.line)).toEqual([1, 3, 5]);
  });

  it("never loses content", () => {
    const source = splitBlocks(SAMPLE)
      .map((block) => block.source)
      .join("\n");
    expect(source).toContain("Designed the notes.");
    expect(source).toContain("Wrote the first algorithm.");
  });
});

describe("buildOutline", () => {
  const outline = buildOutline(SAMPLE);

  it("groups a masthead, sections and entries", () => {
    expect(outline.nodes.map((node) => node.kind)).toEqual([
      "masthead", // # Ada Lovelace
      "section", // ## Summary
      "section", // ## Experience
      "section", // ## Education
      "section", // ## Skills
    ]);
  });

  it("keeps the title, job title and contact line in the masthead", () => {
    const masthead = outline.nodes[0];
    if (masthead?.kind !== "masthead") throw new Error("expected a masthead");
    expect(masthead.blocks).toHaveLength(3);
    expect(masthead.blocks[0]).toMatchObject({ level: 1, text: "Ada Lovelace" });
  });

  it("turns h3 blocks into entries of their section", () => {
    const experience = outline.nodes[2];
    if (experience?.kind !== "section") throw new Error("expected a section");
    expect(experience.entries).toHaveLength(1);
    expect(experience.entries[0]?.blocks[0]).toMatchObject({
      level: 3,
      text: "Analyst — Analytical Engine Co",
    });
  });

  it("handles a document without headings", () => {
    const loose = buildOutline("Just a paragraph.\n\n- and a list\n");
    expect(loose.nodes).toHaveLength(1);
    expect(loose.nodes[0]?.kind).toBe("loose");
  });

  it("treats a second h1 as a new masthead", () => {
    const two = buildOutline("# One\n\na\n\n# Two\n\nb\n");
    expect(two.nodes.map((node) => node.kind)).toEqual(["masthead", "masthead"]);
  });

  it("keeps deep headings inside the current entry", () => {
    const deep = buildOutline("## Section\n\n### Entry\n\n#### Sub\n\ntext\n");
    const section = deep.nodes[0];
    if (section?.kind !== "section") throw new Error("expected a section");
    expect(section.entries[0]?.blocks.map((block) => block.kind)).toEqual([
      "heading",
      "heading",
      "content",
    ]);
  });
});
