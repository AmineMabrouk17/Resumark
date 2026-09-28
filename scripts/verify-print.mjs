/**
 * End-to-end verification of the Resumark MVP against a real browser.
 *
 * Runs headless Chromium through playwright-core, drives the actual UI, prints
 * the page with `page.pdf({ preferCSSPageSize: true })` — i.e. the exact output a
 * user's "Save as PDF" produces — and inspects the result with poppler
 * (`pdfinfo` / `pdftotext`). Screenshots and PDFs are written to
 * `verification/` for human review.
 *
 *   npm run dev                    # in one shell
 *   PORT=3100 npm run verify:print # in another
 *
 * Environment:
 *   BASE_URL     app under test              (default http://localhost:3100)
 *   OUT_DIR      artifact directory          (default verification)
 *   CHROMIUM     chromium executable         (auto-detected)
 *   VIEWPORTS    "desktop,tablet,mobile"     (default: all)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const OUT_DIR = resolve(ROOT, process.env.OUT_DIR ?? "verification");

/**
 * Templates are read from the switcher rather than listed here. A hardcoded
 * array is a list that silently goes stale: adding a template to
 * `RESUME_TEMPLATES` without editing this file would leave the new template
 * unverified and every run still green. Reading the DOM makes the harness
 * cover every template the app actually ships, which is the thing worth
 * asserting.
 */
async function templateIds(page) {
  const ids = await page.locator("#template-select option").evaluateAll((options) =>
    options.map((option) => option.value),
  );
  if (ids.length === 0) throw new Error("no templates in #template-select");
  return ids;
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 900, height: 1180 },
  mobile: { width: 390, height: 844 },
};

/**
 * WCAG 1.4.10 reflow: 320 CSS px is 1280 px at 400 % zoom, the threshold where
 * a two-dimensional layout has to become one-dimensional. `REFLOW_VIEWPORTS` are
 * checked in a second pass for horizontal scrolling, and 200 % browser zoom is
 * checked by halving the viewport at 2× device pixel ratio — the real thing,
 * not a `transform: scale()` the app can cheat on.
 */
const REFLOW_WIDTH_PX = 320;
const ZOOM_CASES = [
  { label: "200% of a 1280px window", width: 640, height: 900, deviceScaleFactor: 2 },
  { label: "200% of a 1024px window", width: 512, height: 900, deviceScaleFactor: 2 },
];

/** An image at least this wide is a page-sized bitmap, not an icon or a mask. */
const RASTER_WIDTH_PX = 1000;

/** 96 CSS px per inch, 25.4 mm per inch. */
const PX_PER_MM = 96 / 25.4;
const A4 = { widthMm: 210, heightMm: 297 };
/** Must match `@page { margin: 12mm 15mm }` in globals.css. */
const PAGE_MARGIN_X_MM = 15;
const PAGE_MARGIN_Y_MM = 12;
const A4_WIDTH_PX = A4.widthMm * PX_PER_MM; //  793.70
const A4_HEIGHT_PX = A4.heightMm * PX_PER_MM; // 1122.52
/** Printable area of one A4 page with the configured margins. */
const PRINTABLE_WIDTH_PX = (A4.widthMm - 2 * PAGE_MARGIN_X_MM) * PX_PER_MM;
const PRINTABLE_HEIGHT_PX = (A4.heightMm - 2 * PAGE_MARGIN_Y_MM) * PX_PER_MM;
/** Smallest body font the One Page engine may ever produce (onePage.ts). */
const MIN_BODY_FONT_PX = 9.5;
/** Below this the sheet is scaled too far to read; the stage scrolls instead. */
const MIN_PREVIEW_ZOOM = 0.72;
/** The ladder's final font multiplier (onePage.ts `FONT_FLOOR`). */
const FONT_FLOOR = 0.95;

const LOGO = (s) => `\x1b[36m${s}\x1b[0m`;
const PASS = (s) => `\x1b[32m${s}\x1b[0m`;
const FAIL = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[90m${s}\x1b[0m`;

const results = [];
let currentGroup = "";

function group(name) {
  currentGroup = name;
  console.log(`\n${LOGO(`▸ ${name}`)}`);
}

function check(name, ok, detail = "") {
  results.push({ group: currentGroup, name, ok: Boolean(ok), detail });
  const mark = ok ? PASS("✔") : FAIL("✘");
  console.log(`  ${mark} ${name}${detail ? DIM(` — ${detail}`) : ""}`);
  return Boolean(ok);
}

function near(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

function fmt(value, unit = "px") {
  return `${Number(value).toFixed(2)}${unit}`;
}

function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/root/.cache/ms-playwright";
  try {
    const dir = readdirSync(cache).find((entry) => entry.startsWith("chromium-"));
    if (dir) return join(cache, dir, "chrome-linux64", "chrome");
  } catch {
    // Fall through to the bundled resolution below.
  }
  return undefined;
}

function run(bin, args) {
  return execFileSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function has(bin) {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* PDF helpers                                                                 */
/* -------------------------------------------------------------------------- */

function pdfInfo(pdfPath) {
  const out = run("pdfinfo", [pdfPath]);
  const info = {};
  for (const line of out.split("\n")) {
    const match = /^([A-Za-z][A-Za-z ()/]*):\s*(.*)$/.exec(line);
    if (match) info[match[1].trim()] = match[2].trim();
  }
  const size = /^([\d.]+) x ([\d.]+) pts(?: \((.*)\))?$/.exec(info["Page size"] ?? "");
  return {
    raw: out,
    pages: Number(info.Pages ?? 0),
    pageSize: info["Page size"] ?? "",
    pageSizeLabel: size?.[3] ?? "",
    pageWidthPt: size ? Number(size[1]) : 0,
    pageHeightPt: size ? Number(size[2]) : 0,
    producer: info["Producer"] ?? "",
  };
}

function pdfText(pdfPath) {
  return run("pdftotext", ["-layout", pdfPath, "-"]).replace(//g, "\n");
}

/**
 * Real print geometry, read back from the PDF itself: the bounding box of the
 * first and last word on page 1 in PostScript points. This is the only way to
 * assert the `@page` margins — media emulation lays out at the screen viewport,
 * where `@page` does not apply.
 */
function pdfTextGeometry(pdfPath) {
  const xml = run("pdftotext", ["-f", "1", "-l", "1", "-bbox", pdfPath, "-"]);
  const words = [...xml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">/g)].map(
    (m) => ({ xMin: +m[1], yMin: +m[2], xMax: +m[3], yMax: +m[4] }),
  );
  if (words.length === 0) return null;
  return {
    words: words.length,
    left: words[0].xMin,
    top: words[0].yMin,
    right: Math.max(...words.map((w) => w.xMax)),
    bottom: Math.max(...words.map((w) => w.yMax)),
  };
}

/**
 * Skia compresses its content streams but link annotations stay in the plain
 * object dictionaries, so a raw scan finds every URI the print engine emitted.
 */
function pdfUris(pdfPath) {
  const raw = readFileSync(pdfPath).toString("latin1");
  const uris = new Set();
  for (const match of raw.matchAll(/\/URI\s*\(((?:\\.|[^)\\])*)\)/g)) {
    uris.add(match[1].replace(/\\([()\\])/g, "$1"));
  }
  return [...uris];
}

/**
 * Every embedded image in the PDF, as `{ width, height }`, and the widest.
 *
 * A canvas/html2canvas export would embed one bitmap covering the whole page — a
 * full A4 page at print resolution is ~1000px wide or more. Small images (icons,
 * masks) are fine; a page-sized one is not.
 *
 * Every image is reported, not just the first, and the window between
 * `/Subtype /Image` and `/Width` is generous: PDF dictionaries are free to put
 * `/Length`, `/Filter`, a colour space and an `/SMask` in between, and a window
 * that is too narrow turns a large image into an invisible one — a check that
 * passes because it failed to look.
 *
 * The honest limit: a PDF that stores its objects in a compressed object stream
 * (`/Type /ObjStm`) hides its image dictionaries from any byte scan. Poppler's
 * `pdfimages -list` does decode them, and the harness requires poppler anyway,
 * so that is the primary source and this is the cross-check.
 */
function pdfImages(pdfPath) {
  const raw = readFileSync(pdfPath).toString("latin1");
  const images = [];
  for (const match of raw.matchAll(/\/Subtype\s*\/Image.{0,2000}?\/Width\s+(\d+).{0,2000}?\/Height\s+(\d+)/gs)) {
    images.push({ width: Number(match[1]), height: Number(match[2]) });
  }
  return images;
}

/** The widest embedded image at or above the raster threshold, or `null`. */
function pdfPageRaster(pdfPath) {
  const page = pdfImages(pdfPath).find((image) => image.width >= RASTER_WIDTH_PX);
  return page ? page.width : null;
}

/** `pdfimages -list`, which decodes compressed object streams. `null` if absent. */
function pdfImagesList(pdfPath) {
  try {
    return execFileSync("pdfimages", ["-list", pdfPath], { encoding: "utf8" });
  } catch {
    return null;
  }
}

/**
 * "No embedded image is anywhere near page-sized", by both methods available.
 *
 * `pdfimages -list` prints one row per image with its pixel dimensions, and
 * nothing at all when the PDF has no images — which is the case for every
 * fixture here, since the export is vector text by construction.
 */
function noFullPageRaster(pdfPath) {
  const scanned = pdfImages(pdfPath);
  const wide = scanned.find((image) => image.width >= RASTER_WIDTH_PX);
  if (wide) return `FAIL ${wide.width}px wide image, found by byte scan`;
  const listing = pdfImagesList(pdfPath);
  if (listing === null) return "pdfimages unavailable; byte scan found none";
  // Header: "page num type width height color comp bpc enc interp id ...".
  const rows = listing
    .split("\n")
    .slice(2)
    .map((line) => line.trim().split(/\s+/))
    .filter((cells) => cells.length >= 5 && /^\d+$/.test(cells[2]) && /^\d+$/.test(cells[3]));
  const big = rows.find((cells) => Number(cells[2]) >= RASTER_WIDTH_PX);
  if (big) return `FAIL ${big[2]}px wide image, found by pdfimages`;
  return `${scanned.length} by byte scan, ${rows.length} by pdfimages — none page-sized`;
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The shipped example resume, read out of `defaultResume.ts` and *only* out of
 * its template literal.
 *
 * The previous extraction deleted the `export … = \`` line and the closing
 * backtick, which left the file's JSDoc block sitting above the string as part
 * of the fixture. It looked harmless — the comment has no headings, so the
 * heading lists were unaffected — and it was not: the comment's second line
 * starts with `* `, and the `*` was being read as a bullet. A check that counts
 * the fixture's bullets was therefore counting two that the app has never
 * heard of, and "every bullet survives into the PDF" was a test of the comment
 * block. Anchoring on the first backtick after the declaration is the fix.
 */
const DEFAULT_MARKDOWN = (() => {
  const source = readFileSync(join(ROOT, "src/lib/defaultResume.ts"), "utf8");
  const start = source.indexOf("export const DEFAULT_MARKDOWN = `");
  if (start === -1) throw new Error("DEFAULT_MARKDOWN declaration not found in defaultResume.ts");
  const open = source.indexOf("`", start) + 1;
  const close = source.lastIndexOf("`");
  if (close <= open) throw new Error("could not find the end of the DEFAULT_MARKDOWN template literal");
  return source.slice(open, close).replace(/\\`/g, "`").replace(/\$\{/g, "${");
})();

/** Every heading of the shipped example resume (PRD §37). */
const DEFAULT_HEADINGS = DEFAULT_MARKDOWN.split("\n")
  .filter((line) => /^#{1,3} \S/.test(line))
  .map((line) => line.replace(/^#+ /, "").trim());

/** Section headings of a fixture, lower-cased: h2 is rendered upper-case. */
const fixtureHeadings = (markdown) =>
  markdown
    .split("\n")
    .filter((line) => /^## \S/.test(line))
    .map((line) => line.replace(/^## /, "").trim());

/** A resume that is far too long for a single A4 page. */
function longMarkdown() {
  const parts = ["# Jordan Fixture\n", "Long Resume Fixture\n", "[jordan@example.com](mailto:jordan@example.com)\n"];
  for (let section = 1; section <= 8; section += 1) {
    parts.push(`\n## Section ${section}\n`);
    for (let entry = 1; entry <= 3; entry += 1) {
      parts.push(`\n### Role ${entry} — Company ${section}\n`);
      parts.push(`\nJan 20${20 + entry} — Dec 20${20 + entry} · City ${section}\n`);
      for (let bullet = 1; bullet <= 6; bullet += 1) {
        parts.push(
          `\n- Delivered outcome ${bullet} for the ${section}.${entry} programme, reducing operational cost by ${bullet * 3} % and improving reliability across the board.`,
        );
      }
    }
  }
  parts.push("\n## Education\n\n### BSc Computer Science\n\nUniversity of Fixture, 2020\n");
  return parts.join("\n");
}

const LONG_MARKDOWN = longMarkdown();

/**
 * The shipped example plus two extra sections: long enough that One Page mode
 * has to compact, short enough that it can still reach a single page.
 */
const MEDIUM_MARKDOWN = `${DEFAULT_MARKDOWN}
## Volunteering

### Mentor — Open Source Saturday

2022 — 2024 · Paris

- Ran two beginner workshops on Markdown and accessible web applications.
- Reviewed first pull requests for twelve student contributors.
- Wrote the onboarding guide still used by the local meet-up.

### Coach — Coding Club

Sep 2021 — Jun 2022 · Remote

- Designed a twelve-week curriculum around the TypeScript curriculum.
- Mentored six students through their first production deployment.

## Publications

### Author — "Shipping accessible design systems"

2023 · Blog

- Wrote about token pipelines and how they keep interfaces consistent.
`;

/* -------------------------------------------------------------------------- */
/* Page helpers                                                                */
/* -------------------------------------------------------------------------- */

async function setStoredState(page, state) {
  await page.evaluate((payload) => {
    window.localStorage.setItem("resumark:resume:v1", JSON.stringify(payload));
  }, state);
}

/**
 * Opens the app in a fresh context.
 *
 * NOTE: media emulation is deliberately left untouched. `emulateMedia({media:
 * "screen"})` *overrides* the media type `page.pdf()` uses, which would print
 * the application chrome instead of the resume. Only `verifyPrintIsolation`
 * switches to print media, and it switches back afterwards.
 */
async function openApp(
  browser,
  { viewport = VIEWPORTS.desktop, state = null, deviceScaleFactor = 1 } = {},
) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, locale: "en-GB" });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  if (state) {
    // Seed storage on the origin, then load the app.
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await setStoredState(page, state);
  }

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  // `attached`, not `visible`: on mobile the preview starts behind the Editor tab.
  await page.locator(".resume-document").first().waitFor({ state: "attached", timeout: 30_000 });
  await page.locator(".app-header").first().waitFor({ state: "visible", timeout: 30_000 });
  await settle(page);
  return { context, page, consoleErrors, pageErrors };
}

/**
 * Waits for the fit pass to have caught up with what is in the DOM.
 *
 * The badge renders immediately with a placeholder, and the preview renders the
 * stored Markdown one deferred render later. Waiting for `data-measured` alone
 * therefore races: the first measurement still describes the previous content.
 * Requiring the measured height to equal the live `scrollHeight` makes the wait
 * exact, and it also waits out the compaction passes in One Page mode because
 * each pass changes the height again.
 */
async function settle(page) {
  await page.waitForFunction(
    () => {
      const badge = document.querySelector(".page-badge");
      const document_ = document.querySelector(".resume-document");
      if (!badge || !document_) return false;
      if (badge.dataset.measured !== "true") return false;
      return Math.abs(Number(badge.dataset.contentHeight) - document_.scrollHeight) <= 1;
    },
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(150);
}

/** Monaco is bundled, so the first load compiles a lot of code. */
async function waitForEditor(page) {
  await page
    .locator(".monaco-editor")
    .first()
    .waitFor({ state: "visible", timeout: 90_000 })
    .catch(() => {});
  await page.waitForTimeout(250);
}

const docBox = (page) => page.locator(".resume-document").first().evaluate((el) => {
  const style = getComputedStyle(el);
  return {
    height: el.getBoundingClientRect().height / (Number(style.getPropertyValue("--rm-zoom")) || 1),
    scrollHeight: el.scrollHeight,
    fontSize: Number.parseFloat(style.fontSize),
    lineHeight: style.lineHeight,
    overflow: style.overflow,
    transform: style.transform,
    density: {
      section: style.getPropertyValue("--rm-d-section").trim(),
      font: style.getPropertyValue("--rm-d-font").trim(),
    },
  };
});

const badgeText = (page) => page.locator(".page-badge").first().innerText();

async function pdfOf(page, file) {
  const path = join(OUT_DIR, file);
  await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
  return path;
}

/**
 * Print to PDF with Chromium's "Headers and footers" option *on*.
 *
 * `page.pdf()` is CDP `Page.printToPDF`, whose `displayHeaderFooter` defaults
 * to false — so every PDF this harness inspects is cleaner than what a user gets
 * by default, and the harness would never notice a regression caused by those
 * headers. This drives the same CDP command with the flag the user's browser
 * has on by default, which is the only way to check the promise that One Page
 * mode still produces one page out of the printer.
 */
async function pdfWithHeaders(page, file) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  });
  await cdp.detach();
  const path = join(OUT_DIR, file);
  writeFileSync(path, Buffer.from(data, "base64"));
  return path;
}

/* -------------------------------------------------------------------------- */
/* Checks                                                                      */
/* -------------------------------------------------------------------------- */

async function verifyBoot(page, consoleErrors, pageErrors) {
  group("Boot, console and DOM");
  await waitForEditor(page);
  check("app shell mounted", await page.locator(".app-shell").isVisible());
  check("header controls present", (await page.locator(".app-header__controls .header-button").count()) >= 2);
  check("Monaco editor mounted", (await page.locator(".monaco-editor").count()) > 0);
  check("preview document rendered", (await page.locator(".resume-document").count()) === 1);
  check(
    "H1 name rendered in preview",
    (await page.locator(".resume-document h1").first().innerText()).includes("Amine Mabrouk"),
  );
  const missing = [];
  const previewText = (await page.locator(".resume-document").first().textContent()).toLowerCase();
  for (const heading of DEFAULT_HEADINGS) {
    if (!previewText.includes(heading.toLowerCase())) missing.push(heading);
  }
  check("every heading of the default resume is rendered", missing.length === 0, missing.join(", "));
  check(
    "contact links rendered as anchors",
    (await page.locator('.resume-document a[href^="mailto:"]').count()) >= 1 &&
      (await page.locator('.resume-document a[href^="https://"]').count()) >= 1,
  );
  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  const ignorable = consoleErrors.filter((text) => !/favicon|404 \(Not Found\)/i.test(text));
  check("no console errors", ignorable.length === 0, ignorable.slice(0, 3).join(" | "));
}

async function verifyScreenGeometry(page) {
  group("A4 screen geometry (PRD §7, §26)");
  const sheet = await page.locator(".preview-sheet").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      width: rect.width,
      height: rect.height,
      zoom: style.zoom,
      paddingTop: style.paddingTop,
      paddingLeft: style.paddingLeft,
      boxShadow: style.boxShadow,
    };
  });
  check(
    "sheet width = 210mm",
    near(sheet.width, A4_WIDTH_PX, 1.5),
    `${fmt(sheet.width)} (want ${fmt(A4_WIDTH_PX)})`,
  );
  check(
    "sheet height = 297mm",
    near(sheet.height, A4_HEIGHT_PX, 1.5),
    `${fmt(sheet.height)} (want ${fmt(A4_HEIGHT_PX)})`,
  );
  check(
    "sheet padding mirrors @page margins (12mm / 15mm)",
    near(Number.parseFloat(sheet.paddingTop), 12 * PX_PER_MM, 1) &&
      near(Number.parseFloat(sheet.paddingLeft), 15 * PX_PER_MM, 1),
    `top ${sheet.paddingTop} / left ${sheet.paddingLeft}`,
  );
  check("preview zoom = 1 on a wide desktop viewport", sheet.zoom === "1", `zoom=${sheet.zoom}`);
  check("page shadow only on screen", sheet.boxShadow !== "none");

  // The screen sheet and the printed page must offer the same text column, so
  // the preview is a true WYSIWYG of the PDF.
  const contentWidth = await page
    .locator(".resume-document")
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
  check(
    "text column = printable width (true WYSIWYG)",
    near(contentWidth, PRINTABLE_WIDTH_PX, 1.5),
    `${fmt(contentWidth)} (want ${fmt(PRINTABLE_WIDTH_PX)})`,
  );
}

async function verifyNormalMode(page) {
  group("Normal mode + multi-page print (PRD §17, §18, §24)");
  const badge = await badgeText(page);
  check("page badge reports a page count", /^\d+ pages?$/.test(badge.trim()), `badge="${badge.trim()}"`);
  const predicted = Number(badge.trim().split(" ")[0]);

  const pdf = await pdfOf(page, "normal-classic.pdf");
  const info = pdfInfo(pdf);
  check(
    "PDF page size is A4 portrait",
    near(info.pageWidthPt, A4.widthMm * 2.8346457, 2) && near(info.pageHeightPt, A4.heightMm * 2.8346457, 2),
    `${info.pageSize}`,
  );
  check("PDF producer is the browser print engine", /skia|chrome/i.test(info.producer), info.producer);
  check(
    "PDF page count matches the on-screen badge",
    info.pages === predicted,
    `pdf=${info.pages} badge=${predicted}`,
  );

  const text = pdfText(pdf);
  check("PDF text is selectable and searchable", text.includes("Amine Mabrouk") && text.includes("Infraway"));

  /*
   * Every bullet's *text* reaches the PDF, counted rather than spot-checked.
   *
   * The marker itself is deliberately not asserted: `list-style: disc` and
   * Minimal's en dash are glyphs drawn on the marker box, not characters in the
   * text layer, so they cannot appear in `pdftotext` output and an ATS parser
   * never sees them. What it does see is the item text, which is the part that
   * matters, and that is what is measured here.
   *
   * Whitespace is normalised on both sides because a bullet wraps across two
   * lines in the PDF and the extractor inserts a newline in the middle of it.
   */
  const squash = (value) => value.replace(/\s+/g, " ");
  const squashedText = squash(text);
  const bullets = DEFAULT_MARKDOWN.split("\n")
    .filter((line) => /^\s*[-*+]\s+\S/.test(line))
    .map((line) => squash(line.replace(/^\s*[-*+]\s+/, "")).trim());
  const missingBullets = bullets.filter((bullet) => !squashedText.includes(bullet));
  check(
    "every bullet's text survives into the PDF",
    bullets.length > 0 && missingBullets.length === 0,
    missingBullets.length === 0
      ? `${bullets.length}/${bullets.length} bullets`
      : `${missingBullets.length}/${bullets.length} lost: ${missingBullets[0]?.slice(0, 48)}`,
  );
  check(
    "PDF contains no full-page raster (not a screenshot)",
    pdfPageRaster(pdf) === null,
    noFullPageRaster(pdf),
  );

  const uris = pdfUris(pdf);
  check(
    "PDF keeps real link annotations",
    uris.some((uri) => uri.startsWith("mailto:")) && uris.some((uri) => uri.startsWith("https://")),
    `${uris.length} URIs: ${uris.slice(0, 3).join(", ")}`,
  );
  /*
   * Anything that is not resume content. "Skip to" earned its place here: a
   * `position: fixed` skip link is off-screen, not hidden, and Chromium repeats
   * fixed elements at the foot of *every* page of the PDF.
   */
  const chrome = ["Export PDF", "Autosave", "Ctrl/Cmd", "Loading editor", "A4 · 210", "Skip to"];
  const leaked = chrome.filter((word) => text.includes(word));
  check("no application chrome leaks into the PDF", leaked.length === 0, leaked.join(", "));
  return { pages: info.pages };
}

async function verifyTemplates(browser) {
  group("Templates (PRD §10, §11)");
  const { context, page, consoleErrors, pageErrors } = await openApp(browser);
  const templates = await templateIds(page);
  /** template -> serialised look signature, for the distinctness check below. */
  const fingerprint = new Map();
  const lookSamples = [];
  check("at least the three original templates ship", templates.length >= 3, templates.join(", "));

  for (const template of templates) {
    await page.selectOption("#template-select", template);
    await settle(page);
    /*
     * The class name is derived from the convention `resume--<id>` rather than
     * restated per template, so a template whose registry entry and CSS block
     * disagree on the name fails here instead of being quietly skipped.
     */
    const expected = `resume--${template}`;
    const className = await page.locator(".resume-document").first().getAttribute("class");
    check(`${template}: document class applied`, className?.includes(expected) ?? false, className ?? "");

    const name = await page.locator(".resume-document h1").first().innerText();
    check(`${template}: Markdown untouched by the switch`, name.includes("Amine Mabrouk"), name);

    /*
     * A template that is indistinguishable from another is a real defect, not a
     * matter of taste: the switcher would be offering a choice that does
     * nothing. The masthead rule and the section-heading signature are what
     * differ most between templates, so they are what is compared.
     */
    const look = await page.locator(".resume-document").first().evaluate((doc) => {
      const h1 = doc.querySelector(".resume-masthead h1");
      const h2 = doc.querySelector(".resume-section h2");
      const cs = h2 ? getComputedStyle(h2) : null;
      return {
        nameSize: h1 ? getComputedStyle(h1).fontSize : null,
        // The display face, not the body face: a template may legitimately
        // share the body typeface and still be a different design.
        nameFontFamily: h1 ? getComputedStyle(h1).fontFamily : null,
        h2Tracking: cs ? cs.letterSpacing : null,
        h2BorderBottom: cs ? cs.borderBottomWidth : null,
        h2BorderLeft: cs ? cs.borderLeftWidth : null,
        h2Transform: cs ? cs.textTransform : null,
        bodyFontFamily: getComputedStyle(doc).fontFamily,
        height: Math.round(doc.getBoundingClientRect().height),
      };
    });
    fingerprint.set(template, JSON.stringify(look));
    lookSamples.push({ template, look });

    const pdf = await pdfOf(page, `template-${template}.pdf`);
    const info = pdfInfo(pdf);
    check(
      `${template}: prints on A4`,
      near(info.pageWidthPt, A4.widthMm * 2.8346457, 2) && near(info.pageHeightPt, A4.heightMm * 2.8346457, 2),
      `${info.pageSize}, ${info.pages} page(s)`,
    );
    check(`${template}: PDF text intact`, pdfText(pdf).includes("Amine Mabrouk"));

    /*
     * Headings must survive PDF text extraction *as words*.
     *
     * Chromium emits each glyph of a wide-tracked run as its own positioned text
     * run, and past roughly 0.1em the extractor reads the gaps between letters
     * as word breaks, so the exported text layer spells "E D U C AT I O N".
     * Nothing on screen looks wrong and every visual check passes, but the text
     * layer is what an ATS parser reads, what a search matches, what copy/paste
     * yields and what a screen reader announces — so the PRD's ATS requirement
     * fails while the page still looks perfect. Modern shipped at 0.115em and
     * produced split headings in every export until this check existed.
     *
     * The comparison collapses whitespace in the extracted text and requires the
     * heading to appear verbatim: "E D U C AT I O N" stays unequal to
     * "EDUCATION" after collapsing, so a split fails the check.
     */
    const headings = await page.locator(".resume-document").first().evaluate((doc) =>
      [
        ...doc.querySelectorAll(".resume-masthead h1, .resume-masthead h1 + p, .resume-section h2"),
      ]
        .map((el) => (el.textContent ?? "").trim())
        .filter((text) => text.length > 0),
    );
    /*
     * Both sides are upper-cased: the DOM holds the Markdown's own casing while
     * the PDF holds whatever the template rendered, so Classic's "Summary"
     * arrives as "SUMMARY" and Minimal's arrives as "Summary". Comparing one
     * case against the other reported every sentence-case template as broken.
     */
    const norm = (s) => s.toUpperCase().replace(/\s+/g, " ");
    const extracted = norm(pdfText(pdf));
    const split = headings.filter((heading) => !extracted.includes(norm(heading)));
    check(
      `${template}: every heading survives PDF extraction as one word`,
      split.length === 0,
      split.length === 0 ? `${headings.length} headings` : `split: ${split.join(" | ")}`,
    );

    await page.locator(".preview-stage").screenshot({ path: join(OUT_DIR, `template-${template}.png`) });
  }

  /*
   * Every shipped template must be visually distinct from every other one. A
   * signature collision means the switcher offers two buttons that render the
   * same document.
   */
  const collisions = [];
  for (let i = 0; i < lookSamples.length; i += 1) {
    for (let j = i + 1; j < lookSamples.length; j += 1) {
      if (fingerprint.get(lookSamples[i].template) === fingerprint.get(lookSamples[j].template)) {
        collisions.push(`${lookSamples[i].template}/${lookSamples[j].template}`);
      }
    }
  }
  check(
    "no two templates render an identical look",
    collisions.length === 0,
    collisions.length === 0 ? `${lookSamples.length} distinct signatures` : collisions.join(", "),
  );

  check("no console errors while switching templates", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  check("no page errors while switching templates", pageErrors.length === 0, pageErrors.join(" | "));
  await context.close();
}

async function verifyMultiPage(browser) {
  group("Multi-page resumes in Normal mode (PRD §18, §19, §24)");
  const { context, page } = await openApp(browser, {
    state: { markdown: LONG_MARKDOWN, template: "classic", onePage: false },
  });

  const badge = (await badgeText(page)).trim();
  const predicted = Number(badge.split(" ")[0]);
  check("badge predicts more than one page", predicted > 1, badge);

  const pdf = await pdfOf(page, "multi-page.pdf");
  const info = pdfInfo(pdf);
  check("PDF is A4 portrait", near(info.pageWidthPt, A4.widthMm * 2.8346457, 2) && near(info.pageHeightPt, A4.heightMm * 2.8346457, 2), info.pageSize);
  check("all pages are A4", info.raw.split("\n").filter((l) => l.startsWith("Page") && l.includes("size")).every((l) => l.includes("A4")));
  check("PDF page count matches the badge", info.pages === predicted, `pdf=${info.pages} badge=${predicted}`);

  const text = pdfText(pdf);
  const wanted = fixtureHeadings(LONG_MARKDOWN);
  const lower = text.toLowerCase();
  const lost = wanted.filter((h) => !lower.includes(h.toLowerCase()));
  check("no section is dropped across pages", lost.length === 0, `missing: ${lost.join(", ")}`);
  check("first and last content both survive", text.includes("Jordan Fixture") && text.includes("University of Fixture"));
  check("section headings print in upper case (typographic detail)", text.includes("SECTION 1"));
  check("entries are not split mid-title (break-inside: avoid)", /Role 1 — Company 1\s*\n\s*Jan/.test(text), "job title stays with its meta line");
  check("no full-page raster", pdfPageRaster(pdf) === null, noFullPageRaster(pdf));

  /*
   * The badge models the printer's fragmentation, so the honest test of the
   * model is whether it still agrees when the printer is configured the way a
   * user leaves it. A default Chromium profile prints headers and footers, and
   * `page.pdf()` never does — see `pdfWithHeaders`.
   */
  const withHeaders = pdfInfo(await pdfWithHeaders(page, "multi-page-with-headers.pdf"));
  check(
    "badge still matches the page count with headers and footers on",
    withHeaders.pages === predicted,
    `pdf=${withHeaders.pages} badge=${predicted}`,
  );
  await context.close();
}

async function verifyOnePage(browser) {
  group("One Page mode (PRD §12 – §16, §25)");
  // Slightly longer than one page, so the compaction engine has to work.
  const { context, page } = await openApp(browser, {
    state: { markdown: MEDIUM_MARKDOWN, template: "classic", onePage: true },
  });

  await page.locator("#one-page-toggle").check();
  await settle(page);
  await page.waitForFunction(
    () => document.querySelector(".page-badge")?.textContent?.trim() === "1 page",
    null,
    { timeout: 20_000 },
  );

  const badge = (await badgeText(page)).trim();
  check("badge switches to '1 page'", badge === "1 page", badge);
  const level = Number(await page.locator(".resume-document").first().getAttribute("data-density"));
  check("a compaction level was applied", level > 0, `level ${level}`);

  const box = await docBox(page);
  check(
    "content fits inside the printable height",
    box.scrollHeight <= PRINTABLE_HEIGHT_PX,
    `${fmt(box.scrollHeight)} ≤ ${fmt(PRINTABLE_HEIGHT_PX)}`,
  );
  check(
    "body font stays readable (floor 9.5px)",
    box.fontSize >= MIN_BODY_FONT_PX,
    `${fmt(box.fontSize)}`,
  );
  check("no transform scaling of the document", box.transform === "none", box.transform);
  check("no clipping applied to the document", box.overflow === "visible", box.overflow);
  check(
    "density custom properties applied",
    box.density.section !== "" && box.density.section !== "1" && box.density.font !== "",
    JSON.stringify(box.density),
  );

  const pdf = await pdfOf(page, "one-page.pdf");
  const info = pdfInfo(pdf);
  check("One Page PDF is exactly 1 page", info.pages === 1, `${info.pages} page(s)`);
  check(
    "One Page PDF is A4 portrait",
    near(info.pageWidthPt, A4.widthMm * 2.8346457, 2) && near(info.pageHeightPt, A4.heightMm * 2.8346457, 2),
    info.pageSize,
  );
  const text = pdfText(pdf);
  const wanted = ["Summary", "Experience", "Projects", "Education", "Skills", "Languages", "Volunteering", "Publications"];
  const lost = wanted.filter((word) => !text.toLowerCase().includes(word.toLowerCase()));
  check("One Page PDF keeps every section", lost.length === 0, `missing: ${lost.join(", ")}`);
  check("One Page PDF text is selectable", text.includes("Amine Mabrouk") && text.length > 800, `${text.length} chars`);
  check("One Page PDF is vector text, not a screenshot", pdfPageRaster(pdf) === null, noFullPageRaster(pdf));
  check("overflow warning absent when it fits", (await page.locator(".page-warning").count()) === 0);
  check("hint explains the applied compaction", /One Page mode/i.test(await page.locator(".page-hint").innerText()));

  /*
   * The promise is "one page", and a fresh Chromium profile prints headers and
   * footers unless the user unticks the box. Those go in the page margin, so
   * the promise has to survive them — assert it rather than assume it, since
   * every other PDF in this harness is printed with the headers off.
   */
  const withHeaders = pdfInfo(await pdfWithHeaders(page, "one-page-with-headers.pdf"));
  check(
    "One Page is still 1 page with the browser's default headers and footers on",
    withHeaders.pages === 1,
    `${withHeaders.pages} page(s)`,
  );
  check(
    "headers and footers do not steal content height (still A4)",
    near(withHeaders.pageWidthPt, A4.widthMm * 2.8346457, 2) && near(withHeaders.pageHeightPt, A4.heightMm * 2.8346457, 2),
    withHeaders.pageSize,
  );

  await page.locator(".preview-stage").screenshot({ path: join(OUT_DIR, "one-page.png") });

  // Turning One Page off must restore the untouched layout (PRD §17).
  await page.locator("#one-page-toggle").uncheck();
  await settle(page);
  const restored = await docBox(page);
  const restoredLevel = await page.locator(".resume-document").first().getAttribute("data-density");
  check("switching One Page off restores level 0", restoredLevel === "0", `level ${restoredLevel}`);
  check("switching One Page off restores the full height", restored.scrollHeight > box.scrollHeight, `${box.scrollHeight} → ${restored.scrollHeight}`);
  await context.close();
}

async function verifyOnePageOverflow(browser, template = "classic") {
  group(`One Page overflow warning (PRD §15) — ${template}`);
  const { context, page } = await openApp(browser, {
    state: { markdown: LONG_MARKDOWN, template, onePage: true },
  });

  await page.locator(".page-warning").waitFor({ state: "visible", timeout: 15_000 });
  const warning = await page.locator(".page-warning").innerText();
  check("warning is announced (role=status)", (await page.locator('.page-warning[role="status"]').count()) === 1);
  check("warning explains the situation", /too long for one page/i.test(warning), warning.split("\n")[0]);
  check("badge reads 'Over 1 page'", (await badgeText(page)).trim() === "Over 1 page");
  const box = await docBox(page);
  /*
   * The floor is per template, and it is derived from `--rm-size-body` read off
   * the live document rather than from a table in this file. The ladder's font
   * multiplier comes from the *densest* template, so Minimal is the binding
   * case and stops at 9.5px while Classic stops at 10.45px. Hard-coding those
   * sizes here is exactly how Minimal silently broke the guarantee the first
   * time: the table kept claiming 10px after the stylesheet said 10.5px.
   */
  const baseBody = Number.parseFloat(
    await page
      .locator(".resume-document")
      .first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--rm-size-body")),
  );
  const expectedFloor = baseBody * FONT_FLOOR;
  check(
    `body font stops at the ${template} readability floor`,
    near(box.fontSize, expectedFloor, 0.2),
    `${fmt(box.fontSize)} (base ${baseBody}px × ${FONT_FLOOR} = ${fmt(expectedFloor)})`,
  );
  check(
    "body font never crosses the absolute floor",
    box.fontSize >= MIN_BODY_FONT_PX,
    `${fmt(box.fontSize)} ≥ ${MIN_BODY_FONT_PX}`,
  );
  check("document is not hidden", box.overflow === "visible" && box.transform === "none");

  const pdf = await pdfOf(page, `overflow-${template}.pdf`);
  const info = pdfInfo(pdf);
  check("overflow resume still prints (spills to page 2)", info.pages > 1, `${info.pages} page(s)`);
  const text = pdfText(pdf);
  const wanted = fixtureHeadings(LONG_MARKDOWN);
  const lower = text.toLowerCase();
  const lost = wanted.filter((h) => !lower.includes(h.toLowerCase()));
  check("no content is dropped from the PDF", lost.length === 0, `missing: ${lost.join(", ")}`);
  check("nothing is hidden by the warning", text.includes("Jordan Fixture"));
  await page.locator(".preview-stage").screenshot({ path: join(OUT_DIR, `one-page-overflow-${template}.png`) });
  await context.close();
}

async function verifyPrintIsolation(browser) {
  group("Print stylesheet isolation (PRD §23, §24)");
  const { context, page } = await openApp(browser);
  // A4-sized viewport, so the print layout is measured the way a printer
  // would lay it out rather than stretched across the desktop window.
  await page.setViewportSize({ width: Math.round(A4_WIDTH_PX), height: Math.round(A4_HEIGHT_PX) });
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);

  /*
   * "Hidden" includes "not rendered": the tab bar is only mounted below the tab
   * breakpoint, and the reset dialog only while it is open, so waiting for the
   * element would hang rather than pass.
   */
  const hidden = async (selector) =>
    page.locator(selector).first().evaluate(
      (el) =>
        el === null ||
        (() => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.display === "none" ||
            style.visibility === "hidden" ||
            rect.width === 0 ||
            rect.height === 0
          );
        })(),
      { timeout: 5_000 },
    ).catch(() => true);

  check("header hidden in print", await hidden(".app-header"));
  check("editor pane hidden in print", await hidden(".workspace__pane--editor"));
  check("mobile tab bar hidden in print", await hidden(".workspace__tabs"));
  check("preview chrome (badges/footer) hidden in print", await hidden(".preview-footer"));
  check("pane bar hidden in print", await hidden(".pane-bar"));
  check("skip link hidden in print (fixed elements repeat per page)", await hidden(".skip-link"));
  check("resume document still visible in print", await page.locator(".resume-document").first().isVisible());

  const sheet = await page.locator(".preview-sheet").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      zoom: style.zoom,
      padding: style.paddingTop,
      boxShadow: style.boxShadow,
      backgroundImage: style.backgroundImage,
      width: el.getBoundingClientRect().width,
    };
  });
  check("preview zoom forced to 1 for print", sheet.zoom === "1", `zoom=${sheet.zoom}`);
  check("sheet padding removed (margins come from @page)", Number.parseFloat(sheet.padding) === 0, sheet.padding);
  check("sheet shadow removed", sheet.boxShadow === "none");
  check("page rules gradient removed", sheet.backgroundImage === "none", sheet.backgroundImage);
  check(
    "sheet fills the page in print (width: auto)",
    near(sheet.width, A4_WIDTH_PX, 1.5),
    `${fmt(sheet.width)}`,
  );

  // @page margins can only be verified on the real PDF output.
  await page.emulateMedia({ media: null });
  const pdf = await pdfOf(page, "print-isolation.pdf");
  const geometry = pdfTextGeometry(pdf);
  const MM = 72 / 25.4;
  check("PDF text starts at the left @page margin", near(geometry.left, PAGE_MARGIN_X_MM * MM, 2.5), `${geometry.left.toFixed(1)}pt, want ${(PAGE_MARGIN_X_MM * MM).toFixed(1)}pt`);
  check("PDF text starts at the top @page margin", near(geometry.top, PAGE_MARGIN_Y_MM * MM, 2.5), `${geometry.top.toFixed(1)}pt, want ${(PAGE_MARGIN_Y_MM * MM).toFixed(1)}pt`);
  check(
    "PDF text stays inside the right @page margin",
    geometry.right <= (A4.widthMm - PAGE_MARGIN_X_MM) * MM + 1.5,
    `${geometry.right.toFixed(1)}pt ≤ ${((A4.widthMm - PAGE_MARGIN_X_MM) * MM).toFixed(1)}pt`,
  );
  check(
    "PDF text stays inside the bottom @page margin",
    geometry.bottom <= (A4.heightMm - PAGE_MARGIN_Y_MM) * MM + 2,
    `${geometry.bottom.toFixed(1)}pt ≤ ${((A4.heightMm - PAGE_MARGIN_Y_MM) * MM).toFixed(1)}pt`,
  );
  check("print PDF has no application chrome", !/Export PDF|Autosave|Loading editor/.test(pdfText(pdf)));
  await context.close();
}

async function verifyResponsive(browser) {
  group("Responsive layout (PRD §20, §30)");
  const requested = (process.env.VIEWPORTS ?? "desktop,tablet,mobile").split(",").map((v) => v.trim());
  const wanted = Object.keys(VIEWPORTS).filter((name) => requested.includes(name));

  for (const name of wanted) {
    const { context, page, consoleErrors } = await openApp(browser, { viewport: VIEWPORTS[name] });
    await page.locator(".workspace").screenshot({ path: join(OUT_DIR, `viewport-${name}.png`) });
    await page.screenshot({ path: join(OUT_DIR, `viewport-${name}-full.png`), fullPage: false });

    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }));
    check(`${name} (${VIEWPORTS[name].width}px): no horizontal scrolling`, overflow.doc <= overflow.win + 1, `${overflow.doc} vs ${overflow.win}`);

    // `visibility: hidden` panes keep their layout box, so "is this pane on
    // screen" has to be Playwright's visibility, not just a non-zero rect.
    const [editorVisible, previewVisible, tabs] = await Promise.all([
      page.locator(".workspace__pane--editor").isVisible(),
      page.locator(".workspace__pane--preview").isVisible(),
      page.locator(".workspace__tabs").isVisible(),
    ]);
    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left) };
      };
      return { editor: rect(".workspace__pane--editor"), preview: rect(".workspace__pane--preview") };
    });

    if (VIEWPORTS[name].width >= 1024) {
      check(
        `${name}: two panes side by side`,
        editorVisible && previewVisible && geometry.editor.left < geometry.preview.left,
        `editor @${geometry.editor.left}, preview @${geometry.preview.left}`,
      );
      check(`${name}: tab bar hidden`, !tabs);
    } else if (VIEWPORTS[name].width >= 768) {
      check(
        `${name}: panes stacked`,
        editorVisible && previewVisible && geometry.preview.top > geometry.editor.top,
        `editor @${geometry.editor.top}, preview @${geometry.preview.top}`,
      );
      check(`${name}: tab bar hidden`, !tabs);
    } else {
      check(`${name}: tab bar visible`, tabs);
      const active = (await page.locator('.workspace__tab[aria-selected="true"]').innerText()).trim();
      check(`${name}: one pane visible at a time (${active})`, editorVisible !== previewVisible, `editor=${editorVisible} preview=${previewVisible}`);

      /*
       * The tablist contract, measured: roving `tabindex`, `aria-selected`
       * tracking the visible pane, and arrow keys moving selection. A tablist
       * whose arrows do nothing is worse than no tablist, because the role
       * promises the behaviour.
       */
      const tabState = () =>
        page.evaluate(() => {
          const tabs = [...document.querySelectorAll('[role="tab"]')];
          return {
            count: tabs.length,
            selected: tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"),
            tabindexes: tabs.map((t) => t.getAttribute("tabindex")),
            controls: tabs.map((t) => document.getElementById(t.getAttribute("aria-controls") ?? "")?.id ?? null),
            oriented: tabs[0]?.closest('[role="tablist"]')?.getAttribute("aria-orientation"),
            focused: document.activeElement?.getAttribute("role"),
          };
        });
      const before = await tabState();
      check(
        `${name}: tablist is well formed (roving tabindex, aria-controls resolve)`,
        before.count === 2 &&
          before.tabindexes.filter((t) => t === "0").length === 1 &&
          before.controls.every((id) => typeof id === "string" && id.length > 0),
        `tabindexes ${before.tabindexes.join("/")}, controls ${before.controls.join("/")}`,
      );
      check(
        `${name}: the selected tab is the one that is tabbable`,
        before.tabindexes[before.selected] === "0" && before.tabindexes.filter((t) => t === "0").length === 1,
        `selected index ${before.selected}, tabindexes ${before.tabindexes.join("/")}`,
      );

      await page.locator('[role="tab"][aria-selected="true"]').focus();
      await page.keyboard.press("ArrowRight");
      await settle(page);
      const afterRight = await tabState();
      check(
        `${name}: ArrowRight moves selection to the next tab`,
        afterRight.selected === (before.selected + 1) % 2,
        `${before.selected} → ${afterRight.selected}`,
      );
      check(
        `${name}: ArrowRight also reveals the pane`,
        afterRight.selected === 1
          ? await page.locator(".workspace__pane--preview").isVisible()
          : await page.locator(".workspace__pane--editor").isVisible(),
        `selected tab ${afterRight.selected}`,
      );
      await page.keyboard.press("ArrowLeft");
      await settle(page);
      const afterLeft = await tabState();
      check(
        `${name}: ArrowLeft moves selection back`,
        afterLeft.selected === before.selected,
        `${afterRight.selected} → ${afterLeft.selected}`,
      );
      check(
        `${name}: selection follows keyboard focus (roving tabindex held)`,
        afterLeft.tabindexes.filter((t) => t === "0").length === 1,
        afterLeft.tabindexes.join("/"),
      );
      check(
        `${name}: tablist is horizontal (arrow keys move along the row)`,
        !before.oriented || before.oriented === "horizontal",
        `aria-orientation=${String(before.oriented)}`,
      );

      await page.locator('.workspace__tab', { hasText: "Preview" }).click();
      await settle(page);
      const after = await page.locator('.workspace__pane--preview').isVisible();
      check(`${name}: preview tab reveals the preview`, after);
      await page.screenshot({ path: join(OUT_DIR, `viewport-${name}-preview.png`) });
      /*
       * The sheet either fits, or — below the legibility floor — the stage
       * scrolls it. What must never happen is the old behaviour: an unreadable
       * sheet silently shrunk to fit, with no way to read it.
       */
      const fit = await page.locator(".preview-sheet").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const stage = el.parentElement;
        return {
          width: rect.width,
          viewport: window.innerWidth,
          stageScrolls: stage.scrollWidth > stage.clientWidth,
          zoom: Number(getComputedStyle(el).zoom) || 1,
        };
      });
      check(
        `${name}: A4 sheet fits or the stage scrolls (${fmt(fit.width)})`,
        fit.width <= fit.viewport || fit.stageScrolls,
        `sheet ${fmt(fit.width)} vs ${fit.viewport}px, stage scrolls=${fit.stageScrolls}`,
      );
      check(
        `${name}: preview never scaled below the legibility floor`,
        fit.zoom >= MIN_PREVIEW_ZOOM,
        `zoom ${fit.zoom}`,
      );
      const bodyAt = await page
        .locator(".resume-document p")
        .first()
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
      check(
        `${name}: preview body text stays readable (≥ 7.5px rendered)`,
        bodyAt * fit.zoom >= 7.5,
        `${fmt(bodyAt * fit.zoom)} rendered`,
      );
    }
    check(`${name}: no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
    await context.close();
  }

  /*
   * WCAG 1.4.10 Reflow and 1.4.4 Resize Text, measured rather than asserted in
   * prose.
   *
   * 1.4.10's threshold is 320 CSS px, and 200 % browser zoom is simulated the
   * honest way: half the CSS viewport at 2× device pixel ratio. A
   * `transform: scale()` would be a lie here — the app is full of transforms
   * (the preview zoom) and would behave differently under a real zoom.
   *
   * "No horizontal scrolling" is measured on `documentElement.scrollWidth`, the
   * same property a user would be scrolling. The preview's own stage is allowed
   * to scroll horizontally: an A4 sheet at a legible zoom is wider than 320 px
   * and has to be, so the requirement is about the *page* not scrolling, not
   * about the sheet being squeezed.
   */
  const reflowCases = [
    { label: `reflow at ${REFLOW_WIDTH_PX}px (WCAG 1.4.10)`, width: REFLOW_WIDTH_PX, height: 720, deviceScaleFactor: 1 },
    ...ZOOM_CASES,
  ];
  for (const { label, width, height, deviceScaleFactor } of reflowCases) {
    const { context, page, consoleErrors } = await openApp(browser, {
      viewport: { width, height },
      deviceScaleFactor,
    });
    await waitForEditor(page);
    await settle(page);

    const state = await page.evaluate(() => {
      /*
       * `offsetParent !== null` is not "on screen". An inactive mobile pane is
       * `visibility: hidden`, which keeps its layout box and therefore its
       * offset parent — so that test reports two visible panes on a phone and
       * fails for a layout that is actually correct. This is the same trap the
       * viewport loop documents for Playwright's `isVisible()`.
       *
       * The honest test is the one a user perceives: the element paints nothing.
       */
      const isPainted = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const stage = document.querySelector(".preview-stage");
      const controls = [...document.querySelectorAll(".app-header button, .app-header select, .app-header input")]
        .filter((el) => isPainted(el))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            label: el.id || el.className.toString().split(" ")[0],
            left: Math.round(r.left),
            right: Math.round(r.right),
          };
        });
      return {
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
        clipped: controls.filter((c) => c.left < -1 || c.right > window.innerWidth + 1),
        controls: controls.length,
        stageScrolls: stage ? stage.scrollWidth > stage.clientWidth : false,
        tabsMounted: Boolean(document.querySelector(".workspace__tabs")),
        panesPainted: [...document.querySelectorAll(".workspace__pane")].filter(isPainted).length,
        panes: [...document.querySelectorAll(".workspace__pane")].map((p) => {
          /*
           * `className.split(" ").pop()` reads "no-print" for the editor pane,
           * because that is the last class in its list. Name the pane by the
           * modifier it carries, which is the part a human recognises.
           */
          const modifier = [...p.classList].find((c) => c.startsWith("workspace__pane--"));
          return `${modifier?.replace("workspace__pane--", "") ?? "?"}:${isPainted(p) ? "painted" : "hidden"}`;
        }),
      };
    });
    check(`${label}: page does not scroll horizontally`, state.doc <= state.win + 1, `${state.doc} vs ${state.win}px`);
    check(
      `${label}: no header control is clipped out of view`,
      state.clipped.length === 0,
      state.clipped.length === 0 ? `${state.controls} controls` : state.clipped.map((c) => c.label).join(", "),
    );
    check(
      `${label}: the two panes become one, and the tab bar picks which`,
      state.panesPainted === 1,
      `${state.panes.join(", ")}; tabs ${state.tabsMounted ? "mounted" : "absent"}`,
    );
    check(`${label}: no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
    await page.screenshot({ path: join(OUT_DIR, `reflow-${width}x${deviceScaleFactor}.png`) });
    await context.close();
  }
}

async function verifyInteractions(browser) {
  group("Editing, persistence, reset, a11y (PRD §27 – §29, §35)");
  const { context, page } = await openApp(browser);
  await waitForEditor(page);

  // --- typing propagates to the preview, at a usable rate ------------------
  // The tokens are pasted one by one, so a dropped character anywhere in the
  // source (the controlled-input clobber this guards against) shows up as a
  // missing token rather than as a silently corrupted document.
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press("Control+End");
  const latencies = [];
  const dropped = [];
  for (let i = 0; i < 10; i += 1) {
    const token = `latency${i}`;
    const started = Date.now();
    await page.keyboard.type(` ${token}`);
    const arrived = await page
      .waitForFunction(
        (t) => document.querySelector(".resume-document")?.textContent?.includes(t),
        token,
        { timeout: 10_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (arrived) latencies.push(Date.now() - started);
    else dropped.push(token);
  }
  const source = await page.evaluate(() =>
    // A long logical line is split across several wrapped `.view-line`
    // elements, so they have to be concatenated *without* a separator to
    // rebuild the buffer the user actually typed.
    [...document.querySelectorAll(".view-line")].map((line) => line.textContent).join(""),
  );
  const tokens = Array.from({ length: 10 }, (_, i) => `latency${i}`);
  check(
    "typing in the editor updates the preview live",
    latencies.length === tokens.length,
    dropped.join(", "),
  );
  check(
    "no character is dropped while typing fast (editor is not a controlled input)",
    tokens.every((t) => source.includes(t)),
    JSON.stringify(source.slice(-90)),
  );
  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)];
  check(
    "keystroke → preview stays under 500ms (median)",
    latencies.length > 0 && median < 500,
    `median ${median}ms, worst ${latencies.at(-1)}ms`,
  );

  // --- localStorage persistence ------------------------------------------
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n## Persistence Probe\n\nLive preview marker 4711.\n");
  await page.waitForFunction(
    () => document.querySelector(".resume-document")?.textContent?.includes("Live preview marker 4711"),
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => window.localStorage.getItem("resumark:resume:v1"));
  check("markdown persisted to localStorage", Boolean(stored?.includes("Persistence Probe")));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".resume-document").first().waitFor({ timeout: 30_000 });
  await settle(page);
  const restored = await page.locator(".resume-document").textContent();
  check("resume restored after a reload (PRD §27)", restored.includes("Live preview marker 4711"));

  /*
   * Monaco's accessible name, read off the element that is actually exposed.
   *
   * With `accessibilitySupport: "on"` (see `MarkdownEditor`), the editor has two
   * text areas: the IME proxy, which is correctly `aria-hidden="true"`, and the
   * real control — `div.native-edit-context[role="textbox"]`, focusable and
   * labelled. Querying `.monaco-editor textarea` therefore finds the *wrong*
   * element and reports a missing name on a perfectly named editor, which is how
   * the original version of this check "failed" for no reason.
   *
   * `ariaLabel` on its own is not enough, and this is why: without
   * `accessibilitySupport`, the label lands on that wrapper with **no role and
   * no tabindex**, while the focusable IME proxy carries nothing at all. The
   * control a screen reader lands on was unnamed.
   *
   * Monaco is loaded lazily, so this has to wait for the editor: immediately
   * after the reload above, `.monaco-editor` is not there yet and the check
   * would measure an empty subtree.
   */
  await waitForEditor(page);
  const editorName = await page.evaluate(() => {
    const exposed = [...document.querySelectorAll(".monaco-editor [role][aria-label]")].filter(
      (el) => el.getAttribute("role") === "textbox",
    );
    const imeProxy = document.querySelector(".monaco-editor textarea");
    return {
      label: exposed[0]?.getAttribute("aria-label") ?? null,
      role: exposed[0]?.getAttribute("role") ?? null,
      tabindex: exposed[0]?.getAttribute("tabindex") ?? null,
      count: exposed.length,
      imeHidden: imeProxy?.getAttribute("aria-hidden") === "true",
    };
  });
  check(
    "the editor exposes a named, focusable textbox",
    editorName.role === "textbox" &&
      typeof editorName.label === "string" &&
      editorName.label.length > 0 &&
      editorName.tabindex !== null,
    JSON.stringify(editorName),
  );
  check(
    "Monaco's IME proxy is hidden from assistive technology",
    editorName.imeHidden === true,
    editorName.imeHidden ? "aria-hidden=true" : "the IME proxy is exposed",
  );

  /*
   * The tab order, walked by pressing Tab from a cold load.
   *
   * `blur()` is not a way to rewind the tab sequence: Chromium keeps its
   * sequential focus navigation starting point where the last focused element
   * was, so the next Tab resumes from there rather than from the top of the
   * page. Every walk here therefore starts from a fresh `reload`, which is also
   * the state a user is actually in when they first press Tab.
   */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".resume-document").first().waitFor({ timeout: 30_000 });
  await settle(page);
  const order = [];
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return { label: "(body)", inEditor: false, inHeader: false };
        return {
          label: active.id || active.className?.toString().split(" ")[0] || active.tagName.toLowerCase(),
          inEditor: Boolean(active.closest(".workspace__pane--editor")),
          inHeader: Boolean(active.closest(".app-header")),
        };
      }),
    );
  }
  check(
    "the skip link is the first tab stop",
    order[0]?.label.includes("skip-link"),
    order.map((stop) => stop.label).join(" → "),
  );
  check(
    "the header's controls come after it, so the link has something to bypass",
    order[1]?.inHeader === true && order.filter((stop) => stop.inHeader).length >= 4,
    order.filter((stop) => stop.inHeader).map((stop) => stop.label).join(", "),
  );
  check(
    "no tab stop falls through to the page background",
    order.every((stop) => stop.label !== "(body)"),
    order.map((stop) => stop.label).join(" → "),
  );
  check(
    "tabbing alone does not reach the editor within six presses (there is something to skip)",
    !order.some((stop) => stop.inEditor),
    order.map((stop) => stop.label).join(" → "),
  );

  /* Follow the skip link for real, from a cold load: one Tab, then Enter. */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".resume-document").first().waitFor({ timeout: 30_000 });
  await settle(page);
  await page.keyboard.press("Tab");
  const skipFocused = await page.evaluate(
    () => document.activeElement?.classList.contains("skip-link") === true,
  );
  await page.keyboard.press("Enter");
  await settle(page);
  const landed = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      id: active?.id ?? null,
      host: active?.id === "markdown-source",
      hash: location.hash,
    };
  });
  check(
    "one Tab + Enter moves focus into the editor (WCAG 2.4.1 bypass)",
    skipFocused && landed.host && landed.hash === "#markdown-source",
    `skip link focused=${skipFocused}, focus → #${landed.id ?? "?"}`,
  );
  check(
    "the editor host is the skip link's target and is programmatically focusable",
    await page.evaluate(() => {
      const host = document.querySelector("#markdown-source");
      if (!host) return false;
      return (
        host.getAttribute("tabindex") === "-1" &&
        document.querySelector(".skip-link")?.getAttribute("href") === "#markdown-source"
      );
    }),
    "href=#markdown-source, tabindex=-1",
  );

  // --- reset confirmation -------------------------------------------------
  await page.locator(".header-button--ghost", { hasText: "Reset" }).click();
  const dialog = page.locator('[role="alertdialog"]');
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  check("reset asks for confirmation", await dialog.isVisible());
  check("dialog is modal + labelled", (await dialog.getAttribute("aria-modal")) === "true" && Boolean(await dialog.getAttribute("aria-labelledby")));
  check(
    "focus moved into the dialog",
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  );
  /*
   * A destructive confirmation must not open with the destructive action under
   * the user's finger, and the rest of the app must actually be unreachable —
   * `aria-modal` is an instruction to assistive technology, `inert` is what
   * takes the background out of the tab order and the click target.
   */
  check(
    "focus does NOT start on the destructive action",
    (await page.evaluate(() => document.activeElement?.className ?? "")) !== "button button--danger",
    await page.evaluate(() => document.activeElement?.className ?? "none"),
  );
  check(
    "background is inert while the dialog is open",
    await page.evaluate(() => document.querySelector(".app-shell")?.hasAttribute("inert") === true),
  );
  check(
    "background controls are not focusable while the dialog is open",
    await page.evaluate(() => {
      const reset = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reset");
      reset?.focus();
      return !document.querySelector(".app-shell")?.contains(document.activeElement);
    }),
  );
  check("dialog is portalled outside the inert shell", await dialog.evaluate((el) => !el.closest(".app-shell")));

  /*
   * The focus trap, exercised by actually pressing Tab. `inert` on the shell
   * already takes the background out of the order; what this adds is proof that
   * the dialog itself does not leak focus either, and that the cycle is between
   * the two buttons rather than somewhere out of reach.
   */
  const cycled = [];
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    cycled.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        const inside = Boolean(active && document.querySelector('[role="alertdialog"]')?.contains(active));
        return { inside, label: (active?.textContent ?? active?.tagName ?? "?").trim().slice(0, 24) };
      }),
    );
  }
  check(
    "focus stays inside the dialog for six Tab presses (focus trap)",
    cycled.every((stop) => stop.inside),
    cycled.map((stop) => stop.label).join(" → "),
  );
  check(
    "the trap cycles only the dialog's two buttons",
    new Set(cycled.map((stop) => stop.label)).size === 2,
    [...new Set(cycled.map((stop) => stop.label))].join(", "),
  );
  check(
    "both dialog buttons are reachable by keyboard",
    ["Cancel", "Delete and reset"].every((label) =>
      cycled.some((stop) => stop.label.startsWith(label.split(" ")[0])),
    ),
    [...new Set(cycled.map((stop) => stop.label))].join(", "),
  );

  await page.keyboard.press("Escape");
  await settle(page);
  check("Escape cancels the reset", (await page.locator('[role="alertdialog"]').count()) === 0);
  check(
    "focus returns to the control that opened the dialog",
    await page.evaluate(() => (document.activeElement?.textContent ?? "").trim().startsWith("Reset")),
    await page.evaluate(() => (document.activeElement?.textContent ?? document.activeElement?.tagName ?? "?").trim().slice(0, 30)),
  );
  check(
    "background is interactive again after the dialog closes",
    await page.evaluate(() => !document.querySelector(".app-shell")?.hasAttribute("inert")),
  );
  check(
    "cancel keeps the resume",
    (await page.locator(".resume-document").textContent()).includes("Persistence Probe"),
  );

  await page.locator(".header-button--ghost", { hasText: "Reset" }).click();
  await page.locator(".button--danger").click();
  await settle(page);
  const afterReset = await page.locator(".resume-document").textContent();
  check("reset removes user content", !afterReset.includes("Persistence Probe"));
  const stillMissing = DEFAULT_HEADINGS.filter((heading) => !afterReset.includes(heading));
  check(
    "reset restores the complete example resume",
    afterReset.includes("Amine Mabrouk") && stillMissing.length === 0,
    `missing: ${stillMissing.join(", ")}`,
  );
  check(
    "reset storage cleared",
    (await page.evaluate(() => window.localStorage.getItem("resumark:resume:v1"))) === null,
  );

  // --- page-mode persistence ---------------------------------------------
  await page.selectOption("#template-select", "modern");
  await page.locator("#one-page-toggle").check();
  await settle(page);
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".resume-document").first().waitFor({ timeout: 30_000 });
  await settle(page);
  check("page mode + template persisted (PRD §28)", await page.locator("#one-page-toggle").isChecked());
  check("template persisted", (await page.locator("#template-select").inputValue()) === "modern");

  /*
   * --- autosave switch (PRD §27a) -----------------------------------------
   * The contract is destructive by choice: with autosave off nothing is
   * written, so a reload discards the session. These checks pin all three
   * halves of that — the saved snapshot survives, new edits are not written,
   * and the switch itself is sticky — because a half-implemented version of
   * this is worse than either extreme.
   */
  const autosaveToggle = page.locator("#autosave-toggle");
  check(
    "autosave switch is a real checkbox (PRD §27a)",
    (await autosaveToggle.count()) === 1 && (await autosaveToggle.getAttribute("type")) === "checkbox",
  );
  check("autosave is on by default", await autosaveToggle.isChecked());

  const storedBefore = await page.evaluate(() => window.localStorage.getItem("resumark:resume:v1"));
  check("a resume snapshot exists before autosave is turned off", storedBefore !== null);

  await autosaveToggle.uncheck();
  await settle(page);
  check(
    "turning autosave off does not destroy the saved resume",
    (await page.evaluate(() => window.localStorage.getItem("resumark:resume:v1"))) === storedBefore,
  );
  check(
    "status line reports autosave off",
    (await page.locator(".save-status").innerText()).includes("Autosave off"),
  );
  /*
   * The consequence has to be stated in the page, not in a `title`: a tooltip is
   * invisible to keyboard and touch users and to anyone who looks away, and this
   * is the warning that stands between a user and losing their work.
   */
  const warnText = (await page.locator(".header-alert--warn").count())
    ? await page.locator(".header-alert--warn").innerText()
    : "";
  check(
    "a visible warning states that changes will be discarded",
    warnText.includes("discard") && warnText.length > 40,
    warnText.replace(/\s+/g, " ").slice(0, 80),
  );
  check(
    "the warning names the action that loses the work",
    /reload|closing the tab/i.test(warnText),
    warnText.replace(/\s+/g, " ").slice(0, 80),
  );

  // An edit made with autosave off must not reach storage.
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n## Unsaved Probe\n\nThis must not be persisted 9911.\n");
  await page.waitForFunction(
    () => document.querySelector(".resume-document")?.textContent?.includes("must not be persisted"),
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(700);
  check(
    "edits are not written to localStorage while autosave is off",
    (await page.evaluate(() => window.localStorage.getItem("resumark:resume:v1"))) === storedBefore,
  );
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(500);
  check(
    "Ctrl/Cmd + S is a no-op while autosave is off",
    (await page.evaluate(() => window.localStorage.getItem("resumark:resume:v1"))) === storedBefore,
  );

  // The switch must survive a reload, or the user silently gets saving back.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".resume-document").first().waitFor({ timeout: 30_000 });
  await settle(page);
  check("autosave is still off after a reload", !(await autosaveToggle.isChecked()));
  check(
    "the unsaved edit is gone after a reload (the documented consequence)",
    !(await page.locator(".resume-document").textContent()).includes("must not be persisted"),
  );
  check(
    "the saved snapshot survived the round trip",
    (await page.locator(".resume-document").textContent()).includes("Amine Mabrouk"),
  );
  check(
    "the preference is stored under its own key, not the resume key",
    (await page.evaluate(() => window.localStorage.getItem("resumark:prefs:v1"))) ===
      JSON.stringify({ autosave: false }),
  );

  // The "not saved" state must survive the narrow-viewport rule that hides the
  // status line; a warning the user cannot see is not a warning.
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  check(
    "the autosave warning is still visible at 390px",
    await page.locator(".save-status").evaluate((el) => getComputedStyle(el).display !== "none"),
  );
  check(
    "the autosave warning keeps its warn colour at 390px",
    await page.locator(".save-status").evaluate((el) => getComputedStyle(el).color === "rgb(253, 230, 138)"),
    await page.locator(".save-status").evaluate((el) => getComputedStyle(el).color),
  );
  await page.setViewportSize(VIEWPORTS.desktop);
  await settle(page);

  // Re-enabling must resume persistence, otherwise the switch is a one-way door.
  // The probe has to be a *new* edit: at this point the in-memory resume is the
  // snapshot that is already stored, so the resumed write is byte-identical and
  // a "did localStorage change" assertion would pass for the wrong reason (or
  // fail, as it did, for the right one).
  await autosaveToggle.check();
  await settle(page);
  check("the warning clears once autosave is back on", (await page.locator(".header-alert--warn").count()) === 0);

  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n## Resumed Probe\n\nPersistence is working again 6612.\n");
  await page.waitForFunction(
    () => document.querySelector(".resume-document")?.textContent?.includes("working again"),
    null,
    { timeout: 10_000 },
  );
  const resumed = await page
    .waitForFunction(
      () => window.localStorage.getItem("resumark:resume:v1")?.includes("working again") ?? false,
      null,
      { timeout: 10_000 },
    )
    .then(() => true, () => false);
  check("re-enabling autosave resumes writing to localStorage", resumed);
  check(
    "the status line reports a fresh save",
    (await page.locator(".save-status").innerText()).match(/Saved\s+\d/) !== null,
    (await page.locator(".save-status").innerText()).trim(),
  );

  // --- keyboard / a11y ----------------------------------------------------
  const landmarks = await page.evaluate(() => ({
    // A `header` inside an <article> is a scoped header, not a banner landmark.
    banner: document.querySelectorAll(".app-shell > header").length,
    // The resume's own masthead header must stay scoped to the article.
    scoped: document.querySelectorAll("article .resume-document > header, .resume-masthead").length,
    main: document.querySelectorAll("main").length,
    h1: document.querySelectorAll(".resume-document h1").length,
  }));
  check("exactly one banner landmark", landmarks.banner === 1, `${landmarks.banner}`);
  check("workspace is a main landmark", landmarks.main === 1, `${landmarks.main}`);
  check("resume masthead is scoped to the article", landmarks.scoped === 1, `${landmarks.scoped}`);
  check("preview keeps a single h1 for the name", landmarks.h1 === 1);

  /*
   * The app claims to suppress Ctrl/Cmd+S. Whether the *browser* then shows its
   * save dialog is not observable from a page, but the thing that decides it is:
   * a `keydown` listener that calls `preventDefault()`.
   *
   * The probe has to be on `window`, in the bubble phase, registered *after* the
   * app's own listener — `window` is the last target in the bubble path, so a
   * listener on `document` (as this originally was) runs *before* the app's
   * handler and reads `defaultPrevented` as `false` no matter what the app does.
   * On the same target and phase, listeners fire in registration order, so this
   * one is guaranteed to observe the app's `preventDefault()`.
   *
   * An earlier version of this check passed a literal `true`, which is the worst
   * kind of test: green forever, and green whether the feature works or not.
   */
  await page.evaluate(() => {
    window.__rmKeyEvents = [];
    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() !== "s") return;
      window.__rmKeyEvents.push({
        key: event.key,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
      });
    });
  });
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(250);
  const saveKeys = await page.evaluate(() => window.__rmKeyEvents);
  const suppressed = saveKeys.filter((k) => k.ctrl || k.meta);
  check(
    "Ctrl/Cmd+S is intercepted with preventDefault (no save dialog)",
    suppressed.length > 0 && suppressed.every((k) => k.defaultPrevented),
    `${suppressed.length} intercepted, ${suppressed.filter((k) => k.defaultPrevented).length} prevented`,
  );
  await page.evaluate(() => {
    window.__rmKeyEvents.length = 0;
  });
  await page.keyboard.press("Meta+s");
  await page.waitForTimeout(200);
  const metaKeys = await page.evaluate(() => window.__rmKeyEvents);
  check(
    "Cmd+S is intercepted too (same handler, not just Control)",
    metaKeys.some((k) => k.meta) && metaKeys.filter((k) => k.meta).every((k) => k.defaultPrevented),
    `${metaKeys.length} event(s), ${metaKeys.filter((k) => k.defaultPrevented).length} prevented`,
  );

  const labelled = await page.evaluate(() =>
    [...document.querySelectorAll("input, select, button")]
      .filter((el) => !el.classList.contains("no-print"))
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        text: (el.textContent ?? "").trim(),
        aria: el.getAttribute("aria-label") ?? el.getAttribute("aria-labelledby") ?? null,
        // A control whose *only* "name" is an `id` has none at all: the id is
        // for `<label for>`, and an unlabelled input still has no accessible
        // name. Holding it to the same bar as the others would have caught that.
        namedByLabel: Boolean(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)),
        wrappedInLabel: Boolean(el.closest("label")),
        ariaName: el.getAttribute("aria-label"),
      })),
  );
  const unnamed = labelled.filter(
    (c) => !c.ariaName && !(c.namedByLabel || c.wrappedInLabel) && c.text.length === 0,
  );
  check(
    "every form control has an accessible name",
    unnamed.length === 0,
    unnamed.length === 0 ? `${labelled.length} controls` : `unnamed: ${unnamed.map((c) => c.tag).join(", ")}`,
  );
  await context.close();
}

/**
 * WCAG relative-luminance contrast ratio between two CSS colours.
 *
 * Accepts `#rrggbb` and `rgb()` / `rgba()` / `rgb(… / …)` — the three shapes
 * that actually turn up here: a hex custom property read off `--focus-ring`, and
 * computed `background-color` / `outline-color` values. An unrecognised colour
 * resolves to transparent black, which is deliberately the *worst* case for a
 * light ring: it makes a broken surface lookup fail the check rather than pass
 * it. That mistake is not hypothetical — the header is a gradient, and an
 * earlier version of this function measured the ring against its transparent
 * `background-color` and reported 20:1 for a ring nobody can see.
 */
function contrast(a, b) {
  const channels = (value) => {
    const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
    if (hex) {
      const n = Number.parseInt(hex[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const parts = value.match(/[\d.]+/g);
    if (!parts) return [0, 0, 0];
    return parts.slice(0, 3).map(Number);
  };
  const lum = (value) => {
    const [r, g, bl] = channels(value);
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function verifyAccessibilityFixes(browser) {
  group("Focus visibility, contrast and link cues (WCAG 1.4.1 / 1.4.11)");
  const { context, page } = await openApp(browser);
  await waitForEditor(page);

  /*
   * Regression guard for a real bug: the focus ring was `#0f172a` everywhere,
   * which is 1.00–1.17:1 against the dark header and the dark editor pane — the
   * ring was painted, and invisible, on every keyboard-reachable control in the
   * app except the two tabs.
   *
   * Each sample names the surface explicitly rather than relying on whatever
   * the control itself paints: `.app-header` fills with a `linear-gradient` and
   * `.header-select` layers a chevron gradient on top, so a generic "first
   * colour I can find" search picks up the wrong stop — or, as it turned out, no
   * stop at all. Each control must also be genuinely focusable:
   * `outline-color` on an unfocusable element is just `currentColor`, which
   * would make the check pass vacuously.
   */
  const RING_SURFACES = [
    ["template select", "#template-select", ".app-header"],
    ["one page toggle", "#one-page-toggle", ".app-header"],
    ["autosave toggle", "#autosave-toggle", ".app-header"],
    ["reset button", ".header-button--ghost", ".app-header"],
    ["export button", ".header-button--primary", ".app-header"],
    ["preview stage", ".preview-stage", ".preview-stage"],
  ];
  const ring = await page.evaluate((rows) => {
    /*
     * Every colour the ring could land on, not just the first one.
     *
     * `.app-header` is a `linear-gradient(rgb(22,32,58), rgb(15,23,42))` over a
     * transparent `background-color`, so both halves of the old approach were
     * wrong: a regex written for `[^,]+` cannot match an `rgb()` stop, because
     * the stop itself contains commas — so it fell through to the transparent
     * background colour and every header control "passed" at 20:1 against
     * nothing at all. A ring that is invisible on all three real surfaces and
     * perfectly visible on a transparent one is exactly the failure this check
     * exists to catch.
     *
     * So: take every stop of a gradient, and if the element paints no
     * background of its own, walk up until something does.
     */
    const surfacesUnder = (selector) => {
      let el = document.querySelector(selector);
      while (el) {
        const cs = getComputedStyle(el);
        const stops = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => m[0]);
        if (stops.length > 0) return stops;
        if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") return [cs.backgroundColor];
        el = el.parentElement;
      }
      return ["rgb(255, 255, 255)"];
    };
    return rows.map(([name, control, surface]) => {
      const el = document.querySelector(control);
      if (!el) return { name, missing: true };
      el.focus();
      const cs = getComputedStyle(el);
      return {
        name,
        focused: el.matches(":focus-visible"),
        outline: cs.outlineColor,
        width: cs.outlineWidth,
        style: cs.outlineStyle,
        offset: cs.outlineOffset,
        surfaces: surfacesUnder(surface),
      };
    });
  }, RING_SURFACES);
  for (const data of ring) {
    if (data.missing) {
      check(`${data.name}: focusable control found`, false, "not found");
      continue;
    }
    // A ring has to clear 3:1 against the *worst* colour it can touch, so a
    // gradient surface is held to its least favourable stop.
    const ratios = data.surfaces.map((surface) => contrast(data.outline, surface));
    const worst = Math.min(...ratios);
    check(
      `${data.name}: focus ring clears 3:1 (${worst.toFixed(2)}:1)`,
      data.focused &&
        worst >= 3 &&
        Number.parseFloat(data.width) >= 2 &&
        data.style !== "none" &&
        Number.parseFloat(data.offset) >= 1,
      `${data.outline} on ${data.surfaces.join(" / ")}${data.focused ? "" : " (not focus-visible)"}`,
    );
  }

  /*
   * The editor is the odd one out, and deliberately so. Monaco owns its own
   * stylesheet and sets `outline: none` on the hidden textarea it uses as a
   * focus proxy — the blinking text cursor *is* the focus indicator inside a
   * code editor, exactly as it is in every other one. Demanding an outline here
   * would be asserting a ring the product deliberately does not paint.
   *
   * What is still worth guarding is that the editor is keyboard reachable, that
   * it matches `:focus-visible` when focused, and that the ring token on its
   * surface is the light one — that token flip is the original bug.
   */
  const editor = await page.evaluate(() => {
    const textarea = document.querySelector(".monaco-editor textarea");
    const pane = document.querySelector(".workspace__pane--editor");
    if (!textarea || !pane) return { missing: true };
    textarea.focus();
    return {
      reachable: document.activeElement === textarea,
      focusVisible: textarea.matches(":focus-visible"),
      ring: getComputedStyle(pane).getPropertyValue("--focus-ring").trim(),
      surface: getComputedStyle(pane).backgroundColor,
    };
  });
  check(
    "editor is keyboard reachable",
    editor.reachable === true && editor.focusVisible === true,
    `active=${editor.reachable} focus-visible=${editor.focusVisible}`,
  );
  const editorRatio = contrast(editor.ring, editor.surface);
  check(
    `editor surface uses the light focus token (${editorRatio.toFixed(2)}:1)`,
    editorRatio >= 3,
    `token ${editor.ring} on ${editor.surface}`,
  );

  /* The pane-bar hints sit on opposite surfaces; one colour cannot serve both. */
  const hints = await page.evaluate(() =>
    [...document.querySelectorAll(".pane-bar__hint")].map((el) => {
      const fg = getComputedStyle(el).color;
      let bg = "rgb(0, 0, 0)";
      for (let node = el; node; node = node.parentElement) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
          bg = c;
          break;
        }
      }
      return { text: el.textContent.trim(), fg, bg };
    }),
  );
  check("both pane bars carry a hint", hints.length === 2, `${hints.length}`);
  for (const hint of hints) {
    const ratio = contrast(hint.fg, hint.bg);
    check(`hint "${hint.text}" clears 4.5:1 (${ratio.toFixed(2)}:1)`, ratio >= 4.5, `${hint.fg} on ${hint.bg}`);
  }

  /*
   * Links may not be identified by colour alone (1.4.1), and the cue has to
   * survive the preview's `zoom` — a sub-pixel `border-bottom` does not, which
   * is why this asserts a real `text-decoration`.
   */
  for (const template of await templateIds(page)) {
    await page.selectOption("#template-select", template);
    await settle(page);
    const link = await page.locator(".resume-document a").first().evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        line: style.textDecorationLine,
        thickness: style.textDecorationThickness,
        color: style.textDecorationColor,
        text: style.color,
      };
    });
    check(
      `${template}: links are underlined, not colour-only`,
      link.line.includes("underline"),
      `${link.line} / ${link.thickness}`,
    );
  }

  /*
   * A Markdown table wider than the 180mm column used to overflow the sheet and
   * Chromium clips to the page box, so right-hand cells were silently lost from
   * the PDF. The table must be contained and the cells must wrap.
   */
  await page.selectOption("#template-select", "classic");
  await settle(page);
  const table = await page.evaluate(() => {
    const wrap = document.querySelector(".resume-document .rm-table-wrap");
    if (!wrap) return null;
    const doc = document.querySelector(".resume-document");
    return {
      wrapWidth: wrap.getBoundingClientRect().width,
      docWidth: doc.getBoundingClientRect().width,
      layout: getComputedStyle(wrap.querySelector("table")).tableLayout,
      wrapOverflows: wrap.getBoundingClientRect().width > doc.getBoundingClientRect().width + 1,
    };
  });
  check("table wrapper exists and is contained", table && !table.wrapOverflows, JSON.stringify(table));
  check("table cannot exceed the column (table-layout: fixed)", table?.layout === "fixed", table?.layout);

  await context.close();
}

async function verifyPrintBehaviour(browser) {
  group("window.print() export (PRD §22, AC-08)");
  const { context, page } = await openApp(browser);
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => {
      window.__printed += 1;
    };
  });
  await page.locator(".header-button--primary", { hasText: "Export PDF" }).click();
  const calls = await page.evaluate(() => window.__printed);
  check("Export PDF calls window.print()", calls === 1, `${calls} call(s)`);
  check(
    "document title carries the candidate name for the suggested file name",
    /Amine Mabrouk/.test(await page.title()),
    await page.title(),
  );
  await page.evaluate(() => {
    window.print = () => {};
  });

  // The real thing: Chromium's own PDF writer, i.e. the user's "Save as PDF".
  const pdf = await pdfOf(page, "export-default.pdf");
  const info = pdfInfo(pdf);
  const text = pdfText(pdf);
  check("exported PDF is A4", near(info.pageWidthPt, A4.widthMm * 2.8346457, 2) && near(info.pageHeightPt, A4.heightMm * 2.8346457, 2), info.pageSize);
  check("exported PDF has real text", text.includes("Amine Mabrouk") && text.includes("Full Stack Developer"));
  check("exported PDF is vector text, not a screenshot", pdfPageRaster(pdf) === null, noFullPageRaster(pdf));
  const uris = pdfUris(pdf);
  check("exported PDF has clickable links", uris.length >= 3, `${uris.length}: ${uris.join(", ")}`);
  /*
   * Anything that is not resume content. "Skip to" earned its place here: a
   * `position: fixed` skip link is off-screen, not hidden, and Chromium repeats
   * fixed elements at the foot of *every* page of the PDF.
   */
  const chrome = ["Export PDF", "Autosave", "Ctrl/Cmd", "Loading editor", "A4 · 210", "Skip to"];
  const leaked = chrome.filter((word) => text.includes(word));
  check("no application chrome in the exported PDF", leaked.length === 0, leaked.join(", "));
  await context.close();

  /*
   * A link written without a protocol, which is how people actually write
   * links. `react-markdown` passes the value through untouched, so
   * `href="jane.dev"` reaches the DOM as a *relative* URL, the browser resolves
   * it against whatever origin the app is served from, and the PDF's link
   * annotation points at `https://deployment-host/jane.dev` — a page that does
   * not exist. `MarkdownRenderer`'s `urlTransform` prefixes `https://` first, so
   * the annotation has to come out as the author's own host.
   *
   * The example resume cannot prove this: its hrefs are already explicit, so the
   * transform is never exercised. It needs a fixture with a bare host.
   */
  const bareHost = await openApp(browser, {
    state: {
      markdown: [
        "# Jane Fixture",
        "",
        "Portfolio Engineer",
        "",
        "[jane.dev](jane.dev) · [notes.example.org](notes.example.org) · [a@b.test](mailto:a@b.test)",
        "",
        "## Experience",
        "",
        "### Engineer — Somewhere",
        "",
        "Jan 2024 — Present · Remote",
        "",
        "- Shipped a thing that mattered.",
        "",
      ].join("\n"),
      template: "classic",
      onePage: false,
    },
  });
  const barePdf = await pdfOf(bareHost.page, "export-bare-host.pdf");
  const bareUris = pdfUris(barePdf);
  check(
    "a schemeless link gets an https:// annotation, not the deployment origin",
    bareUris.includes("https://jane.dev/") && !bareUris.some((uri) => uri.includes("127.0.0.1") || uri.includes("localhost")),
    bareUris.join(", "),
  );
  check(
    "schemeless rewriting leaves mailto: alone",
    bareUris.includes("mailto:a@b.test"),
    bareUris.join(", "),
  );
  check(
    "multi-label hosts are rewritten too",
    bareUris.includes("https://notes.example.org/"),
    bareUris.join(", "),
  );
  check("the bare-host fixture still prints on one A4 page", pdfInfo(barePdf).pages === 1, pdfInfo(barePdf).pageSize);
  await bareHost.context.close();
}

async function renderPdfToPng(pdfPath, prefix, dpi = 110) {
  if (!has("pdftoppm")) return [];
  const target = join(OUT_DIR, prefix);
  run("pdftoppm", ["-r", String(dpi), "-png", pdfPath, target]);
  return readdirSync(OUT_DIR).filter((file) => file.startsWith(prefix) && file.endsWith(".png")).sort();
}

/* -------------------------------------------------------------------------- */
/* Runner                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = await import("playwright-core");
  const executablePath = findChromium();
  console.log(LOGO("Resumark verification"));
  console.log(DIM(`  app:  ${BASE_URL}`));
  console.log(DIM(`  out:  ${OUT_DIR}`));
  console.log(DIM(`  pdf:  ${has("pdfinfo") ? "poppler available" : "poppler MISSING"}`));

  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });

  try {
    const { context, page, consoleErrors, pageErrors } = await openApp(browser);
    await verifyBoot(page, consoleErrors, pageErrors);
    await verifyScreenGeometry(page);
    await verifyNormalMode(page);
    await page.screenshot({ path: join(OUT_DIR, "app-desktop.png") });
    await context.close();

    await verifyTemplates(browser);
    await verifyMultiPage(browser);
    await verifyOnePage(browser);
    await verifyOnePageOverflow(browser, "classic");
    // Minimal has the smallest base body size, so it is the template that
    // actually exercises the readability floor. Skipping it is how the floor
    // came to be violated in the first place.
    await verifyOnePageOverflow(browser, "minimal");
    /*
     * Editorial and Executive carry their identity in the display face, and the
     * One Page engine multiplies `--rm-size-body` on the *body* while the
     * masthead and section titles scale on the same `--rm-d-font`. A font that
     * behaves differently in the display role — Charter's, in Editorial — is
     * exactly where that assumption could break, so the floor is proven on the
     * page and not inferred from the shared tokens.
     */
    await verifyOnePageOverflow(browser, "editorial");
    await verifyOnePageOverflow(browser, "executive");
    await verifyPrintIsolation(browser);
    await verifyPrintBehaviour(browser);
    await verifyResponsive(browser);
    await verifyAccessibilityFixes(browser);
    await verifyInteractions(browser);
  } finally {
    await browser.close();
  }

  group("Print rendering (rasterised PDF pages)");
  for (const file of [
    "normal-classic.pdf",
    "one-page.pdf",
    "one-page-with-headers.pdf",
    "overflow-classic.pdf",
    "overflow-minimal.pdf",
    "export-default.pdf",
  ]) {
    const pages = await renderPdfToPng(join(OUT_DIR, file), file.replace(".pdf", "-print"));
    check(`${file} rendered to PNG for review`, pages.length > 0, `${pages.length} page image(s)`);
  }

  const failed = results.filter((result) => !result.ok);
  const summary = `${results.length - failed.length}/${results.length} checks passed`;
  console.log(
    `\n${failed.length === 0 ? PASS("ALL CHECKS PASSED") : FAIL(`${failed.length} CHECK(S) FAILED`)} — ${summary}`,
  );
  if (failed.length > 0) {
    for (const result of failed) console.log(`  ${FAIL("✘")} [${result.group}] ${result.name} ${DIM(result.detail)}`);
  }
  writeFileSync(join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  console.log(DIM(`\nArtifacts in ${OUT_DIR} (results.json, screenshots, PDFs, print PNGs)`));
  process.exit(failed.length === 0 ? 0 : 1);
}

if (!has("pdfinfo")) {
  console.error(FAIL("poppler-utils (pdfinfo/pdftotext/pdftoppm) is required for print verification."));
  process.exit(2);
}

main().catch((error) => {
  console.error(FAIL(`\nVerification crashed: ${error?.stack ?? error}`));
  process.exit(2);
});
