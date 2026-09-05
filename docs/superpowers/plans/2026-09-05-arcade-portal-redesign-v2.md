# Arcade Portal Visual Redesign v2 Implementation Plan

> **For agentic workers:** Execute inline in this session with the existing workspace and verify every visual claim before publishing.

**Goal:** Replace the rejected SIGNAL CONTROL dashboard with a polished, cinematic neon arcade entrance that makes one game portal the visual focus while keeping all 29 game links and filtering behavior.

**Architecture:** Keep `games.json` as the only catalog source and keep Python generation deterministic. Replace the dense HUD composition with a restrained editorial shell: simple brand header, split hero, CSS/SVG-like portal artwork, one featured game action, and a quiet catalog below. Keep the canvas as ambient depth only; use CSS layers and pointer motion for the signature portal.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Canvas 2D, Python 3 generator, static GitHub Pages.

## Global Constraints

- Modify only `/arcade.html` and its generator/tests; do not overwrite `index.html` or individual games.
- Preserve all game URLs, 29 catalog entries, filters, keyboard focus, reduced-motion support, and native anchor navigation.
- Do not use external fonts, images, JavaScript libraries, or fabricated telemetry.
- The first viewport must have a strong visual subject and a visible primary action on 390px mobile.
- Visual structure tests are regression guards, not proof of aesthetic quality; verify with screenshots and runtime checks.

### Task 1: Establish the rejected-design regression

**Files:**
- Modify: `arcade.visual.test.py`

- [ ] Add assertions for the new composition: `portal-stage`, `portal`, `hero-copy`, `feature-strip`, `catalog-grid`, a single primary entry action, no `telemetry`/`system-box` dashboard clutter, responsive portal sizing, animation frame, pointer response, 29 catalog cards, and 33 native `.cab` links.
- [ ] Run `python3 arcade.visual.test.py` and confirm it fails because the current SIGNAL CONTROL HTML has no `portal-stage`.

### Task 2: Rebuild the generated page

**Files:**
- Modify: `build_arcade_blacktech.py`
- Generate: `arcade.html`

- [ ] Keep data loading, category mapping, escaping, and URL generation from `games.json`.
- [ ] Implement a focused hero with the Chinese headline `今晚，打开一扇新的游戏门`, one featured game, a portal art stage, and an explicit `进入霓虹幸存者` CTA.
- [ ] Use restrained dark plum/ink/cyan/magenta tokens; remove the old telemetry boxes and dense control-room language.
- [ ] Make the portal the only large decorative signature: layered glow, glass aperture, floating game tiles, subtle orbit animation, and pointer parallax.
- [ ] Keep catalog cards readable and useful, with filters and native `<a>` links.

### Task 3: Verify and visually inspect

**Files:**
- `arcade.html`
- `arcade.visual.test.py`

- [ ] Run generator, visual test, Python compilation, and `git diff --check`.
- [ ] Open local HTML at 390px and 1440px, inspect screenshots, and correct spacing/overflow/visual hierarchy if needed.
- [ ] Runtime-test canvas initialization, pointer motion, primary link, 29 cards, category filtering, and no horizontal overflow.

### Task 4: Publish only after acceptance

- [ ] Fetch `origin/main` and confirm no concurrent changes before committing.
- [ ] Commit only the arcade generator, generated page, test, and plan.
- [ ] Push, verify GitHub Pages HTTP 200 and remote content markers, then report the exact URL and limitations.
