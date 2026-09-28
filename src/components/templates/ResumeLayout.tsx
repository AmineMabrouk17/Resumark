"use client";

import type { ResumeBlock, ResumeNode, ResumeOutline } from "@/lib/markdown/resumeOutline";
import { MarkdownBlock } from "@/components/preview/MarkdownRenderer";

/**
 * Shared document renderer.
 *
 * Every template reuses this tree, which is what keeps Markdown identical
 * across templates (PRD §11) and gives print a real structure to hang
 * `break-inside` / `break-after` rules on (PRD §19).
 *
 * Blocks are emitted without a wrapper element: the structural view already
 * splits the document into single top level Markdown blocks, so the title,
 * the job title and the contact line stay adjacent siblings and can be styled
 * with plain CSS (`.resume-masthead h1 + p`).
 */

function Blocks({ blocks }: { blocks: ResumeBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} source={block.source} />
      ))}
    </>
  );
}

function ResumeNodeView({ node }: { node: ResumeNode }) {
  switch (node.kind) {
    case "masthead":
      return (
        <header className="resume-masthead">
          <Blocks blocks={node.blocks} />
        </header>
      );
    case "section":
      return (
        <section className="resume-section">
          <Blocks blocks={node.blocks} />
          {node.entries.map((entry, index) => (
            /*
             * A `div`, not an `article`. Nothing here is independently
             * addressable or syndication-worthy: the masthead is the only real
             * `header`, and an `article` per job invents a document outline out
             * of what is one self-contained resume. `break-inside: avoid` still
             * applies — it hangs off the class, not the element.
             */
            <div className="resume-entry" key={index}>
              <Blocks blocks={entry.blocks} />
            </div>
          ))}
        </section>
      );
    case "loose":
      return (
        <div className="resume-loose">
          <Blocks blocks={node.blocks} />
        </div>
      );
  }
}

export function ResumeLayout({ outline }: { outline: ResumeOutline }) {
  return (
    <>
      {outline.nodes.map((node, index) => (
        <ResumeNodeView key={index} node={node} />
      ))}
    </>
  );
}
