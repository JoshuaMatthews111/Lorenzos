# One editor: Page Studio + Site Builder merge (Option A)

Joshua, 2026-09-16: "I like the way Page Studio builds ... I would prefer it more uniform across the Site
Builder ... the two being mixed together would be better than them being separate ... I would rather go with A."

**Goal.** One door for every page. Page Studio stays the *home* (the list of every page, its status, Copy,
Send to live, history). The Site Builder is the *only place a page is edited* — 2.0 ad pages, block pages,
trainer bio pages and the main website pages all open in the same canvas with the same left rail (Pages /
Blocks / Theme / Menus), the same right rail (Block / Page) and the same top bar.

## Milestones (each one ships to the sandbox on its own)

1. **Every "Edit" opens the Site Builder.** Page Studio's Edit / Edit full screen and the Page Editor's
   "Website Page" dropdown all open the Site Builder. The old editors stay reachable only from ⋯ More →
   "Open in the classic editor" (already true for 2.0 pages; extend to block pages and trainer pages).
2. **Page Editor becomes a tab inside the Site Builder.** The trainer-page controls Joshua loves (photo
   frame presets, section visibility, the drag-to-move photo handles) move into the Site Builder's right
   rail for `sb.kind === "trainer"`. The Page Editor screen in the portal then links straight there.
3. **Hover = edit, everywhere.** Words, photos, sections and blocks all show the same hover outline and the
   same ✕ / ↑ / ↓ / ⧉ tools (today the 2.0 sections show ↑ ↓ Hide only, blocks show the full set).
4. **Grab-and-drag frames.** The frame sliders shipped 2026-09-16 (move / wider / taller) get on-canvas
   handles: drag the frame to move it, drag its corner to resize — the same feel as the trainer photo
   handles (rule 76 `wireTrainerMediaDrag`). The sliders stay as the exact-number way.
5. **One page list.** The Page Editor's "Website Page" dropdown, the Site Builder's landing-page jump and
   Page Studio's list become one list component (Landing pages / Ad pages / Ad pages 2.0 / Trainer bios /
   Main website pages), used in all three places.
6. **Retire the classic editors** once Arrison and Tim confirm nothing is missing (keep the code one release
   behind a flag, rule 63 style).

## Must not break (DO-NOT-BREAK)
Rules 56 (a live trainer page stays live until Publish), 61, 76 (photo/logo size + move), 77 (no redraw
mid-drag), 85 (2.0 pages), 89 (Site Builder 2.0). Old pixel ad pages keep their own editor until milestone 6.
