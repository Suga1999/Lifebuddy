# LifeBuddy Design System

LifeBuddy is a premium student productivity workspace. The visual identity should feel calm, structured, focused, and trustworthy, with a small amount of warmth.

This document is the visual source of truth for Dashboard, Grades, Study Space, Tasks, AI Buddy, Focus, Friends, and Settings.

## Product Feel

LifeBuddy should feel like professional productivity software plus a modern education platform plus a friendly personal companion.

It should not feel like a generic SaaS template, admin panel, arcade app, or AI landing page.

## Typography

Primary font:

- `Inter`, then system UI fallbacks.

Type scale:

- Page title: 34-44px desktop, 28-34px mobile, weight 760-820, line-height 1.04.
- Section heading: 20-26px, weight 720-780, line-height 1.15.
- Card title: 15-18px, weight 700, line-height 1.25.
- Body: 14-16px, weight 400-520, line-height 1.55.
- Table text: 12-14px, weight 500-650, line-height 1.35.
- Labels and captions: 11-12px, weight 650-760, line-height 1.35.

Rules:

- Letter spacing is `0` by default.
- Uppercase labels may use `0.08em` letter spacing.
- Do not use huge headings inside compact dashboard panels.
- Keep data labels concise and scannable.

## Color System

Base:

- App background: `#0b0d12`
- Sidebar background: `#11141b`
- Main surface: `#151922`
- Raised surface: `#1a1f2a`
- Subtle surface: `#10131a`

Text:

- Primary: `#f4f2ee`
- Secondary: `#b4bac8`
- Muted: `#747c8f`
- Disabled: `#525a69`

Borders:

- Default: `#272d3a`
- Strong: `#394152`
- Focus: `#8ea4ff`

Accent colors:

- Primary action: `#6f7dfb`
- Primary hover: `#818cff`
- Study green: `#4fb477`
- Grade blue: `#4f8fd8`
- Warning amber: `#d6a23f`
- Error red: `#d86a61`
- Buddy purple: `#8f75e6`

Rules:

- Purple is an accent, not the whole product.
- Avoid dominant purple/blue gradient screens.
- Use color to clarify status and action, not decoration.

## Design Tokens (CSS)

The colours below exist as CSS variables at the end of `public/styles.css`. New and refactored components must use them instead of raw hex values:

`--ds-bg`, `--ds-sidebar`, `--ds-surface`, `--ds-raised`, `--ds-subtle`, `--ds-text`, `--ds-text-2`, `--ds-muted`, `--ds-disabled`, `--ds-border`, `--ds-border-strong`, `--ds-focus`, `--ds-primary`, `--ds-primary-hover`, `--ds-buddy`, `--ds-green`, `--ds-blue`, `--ds-amber`, `--ds-red`, `--ds-red-text`, `--ds-amber-text`, `--ds-radius-sm` (8px), `--ds-radius-md` (12px), `--ds-radius-lg` (14px).

Already on tokens: Gradebook, Study Space refinements, AI Buddy. Still on the older purple tokens (`--primary`, `--surface`...): Dashboard overview, sidebar, tasks, friends, focus/music, login. Migrating those to `--ds-*` is part of the "professional UI" priority and should happen page by page, never as one big rewrite.

## Spacing

Use an 8px base scale:

- 4px: tight icon/text gaps.
- 8px: compact control gaps.
- 12px: form/control spacing.
- 16px: card internal spacing.
- 24px: panel spacing.
- 32px: page section spacing.
- 48px: large page separation.

Page padding:

- Desktop: 32-40px.
- Tablet: 24px.
- Mobile: 16px.

## Layout

Desktop dashboard:

- Sidebar: 248-280px.
- Main content: flexible center region.
- Optional right rail: 260-320px for friends/context only when screen width allows.

Content width:

- Dashboard content should use available width efficiently.
- Marketing or auth content should be constrained to readable widths.
- Grade tables may scroll horizontally inside their own table region when necessary.

Breakpoints:

- Mobile: under 760px.
- Tablet: 760-1100px.
- Wide desktop: 1320px and up.

Rules:

- No horizontal page overflow.
- Dense data belongs in tables, not oversized cards.
- Avoid cards inside cards.
- Sections should not look like disconnected floating islands.

## Radius, Shadows, And Surfaces

Radius:

- Buttons and inputs: 8-10px.
- Cards and panels: 10-14px.
- Tables: 10-12px outer container.
- Avatars: circles or 10-12px rounded squares depending on context.

Shadows:

- Use sparingly.
- Default product surfaces should rely on border, contrast, and spacing.
- Avoid glow-heavy shadows.

Glassmorphism:

- Use only when it improves legibility or layering.
- Do not make the whole UI glassy.

## Buttons

Primary:

- Solid `#6f7dfb`, white text.
- Hover: slightly brighter.
- Disabled: lower opacity and no hover lift.

Secondary:

- Dark surface with clear border.

Danger:

- Red border/background only for destructive actions.

Rules:

- Buttons need icons when they trigger tool-like actions.
- Button text must fit on mobile.
- Loading buttons should show disabled state and short loading copy.

## Forms

Inputs:

- Height 40-44px desktop, at least 44px touch target on mobile.
- Background `#10131a` or `#151922`.
- Border `#2b3241`.
- Focus border `#8ea4ff`.

Validation:

- Inline errors below the field.
- Never rely only on `alert()`.

File inputs:

- Use a clear drop/select area.
- Show selected filename and import result.

## Tables

Tables are required for grades and useful for word entries.

Table rules:

- Sticky subject column for grade matrices when feasible.
- Compact rows, strong headers, readable borders.
- Numeric grades right-aligned or centered.
- Period headers visually grouped.
- Averages and final grades emphasized but not decorative.
- Failing grades use restrained red emphasis.
- Empty cells remain quiet.

Grade table priorities:

- Fast scanning.
- Trustworthy calculations.
- Period grouping.
- Clear averages.
- No giant grade cards for dense gradebook views.

## Dashboard

Dashboard must answer:

- What do I need to do?
- How am I doing?
- What should I focus on now?

Use:

- Today's or upcoming tasks.
- Useful grade summary.
- Study progress.
- Focus state.
- Lightweight friends context.
- Subtle AI Buddy access.

Avoid:

- Fake analytics.
- Meaningless stats.
- Loud XP UI.
- Decorative cards that do not help decisions.

## Grades

Grades should feel like serious school data.

Use:

- Table-first layout.
- Period tabs or grouped headers.
- Average by subject.
- Final grade column.
- Weight display where useful.
- Import feedback and clear error states.

Avoid:

- Random individual cards for every grade.
- Hidden averages.
- Decorative visual noise around numbers.

## Study Space

Study Space should communicate: "Now I am studying."

Use:

- Focused list management.
- Clear import modal.
- Minimal practice screens.
- Visible progress without clutter.
- Calm feedback for correct/wrong answers.

Practice screens should remove distractions and keep the answer flow fast.

## Tasks

Tasks should prioritize scanning and action.

Use:

- Deadline, priority, subject, and completion state.
- Clear empty state.
- Fast add form.
- Inline edit later when useful.

## AI Buddy

AI Buddy is a small persistent companion. It lives in one shared script (`public/buddy.js`) and stylesheet (`public/buddy.css`) that every page loads; never copy its markup into a page.

Default:

- Small flat launcher (56x52) bottom right. No glow, no gradient, no speech bubble.
- Click opens a chat panel (400px wide, radius 14px) above the launcher. On screens up to 640px it becomes a bottom sheet and the launcher steps aside.
- The panel stays open while moving between pages (sessionStorage) and closes with Esc or the close button; focus returns to the launcher.
- Can be personalised (name, colour, accessory) or hidden. Preferences live in localStorage per user.

Chat behaviour:

- Answers stream in word by word (`POST /api/chat/stream`). Long answers are fine; there is no total time limit, only a silence timeout.
- Assistant text supports a small safe markdown subset: bold, inline code, bullet and numbered lists, headings.
- The send button becomes Stop while answering. A stopped answer keeps the text shown plus a "Gestopt" note.
- The log scrolls to the newest message. If the student scrolls up, it stops following and shows "Naar laatste bericht".
- Errors (Ollama unreachable, too slow) are shown inline with "Opnieuw proberen". They are never stored as conversation messages.
- Empty state: one short sentence and three suggestion chips.
- Enter sends, Shift+Enter adds a line.

Rules:

- Do not make Buddy the visual center.
- It should not block important actions.
- It should feel friendly without becoming childish.
- Message colours: student = primary (`--ds-primary`), Buddy = raised surface (`--ds-raised`) with a border.
- Accessibility: the log is `role="log"` with polite live updates, the panel is a non-modal dialog, every control has a visible focus ring and a 44px touch target.

## Focus / Music

Focus should be quiet.

Use:

- Local MP3 library.
- Playlist list.
- Current track.
- Minimal controls.
- Future timer surface.

Avoid visual noise during focus mode.

## Friends

Friends should be lightweight and social.

Use:

- Right rail on wide screens.
- Compact friend rows.
- Profile modal with shared progress only.
- Clear privacy copy.

Never expose private tasks or chat messages in friend profiles.

## Empty, Loading, And Error States

Every main area needs:

- Empty state: what is missing and next action.
- Loading state: calm skeleton or short text.
- Error state: specific problem and retry path.

Avoid generic "Something went wrong" unless no detail exists.

## Motion

Motion should be restrained:

- 120-180ms for hover and panel transitions.
- 180-240ms for modals.
- No constant looping decorative animation.
- No large celebratory effects for routine actions.

## Accessibility

- Body text must be readable on dark surfaces.
- Controls must have visible focus states.
- Dialogs must use `role="dialog"` and proper labels.
- Tables should use real `table`, `thead`, `tbody`, `th`, and `td`.
- Icon-only buttons need accessible labels.
- Touch targets should be at least 44px on mobile where practical.

## Responsive Behavior

Desktop:

- Full sidebar.
- Optional right rail.
- Dense table/data layouts.

Tablet:

- Collapse non-essential side regions.
- Keep main workflows visible.

Mobile:

- Navigation becomes compact.
- Tables can scroll inside a controlled region.
- Primary actions remain reachable.
- No horizontal body overflow.
- Buddy moves out of the way of important controls.

## Quality Bar

Before shipping visual work, verify:

- Does it feel like one product?
- Is the important action obvious?
- Does it remain calm with lots of data?
- Are grades easy to scan?
- Is Study Space focused?
- Is AI Buddy integrated naturally?
- Does mobile feel intentionally designed?
- Are empty/loading/error states polished?

Optimize for a product that feels well designed after 30 minutes of use, not for a single wow screenshot.

## LifeBuddy Design Language (locked, implemented in the dashboard)

A calm, warm study desk that organises a school year: structured like a ledger, personal like a notebook, quiet like a library.

Chosen direction (from the design lab, `/design-lab/`): Overview = "Modern Academic", Gradebook = "Quiet Personal Workspace".

- **Rows before cards.** Lists use rows with hairline dividers. A surface exists only for forms, popovers and the Buddy panel.
- **Subjects are the colour language.** Every subject has a fixed colour (`subjects.color`, 0-5 -> `--subject-1..6`) shown as a thin vertical spine on tasks, grades, the sidebar and the overview. Red and amber only mean deadlines and failing grades. One restrained accent (`--ds-primary`) for the primary action; Buddy keeps `--ds-buddy`.
- **Warm graphite neutrals.** Tokens at the end of `public/styles.css` (`--ds-*`). Sentence case everywhere; uppercase only for table column headers.
- **Numbers are typography.** Grades are tabular figures with a decimal comma; averages are inline text, never tiles.
- **Sidebar is chrome.** Full-height, dimmer than the content, one divider, subjects listed with their average.
- **Overview.** Greeting plus one sentence of context, today and later as rows, subjects with trend in the right rail, then progress and friends.
- **Gradebook.** Quiet header with one sentence, period tabs with counts, a dense subject table (expandable per subject), and a "Laatste cijfers" log below.
- **Buddy.** Small corner mark, compact panel, voice in margin notes (see `public/design-lab/` for the margin-note pattern).
- **Period line:** a thin line with the current period (week x of y), a marker for today and a dot per test in the subject colour. It is only drawn from stored periods and tests; without them a quiet text line invites the student to set a period.
- **Not yet built:** mastery signals on the overview, light theme.
- Study Space is migrated (`public/study.css`): word lists are rows, summaries are inline figures, dialogs are flat. Pages still on the older purple styling: Focus, Mijlpalen, login (to be migrated page by page).

## Music player

The music page (`public/music.html`, `public/music.css`) uses the standard LifeBuddy design language: warm graphite surfaces, hairline rows for the playlist, one accent, sentence case. The player card is self-contained and adapts to its frame with container queries, so the same markup works docked in the page, as a floating player (drag, resize, keyboard) and in a detached Picture-in-Picture window (Chrome/Edge).
