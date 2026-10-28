# LifeBuddy Agent Guide

LifeBuddy is a production-minded personal study workspace for high-school and university students.

Product goal: "Less chaos. More overview. Better study habits."

LifeBuddy is not just a todo app, chatbot, dashboard, or grade tracker. It is one coherent workspace where students manage school, planning, grades, studying, focus, friends, and personal growth.

## Working Rule

Whenever Codex can perform an action itself, it should do so instead of asking the user to perform it.

If Codex can inspect files, run commands, start the application, inspect routes, test APIs, inspect the browser, test responsive layouts, identify UI problems, fix errors, or verify changes, Codex should do that directly.

## Current Priorities

1. Make the application feel professionally designed.
2. Remove generic AI-template and vibecoded visual patterns.
3. Make grades a serious table-based school experience.
4. Make Study Space stable, focused, and polished.
5. Integrate AI Buddy as a subtle persistent companion.
6. Make the dashboard calmer and more useful.
7. Keep the app easy to run locally.
8. Keep GitHub clean and maintainable.
9. Prepare for deployment only after the core product quality is strong.

Do not build speculative future features at the expense of current product quality.

## Product Roadmap

### Phase 0 - Foundation

- Stable codebase, no broken routes, no runtime errors.
- Clean GitHub repository with `.env.example`, `.gitignore`, and database folder setup.
- Ollama local AI support instead of Groq.
- Easy startup: `npm install`, then `npm start`.
- JWT secret and CORS basics.
- No committed secrets.
- Production-minded architecture.
- Remove obvious vibecode visual patterns.

### Phase 1 - Core Dashboard

The dashboard should answer:

- What do I need to do?
- How am I doing?
- What should I focus on now?

It brings together tasks, grades, Study Space, focus, friends, useful daily information, and AI Buddy.

### Phase 2 - Grades / School

Grades are core structured data. Support CSV imports, `.stgrades` imports, periods, subject averages, final grades, weighting, and unlimited subjects.

The grade experience should feel as trustworthy as Magister or Somtoday while keeping LifeBuddy's own identity. Use proper tables when showing many grades.

### Phase 3 - Study Space

Users can create word lists, import words, practice selected terms, track progress, and repeat difficult words.

Practice methods: test, multiple choice, flashcards, spelling, hints, and mixed mode.

### Phase 4 - Tasks & Planning

Tasks should support create/edit/delete, completion, deadlines, priorities, subjects, study planning, AI-assisted planning, and future calendar views.

### Phase 5 - AI Buddy

AI Buddy is a product companion, not the product itself.

Default interaction: small persistent Buddy -> click -> chat opens.

It uses Ollama locally, supports longer answers, scrolls to newest messages, and helps with planning, explanations, motivation, summarizing, and study advice.

### Phase 6 - Focus / Music

Support local MP3 imports, playlists, audio player, focus timer, future Pomodoro, and focus statistics.

### Phase 7 - Friends / Social

Keep the social layer lightweight: add friends, friend list, friend profiles, and friend dashboards. Future ideas include study together, challenges, learning status, and shared word lists.

### Phase 8 - Mature Gamification

Use streaks, milestones, progress, badges, and learning statistics. Avoid excessive XP, arcade UI, childish animations, and constant celebratory effects.

### Phase 9 - Premium

Later only: Pro subscription, advanced AI, storage, analytics, financial module, themes, Stripe, and school groups. Do not over-engineer premium now.

### Phase 10 - Deployment

Prepare clean GitHub, backend deployment, production database, environment variables, custom domain, and production security.

### Phase 11 - Mobile / PWA

After the web app is strong: PWA, installable mobile experience, mobile-first dashboard, push notifications, and maybe React Native later.

## Architecture

LifeBuddy is currently a Node.js / Express app with a SQLite database and static frontend pages in `public/`.

Main files:

- `server.js`: Express app, database setup, migrations, auth middleware, API routes, static page routes.
- `public/dashboard.html`: main authenticated dashboard.
- `public/script.js`: dashboard behavior, progress/milestone client logic, shared UI behavior.
- `public/styles.css`: global LifeBuddy styling and page-specific CSS.
- `public/i18n.js`: Dutch/English translations.
- `public/studieruimte.html`: Study Space page.
- `public/studieruimte.js`: Study Space UI and practice flow.
- `public/music.html`: local MP3 focus player.
- `public/index.html`: landing/auth page.
- `tests/grade-entry-regression.js`: grade migration/import regression test.

## Important Routes

Pages:

- `GET /`
- `GET /dashboard`
- `GET /music`
- `GET /studieruimte`
- `GET /health`

Auth and user:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/user/profile`
- `PUT /api/user/profile`

Tasks:

- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Grades / subjects:

- `GET /api/subjects`
- `POST /api/subjects`
- `POST /api/subjects/import`
- `DELETE /api/grade-entries/:id` (one grade; recalculates the cached subject average)
- `DELETE /api/subjects/:id`
- `DELETE /api/subjects`

Study Space:

- `GET /api/word-lists`
- `POST /api/word-lists`
- `GET /api/word-lists/:id`
- `PUT /api/word-lists/:id`
- `DELETE /api/word-lists/:id`
- `POST /api/word-lists/:id/entries`
- `PUT /api/word-lists/:id/entries/:entryId`
- `DELETE /api/word-lists/:id/entries/:entryId`
- `POST /api/word-lists/import`
- `POST /api/word-lists/:id/practice/start` (picks words by priority: new and wrongly answered words first, well-known words last). `selection.count` may be `"auto"` (default): up to 20 words everything is asked, above 20 half of the words (rounded up), `"all"`, or a number
- `POST /api/word-lists/:id/practice/submit`
- `GET /api/word-lists/:id/progress`

Friends:

- `GET /api/friends`
- `POST /api/friends/requests`
- `PATCH /api/friends/requests/:id`
- `GET /api/friends/:friendId/profile`

AI:

- `POST /api/chat/stream` (streaming NDJSON: `delta`, `done`, `error`; used by the Buddy widget)
- `POST /api/chat` (non-streaming; errors are not stored as messages)
- `GET /api/chat/history`
- `GET /api/test-ai`

Stats:

- `GET /api/stats`

## Database Structure

Core tables include:

- `users`: account, profile, plan, streak, timestamps.
- `tasks`: user tasks, descriptions, due dates, status.
- `subjects`: subject names and cached average grade.
- `grade_entries`: detailed grades by subject, period, label, weight, optional `date` (YYYY-MM-DD), and average inclusion.
- `chat_history`: AI conversation history.
- `word_lists`: Study Space lists.
- `word_entries`: terms and definitions.
- `practice_sessions`: Study Space session metadata.
- `practice_session_entries`: per-session word attempts.
- `word_progress`: long-term progress per word.
- `friend_requests`: friend relationships and request status.

Keep migrations safe for existing local databases. Do not drop user data without an explicit, recoverable migration path.

## Environment Variables

Expected variables:

- `PORT`: local server port, default `3000`.
- `JWT_SECRET`: long secret for signing JWTs. Required in production.
- `DATABASE_PATH`: SQLite database path, default `./database/lifebuddy.db`.
- `OLLAMA_BASE_URL`: local Ollama URL, default `http://localhost:11434`.
- `OLLAMA_MODEL`: Ollama model name, default should stay local and lightweight.
- `HUGGINGFACE_TOKEN`: optional fallback only if the code path still supports it.

Never commit real secrets.

## Development Commands

- `npm install`
- `npm start`
- `npm run dev`
- `npm run test:gradebook`
- `npm run test:study`
- `npm run test:chat`
- `node --check server.js`
- `node --check public/script.js`
- `node --check public/i18n.js`

When changing frontend behavior, verify rendered pages in a browser. Code that compiles can still look broken.

## Coding Conventions

- Prefer existing Express and SQLite helper patterns.
- Use `authenticateToken` for private API routes.
- Keep API responses structured and predictable.
- Preserve user data during migrations.
- Avoid duplicate route implementations across `server.js` and `routes/` unless the app is deliberately refactored.
- Do not add large abstractions unless they remove real complexity.
- Keep client-side JS readable and page-scoped when possible.
- Avoid `alert()` for polished flows; prefer inline error, toast, or empty-state patterns.
- Do not use console logs for routine production behavior.

## Design Rules

Follow `DESIGN.md` as the visual source of truth.

LifeBuddy should feel calm, modern, focused, trustworthy, friendly, intelligent, polished, and slightly playful without becoming childish.

Avoid:

- Generic AI SaaS layouts.
- Developer dashboard aesthetics.
- Admin-panel density without care.
- Excessive purple/blue gradients.
- Random blobs and orbs.
- Excessive glassmorphism.
- Childish gamification.
- Endless unrelated card grids.
- Big fake statistics.

## Component Conventions

- Use tables for dense structured data, especially grades.
- Use cards for repeated items, summaries, and contained tools; do not nest cards inside cards.
- Buttons should have clear actions and proper disabled/focus states.
- Forms need labels, validation, loading, and error states.
- Empty states should explain what is missing and provide the next action.
- AI Buddy should stay accessible but visually quiet.

## Accessibility Rules

- Maintain readable contrast.
- Use semantic HTML for tables, forms, nav, and dialogs.
- Keep visible focus states.
- Ensure keyboard users can navigate modals and critical workflows.
- Inputs need labels or clear accessible names.
- Buttons must describe their action.
- Avoid text that only works visually.

## Responsive Rules

Desktop should use a full sidebar and efficient content layout.

Tablet should adapt navigation and density without horizontal overflow.

Mobile should use touch-friendly controls, simplified layouts, and no hidden critical actions. Important screens must be checked on mobile widths.

## Testing And Verification

Before finishing meaningful changes:

- Run relevant syntax checks.
- Run `npm run test:gradebook` when touching grades or migrations, `npm run test:study` when touching Study Space practice logic, and `npm run test:chat` when touching the Buddy/Ollama code.
- Start the application when UI changes are made.
- Open relevant pages in a browser.
- Check desktop and mobile responsive behavior.
- Check for console/runtime errors where possible.
- Fix what verification reveals.

## Git Conventions

- Preserve user changes.
- Never use destructive git commands unless explicitly requested.
- Keep commits focused when committing is requested.
- Do not commit database files, secrets, `node_modules`, or generated temporary artifacts.

## AI Buddy files

- `public/buddy.js` and `public/buddy.css`: the one shared widget, included by dashboard, studieruimte and music. It injects its own markup. Pages can listen for the `buddy:reply-complete` event on `document`.
- Ollama settings: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_MAX_TOKENS` (default 1000), `OLLAMA_STREAM_IDLE_MS` (silence timeout, default 60000).

## Subjects, tasks and design lab

- `subjects.color` (0-5) is assigned on creation and backfilled at startup; `tasks.subject_id` optionally links a task to one of the user's own subjects (`POST/PUT /api/tasks` accept `subject_id`; a subject of another user is ignored).
- `npm run test:tasks` covers subject colours and task subjects.
- `public/design-lab/` is an internal design exploration page (4 variants, demo data). It is not linked from the app and can be deleted.
- Dashboard styling lives in `public/workspace.css` (chrome, overview, tasks, gradebook) on top of the tokens in `public/styles.css`.

## Tests (toetsen) and periods

- Tables `periods` (name, start_date, end_date; names unique and ranges never overlap per user) and `tests` (subject_id, title, test_date). A test's period is derived from its date at read time and is never stored.
- API: `GET/POST /api/periods`, `PUT/DELETE /api/periods/:id`, `GET/POST /api/tests`, `PUT/DELETE /api/tests/:id`. Tests require one of the user's own subjects, a title and a valid date; duplicates (same subject, title and date) are rejected.
- `tasks.test_id` optionally links a preparation task to a test. Tasks never become tests by themselves. Deleting a test unlinks its tasks; deleting a subject removes its tests and unlinks its tasks.
- UI: sidebar page "Toetsen" (manage tests and periods), the period line and "Toetsen" section on the Overview, and an optional test selector in the task form.
- `npm run test:exams` covers validation, overlap, derived period, privacy and cascades.

## Music

- `public/music.html` owns the audio element and stores MP3 files in IndexedDB per account (nothing is uploaded). The player card can be detached: `documentPictureInPicture` when available, otherwise a floating in-page player (position and size saved in `localStorage`). Audio only plays while the music tab stays open.
- Prefs (volume, shuffle, repeat) live in `localStorage` key `lifebuddy-music-prefs`.
