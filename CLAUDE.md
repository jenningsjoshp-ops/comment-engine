# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (opens QR code for Expo Go)
npx expo start

# Run on specific platform
npx expo start --ios
npx expo start --android

# Build for production (iOS)
NODE_OPTIONS=--use-system-ca eas build --profile production --platform ios

# Submit to App Store (requires interactive terminal — run with ! prefix in Claude Code)
NODE_OPTIONS=--use-system-ca eas submit --platform ios

# Check latest build status
NODE_OPTIONS=--use-system-ca eas build:list --limit 1
```

> `NODE_OPTIONS=--use-system-ca` is required on this Windows machine for EAS commands to reach Expo's servers — omitting it causes TLS certificate errors.

The `eas-build-pre-install` script (`generate-config.js`) runs automatically before EAS builds to write `config.js` from environment variables (`ANTHROPIC_API_KEY`, `APIFY_API_TOKEN`). For local dev, `config.js` has keys hardcoded directly — do not overwrite it with the generator script manually.

## Architecture

**Entry point:** `index.js` → `App.js`

**App.js** is the single source of truth for all global state. It owns:
- User session (`userId`, `userProfile`, `isOnboarded`, `showWelcome`)
- Tier/limits (`tier`, `tierLimits`, `discoveryLimits`)
- Comment history (`commentHistory`, `selectedComments`, `commentCount`, `todayCommentCount`)
- Discovery tracking (`discoveryCount`, `lastDiscoveryDate`, `discoveryCache`)
- Engaged accounts (`engagedAccounts`, `commentedPostUrls`)
- Daily goals & streaks (`dailyGoal`, `streak`, `lastGoalDate`)
- Comment queue (`commentQueue`) — in-memory only, resets on app restart
- Rating prompt (`showRatingPrompt`)

All state is passed down as props — there is no context or state management library.

**Navigation flow:** `WelcomeScreen` → `OnboardingScreen` → main stack:
`Main`, `Discover`, `Queue`, `Inbox`, `Settings`, `Reporting`, `Feedback`

**Screens (`screens/`):**

- **MainScreen** — paste an Instagram post URL → Apify scrapes caption → Anthropic generates 3 comments → user taps to copy + auto-opens Instagram. Shows daily goal progress bar, streak count, and a green queue badge ("N comments ready") when the queue is non-empty.
- **DiscoverScreen** — finds posts by hashtag using Apify. Picking a comment adds it to the queue (no immediate Instagram open). Uses a two-phase progress bar during search. Fetches top 3 hashtags in parallel via `Promise.all`.
- **QueueScreen** — checklist of comments queued from DiscoverScreen. Each item: `@username`, caption preview, the chosen comment. Per-item Copy button, Open Post button (opens that URL in Instagram), Done button (removes from queue). Queue badge on MainScreen drives navigation here.
- **InboxScreen** — Business tier only. Pulls comments on the user's own posts via Apify, shows an inbox feed, generates 3 brand-voice reply options per comment. Same copy→open Instagram pattern as the rest of the app. Non-business users see an upgrade prompt.
- **OnboardingScreen** — 7-step flow: account type → IG handle → hashtags → reference URLs → voice sliders → preview → email/name. Distinguishes private accounts from bad handles.
- **SettingsScreen** — profile editing, tier upgrades, daily goal selector (5/10/15/20), voice slider editing, hashtag management, reference URL management.
- **ReportingScreen** — read-only stats: comment counts, usage bar, voice DNA word cloud, recent comment history, engaged accounts list.

**`lib/supabase.js`** — all database I/O. Tables: `users`, `comment_history`, `commented_posts`, `engaged_accounts`, `discovery_cache`, `feedback`, `error_logs`. Functions follow a consistent pattern: upsert for creates/updates, return `null` on error rather than throwing. Key functions:
- `saveGoalProgress(userId, { streak, lastGoalDate })` — updates streak/date only, does not touch other profile fields
- `logError({ screen, action, message, userId })` — fire-and-forget error logging, never throws
- `saveDiscoveryCache` / `loadDiscoveryCache` — 24h TTL keyed by `today:tag1,tag2,tag3`

**`config.js`** — exports `ANTHROPIC_API_KEY` and `APIFY_API_TOKEN`.

## Supabase Tables

| Table | Purpose |
|---|---|
| `users` | User profiles including `daily_goal`, `streak`, `last_goal_date` |
| `comment_history` | All selected comments (last 100 loaded on startup) |
| `commented_posts` | Post URLs already commented on (used for deduplication) |
| `engaged_accounts` | Accounts the user has commented on, with engagement count |
| `discovery_cache` | Cached Apify results, 24h TTL, keyed by date+hashtags |
| `feedback` | User-submitted feedback from FeedbackScreen |
| `error_logs` | Client-side errors logged via `logError()` |

All tables have RLS enabled with anon-insert policies where writes are needed from the client.

## Key Patterns

**AI comment generation** (`MainScreen`, `DiscoverScreen`, `InboxScreen`): All three screens call the Anthropic API directly from the client using `anthropic-dangerous-direct-browser-access: true`. The system prompt is built from `userProfile` fields — `accountType`, `sliders`/`sliderValues`, `igPosts`, and `referenceUrls` — to match the user's voice. The last 10 selected comments are injected as learning context when ≥3 exist.

**Voice sliders**: `userProfile.sliders` is an array of `{id, left, right}` objects. `userProfile.sliderValues` maps `id → number (1-5)`. Both arrays must stay in sync — when editing sliders in Settings, update both.

**Tier limits**: Enforced client-side only. `tierLimits` caps `commentCount` (monthly comments), `discoveryLimits` caps daily Discover uses reset by date comparison against `lastDiscoveryDate`.

**Monthly comment count**: `commentCount` tracks only the current calendar month. On startup, `checkExistingUser` in App.js filters the loaded comment history to `month === now.getMonth() && year === now.getFullYear()` before calling `setCommentCount`. Do not revert this to `history.length` — that would count all-time comments against the monthly cap.

| Tier | Price | Monthly comments | Discovery/day |
|---|---|---|---|
| starter | $5/mo | 20 | 1 |
| growth | $15/mo | 150 | 5 |
| business | $50/mo | 500 | unlimited |

Apple takes 30% of subscription revenue — factor this into any pricing changes.

**`selectComment` pattern differs by screen:**
- **MainScreen**: copies → 1s "Copied!" → clears state → auto-opens Instagram via `Linking.openURL`. No alert popups.
- **DiscoverScreen**: copies → calls `addToQueue(item)` → 1s "✓ Added to queue!" → clears back to post list. Does NOT open Instagram. User posts from QueueScreen.
- **InboxScreen**: copies → 1s "Copied!" → clears back to inbox → auto-opens Instagram.

**Comment queue** (`commentQueue` in App.js): in-memory array, not persisted to Supabase. Resets when app is killed. Each item: `{ id, postUrl, username, caption, comment, done }`. `addToQueue(item)` prepends; `markQueueDone(id)` filters out. Passed to `DiscoverScreen` (write) and `QueueScreen` (read + done).

**Voice rules** enforced in the AI system prompt — never break these when editing prompts:
- 1–2 sentences max
- Never use dashes or em dashes or hyphens between words
- Sounds like a text, not a caption
- Never promotional
- Makes people curious about the commenter

**Discovery** fetches the top 3 hashtags (by frequency, already sorted) in parallel via `Promise.all` instead of sequentially. Cache key uses `slice(0, 3)` — if you change this, existing caches will be invalidated (which is fine). Loading shows a two-phase progress bar: "Searching your communities..." (0→80% over ~9s via `setInterval`) then "Filtering the best posts..." (100%) before clearing.

**Discovery filters**: 50–10,000 likes, under 50 comments, accounts under 100K followers (`ownerFollowersCount`), not the user's own posts, not in `commentedPostUrls`. Cache is two-layer: in-memory first, then Supabase (24h TTL). Only a full miss hits Apify and consumes a daily session.

**Daily goals & streaks**: `dailyGoal` (5/10/15/20, default 10) is set in Settings and saved to `users.daily_goal`. `todayCommentCount` is computed from history on startup and incremented live. When `todayCommentCount >= dailyGoal` for the first time today, `streak` increments (or resets to 1 if yesterday's goal wasn't hit). Streak is saved via `saveGoalProgress()` — not through `saveUser()` — to avoid overwriting it during profile edits. On startup, if `lastGoalDate` is older than yesterday, streak is reset to 0.

**App Store rating prompt**: shown once ever (gated by `AsyncStorage('ratingPromptShown')`) after the user's 10th all-time comment. Checked both on startup (if `history.length >= 10`) and in `handleCommentUsed` (if `commentHistory.length + 1 >= 10`). Opens `APP_STORE_URL` constant in `App.js` — **replace the placeholder ID (`0000000000`) with the real App Store ID after first submission**.

**Error handling**: all Apify/Anthropic catch blocks classify errors as `network` (message contains "Network request failed" / "Failed to fetch") or `api`. Network errors show "Check your internet connection and try again." Apify failures show "Instagram is being difficult right now. Try again in a minute." Anthropic failures show "Our comment engine is taking a break. Try again shortly." All errors are logged to `error_logs` via `logError()`.

**Private account detection** (OnboardingScreen, SettingsScreen): when Apify returns an empty array (not an error), the account is private. Show "This account may be private. CommentEngine only works with public profiles." A bad handle (non-empty response but no `ownerUsername`) shows "Couldn't find that account. Check the spelling."

**Feedback** is saved to the `feedback` Supabase table via `saveFeedback()` in `lib/supabase.js`. Schema: `id, user_name, email, ig_handle, account_type, type, message, created_at`.

## Git Rules

`config.js` must never be committed — it contains live API keys. If it gets tracked:
```bash
git rm --cached config.js
```

If a push is rejected because secrets were detected in history, use the orphan branch approach (rewrite history). Always push with:
```bash
git push origin master:main
```

## Planned Features

- My Network tab with push notifications when followed accounts post
- Apple IAP payment integration (replacing current manual tier upgrades in SettingsScreen)
- Auto-refresh voice sliders and hashtags every 2 weeks
- Push notifications for daily streak reminders
