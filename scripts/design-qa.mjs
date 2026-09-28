/**
 * Programmatic design QA: contrast (WCAG), type scale, vertical rhythm and
 * measure. Replaces eyeballing screenshots, which are not available headless.
 */
const { chromium } = await import("/root/Resumark/node_modules/playwright-core/index.mjs");

const browser = await chromium.launch({
  executablePath: "/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:4173/", {
  waitUntil: "domcontentloaded",
});
await page.locator(".resume-document").first().waitFor();
await page.locator(".monaco-editor").first().waitFor({ timeout: 90_000 }).catch(() => {});
await page.waitForTimeout(500);

/** PRD §9 "suggested typography" ranges, in CSS px. */
const PRD_RANGES = {
  name: [24, 28],
  title: [12, 14],
  h2: [11, 14],
  h3: [11, 12],
  body: [9, 11],
  meta: [9, 10],
  link: [9, 10],
};

/** Where each typographic role of the resume lives in the DOM. */
const ROLE_SELECTORS = {
  name: ".resume-masthead h1",
  title: ".resume-masthead h1 + p",
  section: ".resume-section h2",
  job: ".resume-entry h3",
  body: ".resume-section li p, .resume-section > p",
  meta: ".resume-entry h3 + p",
  link: ".resume-masthead a, .resume-section a",
};

const probe = () =>
  page.evaluate(({ ranges, roleSelectors }) => {
    /* ---- colour helpers ------------------------------------------------- */
    const parse = (value) => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(",").map((n) => Number.parseFloat(n));
      return { r, g, b, a };
    };
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const contrast = (a, b) => {
      const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const rgb = ({ r, g, b }) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;

    const doc = document.querySelector(".resume-document");
    const page_ = { r: 255, g: 255, b: 255, a: 1 };

    /* ---- the size of each typographic role ------------------------------- */
    const roleSizes = {};
    for (const [name, selector] of Object.entries(roleSelectors)) {
      const el = doc.querySelector(selector);
      roleSizes[name] = el ? Number.parseFloat(getComputedStyle(el).fontSize) : null;
    }

    /* ---- sample every distinct text style -------------------------------- */
    const samples = new Map();
    for (const el of doc.querySelectorAll("h1, h2, h3, h4, p, li, a, strong, code, td, th")) {
      if (!el.textContent.trim()) continue;
      if (el.querySelector("h1,h2,h3,h4,p,li,ul,ol")) continue; // leaf-ish only
      const cs = getComputedStyle(el);
      const key = `${cs.fontSize}|${cs.fontWeight}|${cs.color}`;
      if (!samples.has(key)) {
        const bg = parse(getComputedStyle(el.closest("code, pre") ?? el).backgroundColor) ?? page_;
        const fg = over(parse(cs.color), page_);
        samples.set(key, {
          tag: el.tagName.toLowerCase(),
          size: Number.parseFloat(cs.fontSize),
          weight: Number.parseInt(cs.fontWeight, 10),
          color: rgb(fg),
          colorRaw: cs.color,
          lineHeight: cs.lineHeight,
          tracking: cs.letterSpacing,
          transform: cs.textTransform,
          onBg: rgb(bg),
          contrast: Number(contrast(fg, over(bg, page_)).toFixed(2)),
          large: Number.parseFloat(cs.fontSize) >= 24 || (Number.parseInt(cs.fontWeight, 10) >= 700 && Number.parseFloat(cs.fontSize) >= 18.66),
          sample: el.textContent.trim().slice(0, 42),
        });
      }
    }

    /* ---- measure (characters per line), measured not estimated ------------ */
    const body = doc.querySelector(".resume-section p, li p");
    const cs = body && getComputedStyle(body);
    let measureChars = 0;
    if (body && cs) {
      // Average advance width of the actual rendered font.
      const ruler = document.createElement("span");
      ruler.textContent = "abcdefghijklmnopqrstuvwxyz ";
      Object.assign(ruler.style, {
        position: "absolute",
        visibility: "hidden",
        whiteSpace: "pre",
        font: cs.font,
        letterSpacing: cs.letterSpacing,
      });
      doc.append(ruler);
      const average = ruler.getBoundingClientRect().width / 27;
      ruler.remove();
      measureChars = Math.round(doc.getBoundingClientRect().width / average);
    }

    /* ---- vertical rhythm (siblings only) --------------------------------- */
    const blocks = [...doc.querySelectorAll(".resume-section, .resume-entry, li, h2")];
    const gaps = [];
    for (let i = 1; i < blocks.length; i += 1) {
      const a = blocks[i - 1];
      const b = blocks[i];
      if (a.contains(b) || b.contains(a)) continue; // nested boxes overlap
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (Math.abs(ra.left - rb.left) > 2) continue;
      if (rb.top < ra.top) continue;
      const gap = rb.top - (ra.top + ra.height);
      if (gap >= 0 && gap < 40) gaps.push(Number(gap.toFixed(1)));
    }
    const uniqueGaps = [...new Set(gaps)].sort((x, y) => x - y);

    /* ---- section heading treatment -------------------------------------- */
    const h2 = doc.querySelector("h2");
    const h2cs = h2 && getComputedStyle(h2);
    const mast = doc.querySelector(".resume-masthead");
    const after = mast && getComputedStyle(mast, "::after");

    return {
      styles: [...samples.values()].sort((a, b) => b.size - a.size),
      roleSizes,
      measureChars,
      uniqueGaps,
      height: doc.scrollHeight,
      h2: h2cs && {
        size: Number.parseFloat(h2cs.fontSize),
        weight: Number.parseInt(h2cs.fontWeight, 10),
        tracking: h2cs.letterSpacing,
        transform: h2cs.textTransform,
        borderBottom: h2cs.borderBottomWidth !== "0px" ? h2cs.borderBottomColor : null,
        borderLeft: h2cs.borderLeftWidth !== "0px" ? h2cs.borderLeftColor : null,
        padding: h2cs.padding,
        marginBottom: h2cs.marginBottom,
      },
      mastheadRule: after && {
        width: after.borderBottomWidth,
        color: after.borderBottomColor,
        marginTop: after.marginTop,
      },
      ranges,
    };
  }, { ranges: PRD_RANGES, roleSelectors: ROLE_SELECTORS });

const pass = () => "✔";
let failures = 0;

/*
 * Read the templates from the switcher so a new template is design-reviewed the
 * day it is added. A hardcoded list here is a list that quietly stops covering
 * the product while the script keeps reporting "DESIGN QA PASSED".
 */
const templates = await page
  .locator("#template-select option")
  .evaluateAll((options) => options.map((option) => option.value));
if (templates.length === 0) throw new Error("no templates in #template-select");
console.log(`Templates under review: ${templates.join(", ")}\n`);

for (const template of templates) {
  await page.selectOption("#template-select", template);
  await page.waitForTimeout(400);
  const r = await probe();
  console.log(`\n${"=".repeat(74)}\n${template.toUpperCase()}  —  ${Math.round(r.height)}px tall\n${"=".repeat(74)}`);

  console.log("\n  type scale");
  for (const s of r.styles) {
    console.log(
      `    ${s.tag.padEnd(6)} ${String(s.size).padStart(5)}px  w${String(s.weight).padEnd(4)} ${s.color.padEnd(20)} contrast ${String(s.contrast).padStart(5)}  lh ${s.lineHeight.padEnd(8)} track ${s.tracking.padEnd(9)} ${s.transform}`,
    );
  }

  console.log("\n  section heading");
  console.log(`    ${r.h2.size}px w${r.h2.weight} tracking ${r.h2.tracking} ${r.h2.transform}`);
  console.log(`    rule-bottom: ${r.h2.borderBottom ?? "none"}   rule-left: ${r.h2.borderLeft ?? "none"}   padding: ${r.h2.padding}   margin-bottom: ${r.h2.marginBottom}`);
  console.log(`    masthead rule: ${r.mastheadRule.width} ${r.mastheadRule.color} (margin-top ${r.mastheadRule.marginTop})`);

  console.log(`\n  rhythm (distinct vertical gaps, px): ${r.uniqueGaps.join(", ")}`);
  console.log(`  measure: ~${r.measureChars} characters per line`);

  console.log("\n  checks");
  // contrast
  for (const s of r.styles) {
    const need = s.large ? 3 : 4.5;
    if (s.contrast < need) {
      failures += 1;
      console.log(`    ✘ ${s.tag} ${s.size}px ${s.color} contrast ${s.contrast} < ${need} (${s.sample})`);
    }
  }
  if (r.styles.every((s) => s.contrast >= (s.large ? 3 : 4.5))) {
    console.log(`    ✔ WCAG AA contrast on every text style (min ${Math.min(...r.styles.map((s) => s.contrast))}:1)`);
  }

  /* ---- named roles ------------------------------------------------------ */
  const role = (label, size, [lo, hi]) => {
    const ok = typeof size === "number" && size >= lo && size <= hi;
    if (!ok) failures += 1;
    console.log(`    ${ok ? pass() : "✘"} ${label}: ${size ?? "?"}px (PRD §9 ${lo}–${hi}px)`);
  };
  const { name, title, section, job, body: bodyP, meta, link } = r.roleSizes;

  role("name", name, PRD_RANGES.name);
  role("professional title", title, PRD_RANGES.title);
  role("section title", section, PRD_RANGES.h2);
  role("job title", job, PRD_RANGES.h3);
  role("body", bodyP, PRD_RANGES.body);
  role("metadata", meta, PRD_RANGES.meta);
  role("link", link, PRD_RANGES.link);

  // Visual hierarchy must be monotonic — a section heading that is smaller
  // than the job title under it reads as a mistake, whatever the intent.
  const hierarchy = name > section && section > job && job >= bodyP;
  if (!hierarchy) failures += 1;
  console.log(`    ${hierarchy ? pass() : "✘"} hierarchy is monotonic: ${name} > ${section} > ${job} ≥ body ${bodyP}`);

  // measure
  const measureOk = r.measureChars >= 60 && r.measureChars <= 120;
  if (!measureOk) failures += 1;
  console.log(`    ${measureOk ? pass() : "✘"} measure between 60 and 120 characters (A4 with 12mm/15mm margins)`);
  if (r.uniqueGaps.length > 8) {
    failures += 1;
    console.log(`    ✘ too many distinct gaps (${r.uniqueGaps.length}) — rhythm is not systematic`);
  } else {
    console.log(`    ${pass()} systematic rhythm: ${r.uniqueGaps.length} distinct gaps`);
  }
}

/*
 * The exit status is part of the contract. `verify-all.mjs` decides whether
 * `verify:e2e` passes from the child's exit code alone, so a script that
 * prints "DESIGN QA: 3 problem(s)" and then exits 0 turns every design
 * regression into a green build. Print the report, close the browser, and
 * fail.
 */
console.log(`\n\n${failures === 0 ? "DESIGN QA PASSED" : `DESIGN QA: ${failures} problem(s)`}`);
await browser.close();
if (failures > 0) process.exitCode = 1;
