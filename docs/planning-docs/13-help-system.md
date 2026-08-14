# Help System Specification

Status: **Planned** (not yet implemented)
Related: [UI/UX Specification](07-ui-ux-specification.md), [IPC Contract](08-api-internal-spec.md), [Non-Functional Requirements](04-non-functional-requirements.md)

## 1. Purpose

DiscDock's value depends on concepts that are not self-evident from the UI: the catalog is a *snapshot* of media that may not be connected, hash modes trade speed for duplicate-detection accuracy, verification is a physical-integrity reminder rather than a scan, and audio CDs are cataloged from a TOC instead of a filesystem. The Help system explains each screen in place, so users learn the model without leaving their work or consulting external documentation.

**Goals**

- Give every screen a contextual explanation of its features, plus practical tips.
- Stay visible alongside the UI so users can follow instructions while working.
- Be discoverable, keyboard-accessible, and remember the user's preferred size.

**Non-goals**

- Not a replacement for the planning docs or a full user manual.
- No remote content fetching — help ships with the app and works offline (see [Security & Privacy](10-security-privacy.md)).
- No interactive product tour or coach marks in v1.

## 2. Requirements

### FR-H1 — Help panel

- **FR-H1.1** The Help panel slides out from the right edge of the application window.
- **FR-H1.2** The panel *pushes* content rather than overlaying it: the main content region shrinks by the panel width so nothing is obscured.
- **FR-H1.3** The panel is resizable by dragging its left edge, constrained to **25%–40%** of the current window width.
- **FR-H1.4** Panel width and open/closed state persist across sessions.
- **FR-H1.5** Width is stored as a *percentage*, so the panel scales correctly when the window is resized or the app opens on a different display.
- **FR-H1.6** If a stored width falls outside the allowed range (e.g. after a window-size change), it is clamped on load.

### FR-H2 — Discoverability & controls

- **FR-H2.1** Every page shows a Help icon (`?` / `CircleQuestionMark`) in a consistent position — the page header, right-aligned.
- **FR-H2.2** Clicking the Help icon opens the panel showing that page's topic. If the panel is already open on that topic, the icon closes it (toggle).
- **FR-H2.3** `F1` toggles the panel for the current page; `Escape` closes it when focused inside.
- **FR-H2.4** The panel has a close button and a visible title identifying the current topic.
- **FR-H2.5** Navigating to another page while the panel is open swaps the content to the new page's topic.

### FR-H3 — Content

- **FR-H3.1** Each page has an authored topic covering: what the page is for, each feature/control on it, and tips/insights.
- **FR-H3.2** Topics are structured as: **Overview** → **Features** (one entry per UI element) → **Tips** → **See also** (cross-links to related topics).
- **FR-H3.3** Cross-links navigate within the panel without changing the main view, with a back affordance.
- **FR-H3.4** Content lives in a typed registry in the renderer, keyed by view id, so a missing topic is a build-time error rather than a blank panel.

### FR-H4 — Accessibility

- **FR-H4.1** The panel is a landmark region (`role="complementary"`, labelled by its title).
- **FR-H4.2** Opening moves focus to the panel heading; closing returns focus to the Help icon that opened it.
- **FR-H4.3** The resize handle is keyboard-operable (arrow keys adjust width, Home/End jump to min/max) and exposes `role="separator"` with `aria-valuenow/min/max`.
- **FR-H4.4** Panel content is screen-reader friendly: real headings, lists, and no text conveyed only by color.

## 3. Layout & Behavior

```
┌──────────────────────────────────────────────────────────┐
│ TitleBar                                                 │
├───────┬───────────────────────────────┬──────────────────┤
│       │                               │ ▎Help: Media Lib.│
│ Side  │   Main content (shrinks)      │ ▎                │
│ bar   │                               │ ▎ Overview       │
│       │                               │ ▎ Features       │
│       │                               │ ▎ Tips           │
└───────┴───────────────────────────────┴──────────────────┘
                                        ↑ drag to resize
                                          (25%–40%)
```

- Open/close animates width over ~180ms (`ease-out`), disabled under `prefers-reduced-motion`.
- Below a minimum window width (~900px) the panel overlays instead of pushing, to keep the main content usable.
- The panel never covers the TitleBar and does not affect the Sidebar.

## 4. Technical Design

### Components

| File | Responsibility |
|---|---|
| `src/components/HelpPanel.tsx` | Panel shell: header, close button, resize handle, content host |
| `src/components/HelpButton.tsx` | Reusable page-header Help icon wired to the context |
| `src/help/HelpContext.tsx` | Provider: open state, active topic, width, persistence |
| `src/help/topics/*.tsx` | One authored topic per view |
| `src/help/registry.ts` | `Record<ViewId, HelpTopic>` — typed, exhaustive |

### State & persistence

- `HelpProvider` wraps the app shell in `App.tsx` and owns `{ isOpen, topicId, widthPercent }`.
- Persisted via `AppSettings` (main-process `settings.json`) rather than `localStorage`, so it is covered by backup/restore and consistent with existing preferences:

```ts
interface AppSettings {
  // …existing
  helpPanelOpen: boolean
  helpPanelWidthPercent: number // 25–40, clamped on read
}
```

- Writes are debounced (~250ms) while dragging so a resize does not thrash the settings file.

### Content model

```ts
interface HelpTopic {
  id: ViewId
  title: string
  overview: string
  features: { name: string; description: string }[]
  tips: string[]
  seeAlso?: ViewId[]
}
```

Authored as data (not free-form markup) so presentation stays consistent and the panel can later support search or export without reworking content.

## 5. Topic Inventory

| View | Topic must cover |
|---|---|
| Dashboard | Summary cards and their meaning, Detected Devices table, register/scan/eject actions, verification count |
| Media Library | Adding media, row selection (click / Ctrl / Shift), kebab & context menus, inline location/tag editing, Notes column, container & tag filters, batch actions, verification badge, printing labels |
| Media Detail | Overview fields, cover art, custom fields, Browse tab (file tags/notes, Open / Show in Files, durations), Scan History, Errors |
| Search | Live filtering, FTS vs. substring fallback, media type / kind / file-tag filters, paging |
| Duplicates | How duplicate groups are found, hash-mode dependency, reclaimable space, safe-deletion caveats |
| Collections | Creating collections, adding/removing members, collections vs. tags |
| Backup & Export | Full DB backup/restore, safety backup on restore, CSV/JSON export scopes |
| Settings | Hash modes, exclude patterns, symlinks, concurrency, theme, custom types/fields, verification threshold, notifications, updates |

Cross-cutting concepts (hash modes, verification, audio CDs, device fingerprints) are explained in the topic where they are configured and cross-linked elsewhere via `seeAlso`.

## 6. Acceptance Criteria

1. Every view renders a Help icon that opens the panel to that view's topic.
2. The panel pushes main content — no content is overlaid at window widths ≥900px.
3. Dragging the handle resizes the panel and stops at 25% and 40%.
4. Panel width and open state survive an app restart.
5. `F1` toggles the panel; `Escape` closes it; focus returns to the invoking Help icon.
6. Every view id in the app has a topic; adding a view without a topic fails type-checking.
7. Content is available with networking disabled.

## 7. Implementation Phases

1. **Shell** — panel, push layout, resize handle with clamping, settings persistence.
2. **Wiring** — Help context, `HelpButton` on all page headers, keyboard shortcuts, focus management.
3. **Content** — author all topics in the inventory table.
4. **Polish** — cross-link navigation with back affordance, reduced-motion handling, narrow-window overlay mode.

## 8. Open Questions

- Should the panel support a search box across all topics? (Deferred; the data model above allows it later.)
- Should first launch open the panel automatically on the Dashboard topic? Leaning yes, once, with a "don't show again" affordance.
- Is a "What's New" topic tied to the app version worth including alongside auto-update?
