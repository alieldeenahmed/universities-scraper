import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "ul", "ol", "table", "tr", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
]);

function walk(node: AnyNode, out: string[]): void {
  if (node.type === "text") {
    out.push(node.data.replace(/\s+/g, " "));
    return;
  }
  if (node.type !== "tag") return;

  const tag = node.name.toLowerCase();
  if (tag === "script" || tag === "style") return;
  if (tag === "br") {
    out.push("\n");
    return;
  }

  const block = BLOCK_TAGS.has(tag);
  if (block) out.push("\n\n");
  if (tag === "li") out.push("\n- ");
  for (const child of node.children) walk(child, out);
  if (block) out.push("\n\n");
}

function tidy(text: string): string {
  return text
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain text for a list of nodes. Lists become "- item" lines, paragraphs get a blank line between them. */
export function nodesToText(nodes: AnyNode[]): string {
  const out: string[] = [];
  for (const node of nodes) walk(node, out);
  return tidy(out.join(""));
}

export function htmlToText(html: string): string {
  const $ = cheerio.load(html, {}, false);
  return nodesToText($.root().contents().toArray());
}
