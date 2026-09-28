# Verification

Everything below was produced by running the app in a real browser.

Claims are labelled, because the difference between a measured number and an
assumed one is the whole point of this document:

| Label | Means |
| --- | --- |
| **asserted** | a named check in `scripts/verify-print.mjs` that fails the run. Its measured value is in `verification/results.json`. |
| **reported** | printed by `scripts/design-qa.mjs` or a harness check's detail string. Visible, but not a gate. |
| **code fact** | true of the source, with no automated check behind it. |

Anything unlabelled is a description of the implementation. Where a number could
reasonably be mistaken for a gate, the label says which it is.

---

## 1. How to reproduce

```bash
npm install

# Static analysis + unit tests + production build
npm run verify

# Everything end-to-end: build, serve the static export, drive a real browser,
# print to PDF, inspect the PDF, then run the design QA
npm run verify:e2e
```

`npm run verify:e2e` is the single command that produces every artifact in
`verification/`. It:

1. runs `next build` (static export to `out/`),
2. serves `out/` with the zero-dependency server in `scripts/serve-static.mjs`
   on the first free port from 4173,
3. runs `scripts/verify-print.mjs` — the browser harness,
4. runs `scripts/design-qa.mjs` — the typographic/contrast audit,
5. shuts the server down and exits non-zero on the first failure.

Step 4 is a gate: `design-qa.mjs` sets `process.exitCode = 1` when it finds a
problem, so a contrast or type-scale regression fails `verify:e2e`. It did not
before — it printed `DESIGN QA: 3 problem(s)` and exited 0, which is a green
build on a red report. Both paths are exercised: exit 0 on the current design,
exit 1 with a forced failure.

To run the individual pieces:

```bash
npm run dev                                   # http://localhost:3000
PORT=3100 npm run dev                         # dev server on 3100, the harness default
npm start                                     # serve an existing out/ on $PORT
npm run verify:print                          # harness (defaults to localhost:3100)
npm run verify:design                         # design QA (defaults to 127.0.0.1:4173)
BASE_URL=http://127.0.0.1:4173 npm run verify:print
```

The two scripts have **different default targets** — `verify-print.mjs` defaults
to `http://localhost:3100` (a dev server), `design-qa.mjs` to
`http://127.0.0.1:4173` (the static export). `npm run verify:e2e` passes `BASE_URL`
explicitly, so the defaults only matter when you run a piece by hand.

`design-qa.mjs` is pinned to this machine: it imports `playwright-core` by
absolute path and hardcodes a `chromium-1243` build, so it ignores `CHROMIUM` and
`PLAYWRIGHT_BROWSERS_PATH` — both of which `verify-print.mjs` honours. That is a
portability wart, not a correctness one, and it is listed here rather than fixed
because the two scripts are dev-only tooling.

### Requirements for the harness

| Tool | Used for | Required? |
| --- | --- | --- |
| Chromium (Playwright build) | driving the UI, `page.pdf()` | yes — auto-detected, or set `CHROMIUM` |
| `pdfinfo` (poppler) | page count and page size | yes — the only tool checked at startup (exits 2 without it) |
| `pdftotext` (poppler) | text extraction, word bounding boxes | yes — not pre-checked, so a missing one crashes the run |
| `pdftoppm` (poppler) | rasterising PDF pages for human review | yes — six checks assert a PNG exists, so they fail without it |
| `pdfimages` (poppler) | second opinion on embedded images | no — degrades to the byte scan; see §3.3 |

`CHROMIUM` overrides the browser path, `BASE_URL` the app under test, `OUT_DIR`
the artifact directory, and `VIEWPORTS` the responsive viewports
(`desktop,tablet,mobile`).

`playwright-core` is a dev dependency and is never bundled into the app.

---

## 2. Latest result

```
ALL CHECKS PASSED — 261/261 checks passed
DESIGN QA PASSED
```

The full machine-readable result, including every check's measured value, is
`verification/results.json`. The 261 checks are spread over 16 groups:

| Group | Checks |
| --- | --- |
| Boot, console and DOM | 9 |
| A4 screen geometry (PRD §7, §26) | 6 |
| Normal mode + multi-page print (PRD §17, §18, §24) | 9 |
| Templates (PRD §10, §11) | 29 |
| Multi-page resumes in Normal mode (PRD §18, §19, §24) | 10 |
| One Page mode (PRD §12 – §16, §25) | 18 |
| One Page overflow warning — classic / minimal / editorial / executive | 4 × 9 = 36 |
| Print stylesheet isolation (PRD §23, §24) | 17 |
| Responsive layout (PRD §20, §30) | 35 |
| Focus visibility, contrast and link cues (WCAG 1.4.1 / 1.4.11) | 18 |
| Editing, persistence, reset, a11y (PRD §27 – §29, §35) | 57 |
| `window.print()` export (PRD §22, AC-08) | 11 |
| Print rendering (rasterised PDF pages) | 6 |

The template and template-dependent groups are derived from the shipped
`<select>` at run time rather than from a list in the harness. A hardcoded array
is a list that silently goes stale: a template added to `RESUME_TEMPLATES`
without editing the script would have gone unverified while every run still
reported green.

---

## 3. What the harness proves

The harness uses `page.pdf({ preferCSSPageSize: true })` — byte-for-byte the
same rendering path as a user choosing "Save as PDF" — and then inspects the
resulting PDF with poppler. It never inspects only the DOM.

### 3.1 Boot and DOM

Drives a fresh context, waits for Monaco to mount, and asserts the shell, the
header controls, the preview, the `h1` name, every heading of the example
resume, and the contact links are present — with **no page errors and no console
errors**.

Two honest limits on that last claim. The console check filters out
`/favicon|404 \(Not Found\)/i`, so a missing icon is not a failure. And
`waitForEditor` swallows its own timeout; the real gate is a separate
`count() > 0` assertion on `.monaco-editor`, so a late mount is caught even
though a *failed* one would only surface there.

### 3.2 A4 screen geometry

| Property | Measured | Required |
| --- | --- | --- |
| Sheet width | 793.69 px | 210 mm = 793.70 px |
| Sheet height | 1122.52 px | 297 mm = 1122.52 px |
| Sheet padding (top / left) | 45.35 / 56.69 px | mirrors `@page { margin: 12mm 15mm }` |
| Text column width | 680.31 px | 180 mm = 680.31 px |
| Preview zoom on a 1440 px viewport | 1 | 1 |
| Box shadow | present | screen only |

The text column check is the WYSIWYG guarantee: the width the user reads on
screen is exactly the width the printer will lay out.

### 3.3 Print output

For the example resume, in all five templates, and for the 8-page fixture:

| Check | Result |
| --- | --- |
| PDF page size | 594.96 × 841.92 pt = A4 portrait |
| PDF producer | `Skia/PDF m153` — the browser's own print engine |
| PDF page count vs. on-screen badge | 8 = 8 |
| Text is selectable and searchable | name and body keyword recovered by `pdftotext` |
| Bullets survive | 14 of 14 item texts present; markers are glyphs, not text |
| Full-page raster present | **none** — no embedded images at all |
| Link annotations | `mailto:`, `tel:` and two `https:` URIs |
| Application chrome in the PDF | none (no "Export PDF", "Autosave", "Ctrl/Cmd", "Loading editor", "A4 · 210", "Skip to") |
| Section headings print upper case | on Classic, asserted on the 8-page fixture |

**No full-page raster** is asserted twice over, because one method is not
enough. A raw byte scan of the PDF reports every `/Subtype /Image` dictionary
with a 2000-character window to `/Width` — the previous version used 300 and
returned on the first hit, so an image whose dictionary happened to be longer,
or one that was not the first, was invisible. And `pdfimages -list`, which
decodes compressed object streams that no byte scan can reach, is asked as a
second opinion; where it is available its row count is compared against the
scan's. Both currently report **zero images in every fixture**, which is the
truth for a vector-text export: there is nothing to be page-sized. The honest
limit is that a PDF hiding its images in an object stream would defeat the byte
scan, which is why the poppler cross-check is there.

Bullets are counted rather than spot-checked: all 14 of the example resume's
bullets are extracted, whitespace-normalised on both sides, and required to
appear in the PDF. The *marker* is deliberately not asserted — `list-style:
disc` and Minimal's en dash are glyphs on the marker box, not characters in the
text layer, so they cannot appear in `pdftotext` output and no ATS parser ever
sees them. The item text is the part that matters.

**With the browser's default headers and footers on.** Playwright's `page.pdf()`
is CDP `Page.printToPDF`, whose `displayHeaderFooter` defaults to false — so
every other PDF in this report is *cleaner* than what a user gets from a fresh
Chromium profile, and no other check here could see a regression caused by
them. Three checks therefore drive CDP directly with the flag on:

| Fixture | Headers off | Headers on | Badge | Asserted |
| --- | --- | --- | --- | --- |
| One Page fit | 1 page | 1 page | `1 page` | yes |
| 8-page fixture | 8 pages | 8 pages | `8 pages` | yes |

Chromium draws the header and footer in the page margin, so the content box
keeps its height and the page count is unchanged — now asserted rather than
assumed, for both the "it still fits" and the "the model still predicts"
claims. The headers themselves are still in the file: see §8.1.

### 3.4 Print stylesheet isolation

Under `emulateMedia({ media: "print" })`:

- header, editor pane, mobile tab bar, page badge, footer, pane bar and skip
  link: all hidden
- resume document: still visible
- preview zoom: forced to 1
- sheet padding: 0 (margins come from `@page`, not from the sheet)
- box shadow: removed
- decorative gradient: removed
- sheet width: fills the page box

Then, from the PDF's own word bounding boxes (`pdftotext -bbox`):

| Edge | Measured | Assertion bound | `@page` margin |
| --- | --- | --- | --- |
| Left | 42.7 pt | ≥ 42.5 | 42.5 pt (15 mm) |
| Top | 33.0 pt | ≥ 32.9 | 34.0 pt (12 mm) |
| Right | 551.9 pt | ≤ 554.3 | 552.8 pt |
| Bottom | 775.2 pt | ≤ 809.9 | 807.9 pt |

The screen padding and the print margins are the same numbers expressed twice,
which is why the top edge lands 1.0 pt above the nominal 34 pt: the first text
baseline box is taller than the line box it sits in. The bounds include a
tolerance, so the right and bottom rows are the *assertion limit*, not the
nominal margin. Only `paddingTop` and the width are read from computed style —
the shorthand's other three sides are assumed to follow.

### 3.5 One Page mode

Fired at a document 1283 px tall against a 1027.81 px engine budget (the
1031.81 px printable height less a 4 px safety margin) — genuinely over one page
before compaction, at 1.25 pages.

| Check | Result |
| --- | --- |
| Badge | `1 page` |
| Compaction applied | level 7 of 9 |
| Content height after compaction | 1007.00 px ≤ 1027.81 px |
| Body font | 10.72 px (11 px base × the level-7 multiplier 0.975) |
| `transform` on the document | `none` — never scaled |
| `overflow` on the document | `visible` — never clipped |
| Density custom properties | applied (`--rm-d-section: 0.4`, `--rm-d-font: 0.975`, …) |
| PDF | exactly 1 page, A4, 2950 characters of selectable text, no raster |
| Every section still in the PDF | yes, none missing |
| Overflow warning | absent, correctly |
| Hint text | explains the applied compaction |
| One Page off | level 0 restored, height 1007 → 1283 px |
| Headers/footers on | still exactly 1 page |

The check asserts `level > 0`, not `level === 7` — the level is reported, not
gated, because the right level for a given document is an implementation
detail. What is gated is the promise: it fits, it is readable, it is neither
scaled nor clipped, and the PDF is one page with the text intact.

The two "never" rows are the point of the feature: the document is never
transformed, scaled, hidden or clipped. Only spacing and font size change, and
only through CSS custom properties that the print stylesheet reads identically.

**Design rationale, not a measurement** (`onePage.ts`): the ladder is ordered
gaps → list spacing → paragraph spacing → heading spacing → entry spacing →
leading → typography, one lever per step, because grouping several into a step
would skip the ordering the PRD asks for and over-compact the document. The
reason leading enters before type is that on a real resume the spacing levers
together account for about a third of the height and line boxes for the rest, so
a ladder that only trims gaps reclaims ~10 % and then has to fall through two
aggressive typography steps to finish. No check measures that reclaim; the
recorded `level 7` above is the only ladder figure this document asserts.

PRD §14 lists "reduce page margins" as the sixth lever. It is not implemented,
and cannot be: `@page` margins are static CSS and cannot be conditioned on the
density level. The closest honest equivalent — each entry block's margin — is
used in its place, and the status bar says so rather than overclaiming.

### 3.6 Overflow warning

With the 8-page fixture in One Page mode — far past what any level can reach —
run against **all four** templates, in four separate groups of nine checks each:

| | Classic | Minimal | Editorial | Executive |
| --- | --- | --- | --- | --- |
| Body font at the floor | 10.45 px | 9.97 px | 10.45 px | 10.45 px |
| Absolute floor (9.5 px) crossed | no | no | no | no |
| Badge | `Over 1 page` | `Over 1 page` | `Over 1 page` | `Over 1 page` |
| Announced | `role="status"` | `role="status"` | `role="status"` | `role="status"` |
| PDF pages | 4 | 3 | 4 | 4 |
| Content missing from the PDF | none | none | none | none |
| Document hidden or clipped | no | no | no | no |

Minimal is in the set because it has the densest body size and is the template
that actually exercises the floor. Editorial and Executive are in it because
they carry their identity in a *different typeface* on the display roles, and
the One Page engine scales the masthead and section titles on the same
`--rm-d-font` multiplier it applies to the body — a font that behaves
differently in that role is exactly where the shared-token assumption could
break, so the floor is proven on the page rather than inferred.

The floor is derived from `--rm-size-body` read off the live document, not from a
table in the harness. Hard-coding those sizes is exactly how Minimal broke the
guarantee the first time: the table kept claiming a 10 px base after the
stylesheet said 10.5 px.

### 3.7 Templates

The template list is read from `#template-select` at run time, so this group
covers all five — Classic, Modern, Minimal, Editorial, Executive — and would
cover a sixth without a code change. A floor check (`at least the three original
templates ship`) guards against one being dropped.

Per template, **asserted**:

- the correct document class is applied, derived by the convention
  `resume--<id>` rather than restated per template — so a registry entry and a
  CSS block that disagree on the name fail rather than being quietly skipped
- the `h1` name is unchanged after the switch (the template is presentation
  only). The Markdown is never hashed or compared — the check reads the rendered
  name, not the source
- the PDF is A4, 1 page, text intact
- **every heading survives PDF text extraction as one word** (9 per template) —
  see the letter-spacing bug in §7
- links are underlined in every template, not distinguished by colour alone
  (WCAG 1.4.1) — the cue is a real `text-decoration`, because a sub-pixel
  `border-bottom` disappears under the preview's zoom
- no console or page errors

Also **asserted** across the set: `no two templates render an identical look` —
5 distinct signatures. The signature is the display face, name size, section
tracking, both rule widths, the case transform, the body face and the document
height, so two templates whose CSS blocks collapsed to the same tokens would
collide. A switcher offering two buttons that render the same document is a real
defect, not a matter of taste.

**Reported**, not asserted: the design QA prints the rendered document height —
991 px Classic, 1007 px Modern, 818 px Minimal, 997 px Editorial, 1025 px
Executive — against a 1027.81 px budget. The page-fill percentages (96 % / 98 %
/ 79 % / 97 % / 100 %) are derived from those numbers by hand; nothing computes
or gates them. Minimal is the densest template and the shortest content still
leaves it with air at the foot; that is inherent to the template's purpose, not
a bug, and it is the reason a long resume reaches a higher compaction level on
Minimal than on Classic.

Executive is the one template that fits with ~3 px to spare, and that is
deliberate. Its first draft used 1.55 leading and 13 px entry margins, which put
the example resume 5 px *over* one page — so a user selecting it opened on a
two-page preview, which reads as a broken app rather than as an airy design. The
airiness is now spent on the type scale and the section gap, where a reader
perceives it, rather than on the leading, which only shows up as an overflow.
The consequence is that Executive has almost no headroom for the example resume;
longer content will spill, which is what Normal mode is for.

### 3.8 Responsive

| Viewport | Layout | Result |
| --- | --- | --- |
| 1440 × 900 | two panes side by side | no horizontal scroll, tab bar absent |
| 900 × 1180 | panes stacked | no horizontal scroll, tab bar absent |
| 390 × 844 | tab bar, one pane at a time | no horizontal scroll, tab switch works, sheet at 0.72 zoom, stage scrolls |

The tab bar is only mounted below the tab breakpoint, and above it each pane is
a labelled `region` (**code fact**, `Workspace.tsx`). A `role="tablist"` whose
own element is `display: none` is announced as an available-but-unreachable
widget, which is worse than not having it. The check here is
`isVisible() === false` at 1440 and 900 px, which cannot tell "not mounted" from
"mounted and hidden" — so it guards the symptom, not the mechanism.

"Visible" is Playwright's visibility, not just a non-zero box, so a
`visibility: hidden` pane counts as hidden — and so does an element that is not
rendered at all, which is why the "hidden in print" checks treat a missing node
as hidden rather than waiting for it to appear. The same trap is the reason the
reflow checks in §3.11 test `display`, `visibility` and a non-zero rect together
rather than `offsetParent`, which an inactive pane satisfies.

### 3.9 Editing, persistence, reset, accessibility

- typing in Monaco updates the preview live; **no character is dropped** when
  typing faster than React re-renders (all 10 tokens arrive intact)
- keystroke → preview latency: the last two runs measured medians of 84 ms and
  90 ms, worst cases of 206 ms and 171 ms. The figure moves with the machine, so
  the **assertion is a median under 500 ms** and the numbers above are the two
  most recent observations, not a threshold.
- markdown persisted to `localStorage`, restored after a reload
- reset asks for confirmation; the dialog is portalled outside `.app-shell` and
  the app shell is made `inert`, so the background is genuinely unreachable by
  pointer, keyboard and assistive technology — `aria-modal` alone is only an
  instruction. Portalling to `document.body` specifically is a **code fact**
  (`ConfirmDialog.tsx`); the check is "not inside `.app-shell`".
- focus starts on the **dialog**, not on "Delete and reset": a destructive
  action should not be under the user's finger before they have read the question
- the background is not focusable while the dialog is open, and `Escape` restores
  focus to the Reset button — **asserted by pressing Tab six times** and
  confirming every stop stays inside the dialog, cycles only its two buttons, and
  reaches both
- page mode and template persist across a reload
- the **Autosave switch** (PRD §27a) — see below
- exactly one `banner` landmark, one `main` landmark, a single `h1`, and the
  resume masthead correctly scoped inside the `article` (it is not a banner)
- every `input` / `select` / `button` outside `.no-print` has an accessible name
  from `aria-label`, `aria-labelledby`, an associated or wrapping `<label>`, or
  visible text. A bare `id` does not count, which is what it previously
  accepted.
- the editor exposes a named, focusable `role="textbox"`, and Monaco's IME proxy
  is `aria-hidden` — **asserted**. `ariaLabel` on its own is not enough: measured,
  it lands on `div.native-edit-context` with no role and no tabindex while the
  focusable textarea carries nothing at all, so the control a screen reader lands
  on was unnamed until `accessibilitySupport: "on"` was added.
- `Ctrl`/`Cmd`+`S` is intercepted with `preventDefault` — **asserted** for both
  modifiers, by listening on `window` in the bubble phase *after* the app's own
  handler and reading `defaultPrevented` off the same event. Whether the browser
  then suppresses its own save dialog is not observable from a page.
- the skip link is the **first** tab stop, the header's five controls follow it,
  tabbing alone does not reach the editor within six presses, and one Tab + Enter
  from a cold load moves focus to `#markdown-source` (WCAG 2.4.1 Bypass Blocks).
  Every walk starts from a fresh `reload`, because `blur()` does not rewind
  Chromium's sequential focus navigation starting point.

#### The Autosave switch (PRD §27a)

The semantics are destructive by choice: with autosave off, nothing is written,
so a reload discards the session. **Asserted** (18 checks, all named in
`verification/results.json`):

- the control is a real `<input type="checkbox">`, and autosave is on by default
- turning autosave off **does not destroy the already-saved resume** — the stored
  value is byte-identical before and after. The switch stops future writes; it
  never removes what is stored
- the status line reports `Autosave off` in a distinct `warn` tone, and a
  **visible** warning paragraph states that changes will be discarded and names
  the action that loses them ("reloading or closing the tab"). The claim is
  deliberately checked against the paragraph's own text rather than the
  `title` attribute, because a tooltip is invisible to keyboard users, to touch
  users, and to anyone who simply looks away — and this is the warning that
  stands between a user and losing their work
- an edit typed with autosave off reaches the preview but **not** `localStorage`
  (the stored value is still byte-identical after a 700 ms settle, well past the
  300 ms debounce)
- `Ctrl`+`S` is a **no-op** while autosave is off, for the same reason: a manual
  save that silently did nothing would be worse than one never offered, and it
  would contradict the switch that is visibly saying nothing is being written
- after a reload autosave is **still off** — the preference lives under its own
  key, `resumark:prefs:v1`, and never shares the resume key
- after that reload the unsaved edit is gone (the documented consequence) and
  the previously saved snapshot is intact
- the warning is still visible and still the warn colour at 390 px — the
  responsive rule that hides `.save-status` carves out `error` and `warn`, since
  "not saved" must never be the state that gets hidden
- re-enabling resumes writing: a **new** edit is made, because at that point the
  in-memory resume is already the stored snapshot and the resumed write would be
  byte-identical, so a "did localStorage change" assertion would pass for the
  wrong reason. (It did, once, and it failed for the right one.)
- the status line then reports a fresh `Saved HH:MM`

The autosave toggle is also covered by the focus-ring check (§3.12) and by the
accessible-name check — it is one of the 5 enumerated `input`/`select`/`button`
elements, named by its wrapping `<label>`.

### 3.10 Export

`window.print()` is called exactly once. The PDF that follows comes from a
separate `page.pdf()` — the harness stubs `window.print` to count the call, then
prints for real, so the two claims are measured independently.

A Markdown link written as a bare host (`- [jane.dev](jane.dev)`) is rewritten to
`https://jane.dev` before it reaches the DOM. `react-markdown`'s default
transform keeps the value as-is, and the browser then resolves it against the
deployment origin, so the PDF would record a link to a page that does not exist.

**Asserted** against a dedicated fixture: `jane.dev` → `https://jane.dev/`, a
multi-label host `notes.example.org` → `https://notes.example.org/`, and a
`mailto:` left alone, with no annotation pointing at the deployment host. The
example resume cannot prove this — its hrefs are already explicit, so the
transform is never exercised by it.

### 3.11 Reflow and zoom (WCAG 1.4.4, 1.4.10)

**Asserted** in the browser. 200 % browser zoom is simulated the honest way —
half the CSS viewport at 2× device pixel ratio — because a `transform: scale()`
would be a lie here: the app is full of transforms, the preview zoom being one,
and it would behave differently under a real zoom.

| Case | Viewport | Horizontal scroll | Controls clipped | Panes on screen |
| --- | --- | --- | --- | --- |
| 320 px reflow (1.4.10) | 320 × 720 | none | 0 of 4 | 1 |
| 200 % of a 1280 px window | 640 × 900 @2× | none | 0 of 4 | 1 |
| 200 % of a 1024 px window | 512 × 900 @2× | none | 0 of 4 | 1 |

"Panes on screen" counts the panes that actually paint — `display` is not
`none`, `visibility` is not `hidden`, and the box is non-empty. The preview's
own stage is allowed to scroll horizontally: an A4 sheet at a legible zoom is
wider than 320 px and has to be, so the requirement is about the *page* not
scrolling, not about squeezing the sheet.

The preview is scaled with `zoom` but only down to **0.72**. The document's type
is sized in absolute pixels (PRD §9), so `zoom` scales it with no lower bound of
its own: at the old 0.32 floor the 11 px body rendered at 3.5 CSS px on a 320 px
phone, which is not a preview. Past the floor the stage scrolls horizontally
instead, which costs a scrollbar and keeps the text a real size. At 390 px the
floor binds and the body renders at **8.64 px**, asserted at ≥ 7.5 px.

Not asserted anywhere: hit-target geometry. The contact links inside the resume
document are inline links within a block of text, which WCAG 2.5.8 exempts, and
the One Page checkbox sits inside its `<label>`, so the label is the hit target
— but no check measures either, and this document does not claim that it does.

### 3.12 Keyboard and focus visibility

Measured on the six focusable surfaces the harness enumerates, plus one separate
check on the editor pane's ring token. A gradient surface is resolved by taking
**every** stop and holding the ring to the least favourable one, and an
unparseable colour deliberately resolves to transparent black so a broken lookup
fails rather than passes.

| Element | Focus ring | Worst contrast | Asserted |
| --- | --- | --- | --- |
| `#template-select` | `solid 2px #f8fafc`, offset 2px | **15.42:1** against the header | yes |
| `#one-page-toggle` | `solid 2px #f8fafc`, offset 2px | 15.42:1 | yes |
| `#autosave-toggle` | `solid 2px #f8fafc`, offset 2px | 15.42:1 | yes |
| Reset button | `solid 2px #f8fafc`, offset 2px | 15.42:1 | yes |
| Export PDF button | `solid 2px #f8fafc`, offset 2px | 15.42:1 | yes |
| preview stage | `solid 2px #0f172a`, offset 2px | **14.91:1** against the stage | yes |
| editor pane ring token | `#f8fafc` | 15.93:1 against `rgb(30,30,30)` | yes |
| skip link | **not ring-checked** — the tab-order check covers it instead | — | no |
| mobile Editor/Preview tab | **not ring-checked** | — | no |
| dialog backdrop | **not ring-checked** | — | no |

Each of the first six must clear **3:1** (WCAG 1.4.11, non-text contrast), not
the 4.5:1 a text check would use — a focus ring is not text. The two pane-bar
hints, which *are* text, must clear 4.5:1 and are checked separately: 6.03:1 for
the editor hint and 6.15:1 for the preview hint, on surfaces that differ and so
cannot share a colour.

The ring is `#f8fafc` on the dark header, the dark editor pane and the dialog
backdrop, and `#0f172a` everywhere else. A single dark ring scored 1.00–1.17:1
against the dark surfaces: painted, and invisible, on every keyboard-reachable
control in the app. *(Those figures are a code comment's measurement, not a
check — the current check reports 15.42:1, and the point is only that the old
value was invisible.)*

Two things make this check real rather than decorative. `outline-offset: 2px`
keeps the ring off the control's own edge — the Export PDF button is a
`#f8fafc` pill on a dark header, and a flush light ring would merge into it. And
the surface is resolved by taking **every** stop of a gradient and holding the
ring to the least favourable one, because the header is
`linear-gradient(rgb(22,32,58), rgb(15,23,42))` over a transparent
`background-color`. An earlier version of this check fell through to that
transparent colour and reported **20.07:1** for a ring that is invisible on all
three real surfaces and perfect on none of them. An unrecognised colour now
resolves to transparent black on purpose, so a broken lookup fails the check
instead of passing it.

Monaco is deliberately excluded from the ring check. It owns its own stylesheet
and sets `outline: none` on the IME proxy it uses as a focus target; inside a
code editor the blinking text cursor *is* the focus indicator, exactly as in
every other one. What is asserted instead is that the editor is keyboard
reachable, matches `:focus-visible` when focused, exposes a named textbox, and
that the ring token on its surface is the light one.

**Asserted** below the ring table:

- The mobile tab bar is a working tablist: roving `tabindex` with exactly one
  `0`, `aria-selected` on the tab that is tabbable, `aria-controls` resolving to
  a real element, horizontal orientation (`aria-orientation` is left off, which
  is the ARIA default for a tablist), `ArrowRight` and `ArrowLeft` moving
  selection *and* revealing the matching pane, and the roving tabindex surviving
  the move.
- The reset dialog traps focus: six Tab presses stay inside it, cycle only its two
  buttons, and reach both — and `Escape` returns focus to the **Reset** button,
  asserted by identity rather than by "focus moved somewhere sensible".
- Monaco is keyboard reachable and matches `:focus-visible` when focused
  (`active=true focus-visible=true`).

---

## 4. Design QA

`scripts/design-qa.mjs` measures the rendered document instead of eyeballing a
screenshot. For each template it reports every distinct text style with its
computed size, weight, colour, line height, tracking and transform, and then
asserts:

- **WCAG AA contrast** on every text style against the page (≥ 4.5:1 for normal
  text, ≥ 3:1 for large text). Worst observed: **5.81:1** (Modern's muted
  metadata), 5.98:1 (Classic's), 6.23:1 (Executive's), 6.42:1 (Minimal's),
  7.08:1 (Editorial's).
- **PRD §9 type ranges** per role, measured from the actual DOM
  (`.resume-masthead h1`, `.resume-section h2`, `.resume-entry h3`, …) — not
  guessed from the CSS.
- **Monotonic hierarchy**: name > section title > job title ≥ body.
- **Measure** between 60 and 120 characters per line.
- **Systematic rhythm**: at most 8 distinct vertical gaps between sibling blocks.

| Role | Classic | Modern | Minimal | Editorial | Executive | PRD §9 | Asserted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name | 27 px | 28 px | 24 px | 27 px | 28 px | 24–28 | yes |
| Section title | 13.5 px | 14 px | 13 px | 12.5 px | 13 px | 11–14 | yes |
| Professional title | 12 px | 12.5 px | 12 px | 12 px | 13.5 px | 12–14 | yes |
| Job title | 11.5 px | 12 px | 11 px | 11.5 px | 11.5 px | 11–12 | yes |
| Body | 11 px | 11 px | 10.5 px | 11 px | 11 px | 9–11 | yes |
| Metadata | 9.5 px | 9.5 px | 9 px | 9.5 px | 9.5 px | 9–10 | yes |
| Link | 9.5 px | 9.5 px | 9 px | 9.5 px | 9.5 px | 9–10 | yes |
| Body line height | 1.46 | 1.5 | 1.38 | 1.52 | 1.5 | — | no (printed) |
| Section gap | 17 px | 18 px | 14 px | 16 px | 19 px | — | no (printed) |
| Section heading case | upper | upper | sentence | upper | upper | — | no (printed) |
| Display face | sans | sans | sans | **serif** | sans | — | no (printed) |
| Distinct vertical gaps | 3 | 3 | 3 | 3 | 3 | — | yes |
| Measure | ~112 chars | ~112 chars | ~117 chars | ~112 chars | ~112 chars | 60–120 | yes |
| Document height | 991 px | 1007 px | 818 px | 997 px | 1025 px | — | no (printed) |
| Page fill | 96 % | 98 % | 79 % | 97 % | 100 % | — | no, and derived by hand |

The last two rows are the ones most likely to be read as gates. The design QA
prints a rounded height and the page-fill percentages were computed from those
prints; `≤ 1031.8` in the earlier version of this table implied an assertion
that does not exist. What *is* gated is the type scale, the contrast, the
hierarchy, the measure and the rhythm.

The templates differ in *rhythm* as much as in size, which is what makes them
read as different documents rather than five colour schemes: Classic rests on a
17 px section gap with ruled headings, Modern adds a 2.5 px accent bar and an
18 px gap, Minimal drops to 14 px, sentence-case headings and an en-dash entry
marker, Editorial uses a serif display face over a 16 px gap with heavy 1.25 px
rules, and Executive takes a 19 px gap with a 2.5 px letterhead rule and no bar
at all. The last two are also the pair the harness's signature check exists for:
Executive deliberately omits Modern's accent bar, because reusing it would make
the two indistinguishable at a glance.

**Editorial's serif is display-only, by measurement.** A full-serif body was the
first attempt and it failed the measure check at **137 characters**: Charter is a
narrow face, so 11 px of it fits far more words per line than 11 px of the UI
sans. Holding the body in the sans keeps the measure where every other template
has it, and spends the serif on the name, the professional title and the section
titles — which is how the journals it borrows from are actually set. The
`--rm-font-display` token is what makes that expressible without a second code
path; it defaults to `--rm-font`, so the other four templates are unaffected.

The measure is ~112–117 characters. That is inherent to the PRD's own
geometry: `@page { margin: 12mm 15mm }` leaves a 180 mm column, and 180 mm of
11 px text is ~112 characters. The margins match the PRD exactly and were not
widened to flatter the measure. Minimal is the only template that could shorten
it — by shrinking its body — and at 10 px it was ~123 characters, past the
readable end of the range (a `resume.css` comment's figure, not a measurement);
10.5 px brings it to a measured ~117 while keeping Minimal the densest of the
five.

---

## 5. Unit tests

`npm run test` — 48 tests across 3 files:

| File | Tests | Covers |
| --- | --- | --- |
| `src/lib/markdown/resumeOutline.test.ts` | 15 | masthead / section / entry extraction from Markdown, edge cases |
| `src/lib/onePage.test.ts` | 25 | density ladder monotonicity and lever ordering, the per-template font floor (all five templates) and the 5 % cap on type reduction, `decideFit`, `relaxLevel` including the climbing guard, block-wise page counting |
| `src/lib/storage.test.ts` | 8 | parse, versioned key, corrupt-payload fallback, the template guard (all five), the document title, and `parseStoredPrefs` including the key separation and the fail-toward-persistence default |

The autosave preference parser is unit-tested rather than left to the harness
alone, because its failure mode is silent: the first implementation read
`candidate.autosave === true`, which treats a *missing* key, a hand-edited
`"false"` string and a stale payload alike as "off" — and the cost of guessing
wrong there is the user losing their resume, not losing a keystroke. Only a real
boolean switches it off; anything unrecognised falls back to on.

## 6. Static-export audit

Run by hand with `grep` over the shipped `out/`. **Not** covered by any automated
check — the harness loads the export and exercises the app, but never inspects
the built artifacts. Every bullet below was re-verified by hand:

- 7 runtime dependencies: `next`, `react`, `react-dom`, `react-markdown`,
  `remark-gfm`, `@monaco-editor/react`, `monaco-editor`. No PDF library, no
  state library, no HTTP client, no AI SDK, no auth or database package.
- no `route.ts`, no `"use server"`, no `middleware.ts` — the export is pure
  static HTML, CSS and JS.
- no `fetch`, `XMLHttpRequest` or `/api/` call anywhere in `src/`. Six chunks in
  `out/` contain `fetch(`, and every one is accounted for: Next's RSC prefetch
  (`main-*.js`, and the `1255` RSC action chunk, both same-origin with
  `credentials: "same-origin"`), the bundled `lib.dom` **type declarations**
  (`5acf1a06`), which is the string `fetch(input: RequestInfo | URL, init?:
  RequestInit)` and never runs, Monaco's own link-provider module
  (`fetch(e).then(r => r.text())` — the `7773` chunk), and two React-DOM internal
  float/`loadModule` shims.
- `toDataURL` / `getContext(` appear only inside the bundled `lib.dom` type
  declarations and Monaco's own minimap rendering — no application code takes a
  screenshot, and no canvas is used to build a PDF.
- `window.print()` occurs in exactly one chunk (`app/page-*.js`).
- no `.d.ts` or `.wasm` payload is fetched: Monaco's language services are
  bundled, so the editor works offline. The only font shipped is Monaco's
  `codicon.ttf` — the resume itself uses the system stack (see §8.3).

---

## 7. Bugs this process found

Recorded because each one is a class of defect that the checks above now guard
against.

| Bug | How it was found | Fix |
| --- | --- | --- |
| Monaco treated as a controlled input, dropping characters typed faster than React re-renders (`latency1` arrived as `atency1`) | comparing model length against preview length while typing | the editor is now uncontrolled: Monaco owns the text, external changes (reset, restore) are pushed in explicitly |
| A flash of the example resume on every reload | the page badge briefly reported the default document's page count | `useDeferredValue` removed from the preview; the restore now lands in the single pre-paint commit |
| The autosave debounce never fired during continuous typing | reading `localStorage` mid-typing-session | added a 2 s maximum wait alongside the 300 ms debounce |
| The page badge could report a stale page count | a race between the deferred preview render and the ResizeObserver | the document view is memoised and the density style is memoised per level, so a measurement update no longer re-renders the Markdown tree |
| Hierarchy inversion: the job title was larger than the section heading | the design QA's monotonicity check | corrected the type scale in every template (and re-checked for the two added later) |
| The focus ring was invisible on almost every control | measuring the ring's computed colour against the surface it sits on | `--focus-ring` is a token, flipped to `#f8fafc` on the dark header, editor pane and dialog; a new check measures ≥ 3:1 on five enumerated focusable surfaces |
| The focus-ring check was passing vacuously | the header's gradient parser could not match an `rgb()` stop, so it fell through to a transparent `background-color` and reported 20.07:1 | every gradient stop is measured and the least favourable one wins; an unparseable colour resolves to transparent black so a broken lookup fails |
| The skip link was the *fifth* tab stop | walking the tab order from a cold load | it is now the first child of the shell, before the header — a skip link that arrives after the thing it bypasses saves three presses and is announced too late (WCAG 2.4.1) |
| Focus never returned to the Reset button after `Escape` | asserting focus restoration on dialog close | `inert` and focus restoration were two effects, and React runs cleanups in declaration order — so `.focus()` fired while the shell was still `inert`, which makes it a no-op. They are one effect now, in the order that works |
| The editor had no accessible name at all | querying the element a screen reader actually lands on | Monaco's `ariaLabel` lands on `div.native-edit-context` with no role and no tabindex, while the focusable IME textarea carries nothing. `accessibilitySupport: "on"` exposes a real `role="textbox"` |
| The "no full-page raster" check could not see a large image | its 300-character dictionary window, and returning on the first match | every image is reported by a 2000-character window, and `pdfimages -list` is a second opinion that decodes compressed object streams |
| The "Ctrl+S does nothing" check could never fail | reading the assertion | it passed a literal `true`; it now listens on `window` after the app's handler and reads `defaultPrevented` off the same event, for both `Ctrl` and `Cmd` |
| "Every form control has an accessible name" accepted a bare `id` | tightening what counts as a name | an `id` is for `<label for>`; the check now requires `aria-label`, `aria-labelledby`, an associated or wrapping `<label>`, or visible text |
| The design QA could not fail the build | it printed `DESIGN QA: N problem(s)` and exited 0 | it sets `process.exitCode = 1`, so `verify:e2e` gates on it. Both exit paths were exercised |
| The "default resume" fixture included the file's JSDoc comment | counting the fixture's bullets and finding two the app has never heard of | the extraction now anchors on the first backtick after the declaration, so the fixture is exactly the template literal |
| The reflow check reported two visible panes on a phone | it used `offsetParent !== null`, which `visibility: hidden` satisfies | visibility is `display`, `visibility` and a non-empty box together — the same trap the viewport loop documents for Playwright's `isVisible()` |
| `blur()` did not rewind the tab sequence | the skip-link activation test kept landing on the preview pane | Chromium keeps its sequential focus navigation starting point where the last focus was; every walk now starts from a fresh `reload` |
| Markdown tables overflowed the sheet and lost their right-hand cells from the PDF | a four-column table in a 180 mm column | `.rm-table-wrap` styled, `table-layout: fixed`, `overflow-wrap: anywhere`; the check asserts the wrapper cannot exceed the column |
| Minimal broke the One Page readability floor and the warning quoted the wrong number | the floor was asserted against Classic's 11 px base only | the floor is derived from the *densest* template's body size; the overflow check now runs on Classic **and** Minimal, with the base read off the live document |
| One Page over-compacted and never relaxed back | deleting a paragraph left the document visibly denser than necessary | `relaxLevel` restarts the ladder when the content shrinks by ≥ 3 % and now fits |
| `relaxLevel` livelocked the fit | the ladder oscillated between two levels forever instead of settling | raising a level shrinks the document by a few percent, which is exactly what the relax trigger looks for; the relax is now suppressed for one pass after a climb |
| The page badge under-reported by a page | the badge said 7, the PDF had 8 | the badge now simulates pagination over the document's unbreakable blocks, and glues each heading to the block after it because `break-after: avoid` means a heading cannot be stranded |
| A `position: fixed` skip link printed on every page of the PDF | reading the extracted text of an 8-page PDF | `.skip-link` is `display: none` in print; "Skip to" was added to the chrome-leak list |
| `.workspace__pane--editor` was re-shown by the print reset | the reset's `display: block` won on source order at equal specificity | the pane is now hidden explicitly, so nothing visible depends on the cascade order |
| A `role="tablist"` rendered with `display: none` above the tab breakpoint | a screen reader announcing an unreachable widget | the tablist is only mounted below the breakpoint; above it each pane is a labelled `region` |
| The preview scaled to 4–5 px text on a phone | measuring the rendered size of the body at the zoom floor | the floor is 0.72 and the stage scrolls past it; the check asserts ≥ 7.5 px rendered |
| Pane-bar hints sat at 3.22:1 against their surfaces | a contrast sweep of the secondary text | per-pane colours, both now ≥ 4.5:1 |
| Links were distinguished by colour alone in Minimal | checking for a non-colour cue | a real `text-decoration: underline` in every template |
| The reset dialog could be clipped and opened with focus off-screen | a short viewport plus a destructive first stop | portalled to `<body>`, the shell made `inert`, and focus starts on the dialog rather than on "Delete and reset" |
| **Wide section-heading tracking split every heading in the PDF's text layer** — the export spelled `E D U C AT I O N` | adding the One Page overflow check to Editorial and Executive, which reported "missing: Education" while the page was visibly correct | tracking is capped at 0.095em, with a `resume.css` note explaining the ceiling. See the long note below |
| A hardcoded template list in the harness and the design QA | adding a fifth template and noticing the coverage was a list to be remembered, not a contract | both scripts read `#template-select` at run time, so a new template is covered the day it ships |
| `parseStoredPrefs` treated any non-`true` value as "autosave off" | writing the test and reading the assertions instead of the intent | only a real boolean disables it; missing, string and numeric values all fall back to on |
| A full-serif Editorial body produced a 137-character measure | the design QA's measure assertion — the one place a template can be *too* wide rather than too narrow | the serif is display-only via a new `--rm-font-display` token; the body stays in the sans at ~112 characters |
| Executive opened on a two-page preview | the harness counting PDF pages for each template | 1.55 leading and 13 px entry margins pulled back to 1.5 and 11 px, so the example resume fits with ~3 px to spare |
| The "re-enable autosave writes again" check could not fail | reading the assertion | at that point the in-memory resume already *is* the stored snapshot, so the write is byte-identical. It now makes a new edit first, which is what actually distinguishes "persistence resumed" from "nothing changed" |

#### The letter-spacing bug, in full

This is the most consequential defect the process found, and it is recorded at
length because the reason it survived for so long is the reason it was likely to
survive review.

**What it was.** `--rm-h2-tracking` was 0.115em on Modern and was drafted at
0.16em (Editorial) and 0.2em (Executive). Chromium emits each glyph of a
wide-tracked run as its own positioned text run, and past roughly 0.1em a text
extractor reads the gaps between the letters as word breaks. The exported PDF's
text layer therefore spelled `E D U C AT I O N`, `S U M M A R Y`,
`S E L E C T E D  I M PA C T`. The **page looked perfect**. Every visual check
passed, the A4 check passed, the page count was right, and the document was
beautiful.

**Why it matters.** The text layer is not decoration. It is what an ATS parser
reads, what a search for "Education" matches, what copy/paste yields, and what a
screen reader announces when someone opens the PDF. All four were quietly broken,
and so was the PRD's ATS-friendliness requirement, which nothing was measuring.

**Why it survived.** Three pre-existing checks *would* have caught it — "no
content is dropped from the PDF", "One Page PDF keeps every section", "no section
is dropped across pages" — and a forced-failure run confirmed all three go red
when the tracking is raised. But those checks only ever ran against **Classic**
(0.095em) and **Minimal** (no tracking). The templates with wide tracking were
never text-checked, so the one defect that the checks could have found was
present only in the places the checks did not look. That is not bad luck; it is
the shape of coverage gaps, and it is why the new check runs in the **Templates**
group, which covers every shipped template by construction.

**The fix, and the new check.** Tracking is capped at 0.095em, with a
`resume.css` comment at the token stating the ceiling, the measured threshold
(clean at 0.095em, split at 0.115em, against the real export), and the fact that
Modern shipped above it. The check compares each heading from the DOM against
the extracted PDF text with whitespace collapsed and both sides upper-cased —
so `E D U C AT I O N` stays unequal to `EDUCATION` after collapsing, and a
sentence-case template (Minimal) is not reported as broken by a case mismatch.
All five templates now export `0` split headings, verified directly on
`verification/template-*.pdf`.

Two measurement traps are worth recording, because both produced confident wrong
conclusions. A synthetic probe of tracking values in isolation reported every
value as clean, while the real export split at 0.115em — the probe's PDF had no
usable embedded-font metadata, so the extractor fell back to a different
heuristic. And the first version of the new check upper-cased the heading but
not the extracted text, which reported *all five* templates as broken; the
sentence-case template is what exposed it. Measuring against the real artifact
is the only version of this check that means anything.

---

## 8. Known limitations

1. **Chromium's print dialog adds headers and footers by default.** "Headers
   and footers" is **on** in a fresh Chromium profile and no web API can turn it
   off — `window.print()` takes no options. The headers are drawn into the page
   *margin*, so they cost no content height, and three checks drive
   `Page.printToPDF` with `displayHeaderFooter: true` to prove it: the one-page
   resume is still one page, the 8-page fixture is still 8, and the page is
   still A4. What the user
   does get is a date and a URL on the paper until they untick one box. That is
   the largest gap between what the code promises and what the exported file
   looks like, and it is a browser default rather than a defect here.
   Documented in `src/lib/print.ts`.
2. **The harness needs poppler and Chromium.** They are not npm dependencies, so
   `npm run verify:e2e` will not work on a machine without them. `npm run
   verify` (typecheck, lint, unit tests, build) has no such requirement.
3. **Fonts are the system stack.** Rendering therefore depends on the fonts
   installed on the machine that generates the PDF. The layout is metric-driven
   rather than pixel-locked, and the One Page engine re-measures the real DOM,
   so a different font changes the number of pages — it never silently crops
   content. The smallest type any template ships is Minimal's 9 px metadata; the
   One Page readability floor is 9.5 px, so a long document on Minimal compacts
   until its body reaches that floor and then warns rather than going smaller.
   Editorial adds a serif display stack (Charter → Iowan Old Style → Georgia →
   Liberation Serif → Times → DejaVu Serif); on a box with none of those it
   falls back to the local default serif and its masthead looks different,
   though the body — which is what carries the measure — is unaffected because it
   stays in the sans. The measure of ~112 characters was measured against the
   fonts on this machine; a wider display serif changes the masthead, not the
   column.
4. **The One Page safety margin is 4 px.** The browser paginates the printed
   page independently of our measurement. The engine accepts a fit that leaves
   4 px, and falls through to the next density level (or the overflow warning)
   when it does not, so the failure mode is "warns a little early", never
   "clips a line".
5. **On-screen pagination is a model, not the print engine.** The page badge
   simulates pagination over the document's unbreakable blocks, including
   `break-inside: avoid` on entries and `break-after: avoid` on headings. It
   agrees with the printed page count on the two fixtures where the comparison
   is made — the 1-page default and the 8-page one that plain division got wrong
   — but the authority is always the printed output, and a document with a
   pathological shape (one block taller than a page) can still disagree by a
   page. Intermediate page counts are not compared, so a bug that only appears at
   3 or 5 pages would not be caught.
6. **A4 geometry is written down three times.** The screen sheet's
   `210mm × 297mm` and `padding: 12mm 15mm` mirror
   `@page { size: A4 portrait; margin: 12mm 15mm }` because a static export
   cannot compute one from the other — and both are written out again, as
   numbers, in the top of `scripts/verify-print.mjs`. The harness compares the
   *DOM* against its own copy; nothing reads the CSS custom properties back out
   of the stylesheet, so a change to `resume.css` that the harness copy does not
   track would show up as a failing check rather than a wrong one. The
   duplication is real.
7. **The on-screen page rules are indicative.** The hairline rules drawn across
   the sheet show where the printer *will* break, not a guarantee. They come
   from the same block simulation as the badge, and the print stylesheet removes
   them entirely.
8. **`-webkit-font-smoothing: antialiased` is applied on screen only.** It is
   declared inside `@media screen` so the printed PDF is not affected. The
   consequence is that on-screen text is a hair lighter than the same text in
   the PDF — a deliberate trade for legibility at the small end of the type
   scale.
9. **`.resume-section` is `break-inside: auto`.** PRD §19 offers `break-inside:
   avoid` on a section as an *example*, and taking it would waste up to two
   thirds of a page per break on a document with large sections. Headings and
   entries get the avoidance instead, which is what actually prevents a stranded
   section title.
10. **The example resume does not fill a page on Minimal** (79 %). Minimal is
    defined by density, and the shipped example is not dense enough to need it.
    A user who wants the page full with Minimal is expected to write more. At
    the other end, **Executive fits with only ~3 px of headroom** (1025 px
    against a 1027.81 px printable height), so its page-fill figure is
    effectively 100 % and any longer content spills to a second page. That is
    Normal mode working as specified, but it is a thin margin: the number is a
    measurement of *this* example on *this* font stack, not a guarantee, and it
    was chosen over 1.55 leading for exactly the reason in §3.7.
11. **Section-heading tracking is capped at 0.095em and cannot be raised
    without breaking the PDF's text layer.** This is a real design constraint,
    not a bug, and it is recorded as a limitation because it constrains future
    templates: the "wide-tracked small-caps kicker" look that motivates the
    magazine register is simply unavailable here, because above ~0.1em the
    exported headings stop being words. The check in §3.7 and the note in
    `resume.css` are the guards; the cost is that Editorial and Executive
    establish their character through type scale, rules and colour rather than
    through tracking.
12. **No automated visual regression.** The design QA asserts measurable
    properties (contrast, size, hierarchy, rhythm, measure). It cannot tell you
    that the result looks good — that still needs a human, or a screenshot
    review. The harness rasterises the print output to PNGs named
    `verification/*-print-*.png` for exactly that review. Note that the letter-
    spacing bug in §7 was *not* a visual regression and would never have been
    caught by one: it was only ever visible in the exported text.
13. **Tailwind's `print:` variants are unused.** The print rulesheet is ~200
    lines of hand-written CSS in `globals.css`, because the reset has to
    un-scope dozens of `display: block` declarations and fight specificity on
    the editor pane. Adding `print:` classes to a dozen components would have
    produced a weaker and less auditable result.
14. **The static export is what is verified.** `next dev` is not the target of
    any run recorded here, because it is unreliable in this constrained
    environment (1 vCPU, ~1.9 GB RAM) and it is a different artifact: the dev
    server injects HMR clients, unbundled module loads and React's development
    warnings. The build under test is the same static export `npm start`
    serves, and `verify-print.mjs` defaults to a dev-server URL only as a
    convenience — every number in this document was measured against the export
    on port 4173.
