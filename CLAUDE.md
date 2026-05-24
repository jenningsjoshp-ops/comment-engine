# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules
- After every commit and push, update CLAUDE.md with any new patterns, features, screens, or important changes from that session. This is mandatory, not optional.
- Always run `npx expo export` to verify the build compiles before committing.

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
- Skip-and-explore flag (`skippedOnboarding`) — true when user skipped onboarding from WelcomeScreen

All state is passed down as props — there is no context or state management library.

**Navigation flow:** `WelcomeScreen` → `OnboardingScreen` → main stack:
`Main`, `Discover`, `Queue`, `Inbox`, `Settings`, `Reporting`, `Feedback`

**Skip-and-explore flow:** WelcomeScreen has a "Try it first" button (last slide only) that calls `handleSkipAndExplore` in App.js. This sets a default creator profile, marks `isOnboarded(true)` and `skippedOnboarding(true)`, bypassing OnboardingScreen entirely. Users land on MainScreen with defaults. When they try to generate comments, discover posts, or reply to comments, they see a lazy prompt: "Set up your voice first" with "Set Up Now" (calls `handleSetUpNow` → sets `isOnboarded(false)`, showing Onboarding) or "Use defaults" (proceeds with generic voice). SettingsScreen shows a "Complete your profile for better comments" banner at the top when `skippedOnboarding` is true.

**Screens (`screens/`):**

- **MainScreen** — paste an Instagram post URL → Apify scrapes caption → Anthropic generates 3 comments → user taps to copy + auto-opens Instagram. Shows daily goal progress bar, streak count, and a green queue badge ("N comments ready") when the queue is non-empty. If `skippedOnboarding` is true, tapping Find Posts / Reply to Comments / Generate shows a lazy prompt before proceeding.
- **DiscoverScreen** — finds posts by hashtag using Apify. Picking a comment adds it to the queue (no immediate Instagram open). Uses a two-phase progress bar during search. Fetches top 3 hashtags in parallel via `Promise.all`. Session limit alert includes "Upgrade" button → Settings. `discoverError` state distinguishes API failure from no-results — shows "Couldn't reach Instagram" message and "Try Again" button in either empty state (retry button always rendered regardless of `posts.length`).
- **QueueScreen** — checklist of comments queued from DiscoverScreen. Each item: `@username`, caption preview, the chosen comment. Per-item Copy button, "Open @{username}" button (opens Instagram post URL), Done button (removes from queue), and a wrong-post note. Queue badge on MainScreen drives navigation here.
- **InboxScreen** — open to all tiers (tier gate removed for testing). If `userProfile.igHandle` is empty, shows "Instagram not connected" with a "Go to Settings" button instead of attempting a fetch. Pulls comments on the user's own posts via Apify. Skips posts where the user already replied. Shows a two-phase progress bar while loading. Generates 3 brand-voice reply options per comment. Copies reply and auto-opens Instagram.
- **OnboardingScreen** — 7-step flow: account type → IG handle → hashtags → reference URLs → voice sliders → preview → Apple Sign In / name+email. Steps 1, 3, 4, 5, 6 have skip links ("Use default", "I'll add these later", "Use defaults", "I'll see it in action"). Steps 2 and 7 are required. Distinguishes private accounts from bad handles.
- **WelcomeScreen** — 3 text-only slides. Last slide shows "Get Started" (→ OnboardingScreen) and "Try it first" (→ skip-and-explore flow). Earlier slides show "Next" only.
- **OnboardingScreen** — 7-step flow with back buttons on steps 2–7. Step 2 has a 60-second timeout Alert offering to skip, "My account is new — skip this step" link, and updated error message covering private/no-posts cases. Step 7 shows an ActivityIndicator while checking Apple Sign In availability; if Apple returns no email on repeat auth, shows amber banner "Apple didn't share your email. Please enter it below." above the manual form.
- **SettingsScreen** — profile editing, tier upgrades, daily goal selector (5/10/15/20), voice slider editing, hashtag management, reference URL management. `beforeRemove` listener shows "Unsaved changes" alert when navigating back with dirty fields. Save button turns green with "✓ Saved!" and navigates back after 900ms. Save button disabled when email field is non-empty and invalid. `skippedOnboarding` banner is informational text only (no navigation) — user fills in handle in-place. Log Out button clears AsyncStorage and resets all state.
- **ReportingScreen** — read-only stats: today/this week/this month counts, monthly usage bar, Voice DNA word chips (always shown — placeholder text "Generate 5+ comments" when below threshold), engaged accounts list (always shown — placeholder when empty), recent comment history with Instagram links (Linking has `.catch()`).

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
- **MainScreen**: `url` captured as first line before any state changes → copies → 1s "Copied!" → clears state → `Linking.openURL(url).catch(→ instagram://)`. Shows green "Comment copied! Ready for the next one?" banner for 8 seconds after selection. "Reply to Comments" button shows "AI reply suggestions" subtext (tier gate removed). No alert popups.
- **DiscoverScreen**: copies → calls `addToQueue(item)` → 1s "✓ Added to queue!" → clears back to post list. Does NOT open Instagram. User posts from QueueScreen.
- **InboxScreen** (`selectReply`): copies → 1s "Copied! Opening Instagram..." → clears reply view → auto-opens Instagram via `selectedItem.postUrl`.

**Comment queue** (`commentQueue` in App.js): in-memory array, not persisted to Supabase. Resets when app is killed. Each item: `{ id, postUrl, username, caption, comment, done }`. `addToQueue(item)` prepends; `markQueueDone(id)` filters out. Passed to `DiscoverScreen` (write) and `QueueScreen` (read + done).

**Voice rules** enforced in the AI system prompt — never break these when editing prompts:
- 1–2 sentences max
- Never use dashes or em dashes or hyphens between words
- Sounds like a text, not a caption
- Never promotional
- Makes people curious about the commenter
- CRITICAL: NEVER invent or fabricate personal details about the commenter. Only reference details explicitly present in the user's posts or profile. (This rule must be present in every system prompt — MainScreen, DiscoverScreen, InboxScreen, OnboardingScreen preview.)

**Discovery** fetches the top 3 hashtags (by frequency, already sorted) in parallel via `Promise.all` instead of sequentially. Cache key: `today:tag1,tag2,tag3` where tags are `slice(0, 3).sort()` — sorted so cache hits regardless of hashtag order. If you change `slice(0, 3)` or remove `.sort()`, existing caches will be invalidated (which is fine). Loading shows a two-phase progress bar: "Searching your communities..." (0→80% over ~9s via `setInterval`) then "Filtering the best posts..." (100%) before clearing. Session limit alert includes "Upgrade" → Settings and "OK".

**Discovery filters**: Primary (strict) pass: 10–50,000 likes, under 100 comments, accounts under 500K followers, not own posts, not in `commentedPostUrls`. If strict pass yields fewer than 5 posts, a relaxed fallback runs that only filters own posts and already-commented posts. `resultsLimit` is 50 per hashtag. `commentedPostUrls` must include ALL historical URLs — `handleOnboardingComplete` in App.js calls `loadCommentedPosts` after saving the user so re-login populates the list correctly (not just session data).

**Discovery abundance**: Fetches hashtags in batches of 3 in parallel, expanding to the next batch if the strict-filtered count is still below 10 posts. Stops early once 10+ posts are found. Deduplicates by URL across batches. Shows "Found X posts · showing Y best matches" after a fresh Apify fetch. Cache is two-layer: in-memory first, then Supabase (24h TTL). Only a full miss hits Apify and consumes a daily session.

**Daily goals & streaks**: `dailyGoal` (5/10/15/20, default 10) is set in Settings and saved to `users.daily_goal`. `todayCommentCount` is computed from history on startup and incremented live. When `todayCommentCount >= dailyGoal` for the first time today, `streak` increments (or resets to 1 if yesterday's goal wasn't hit). Streak is saved via `saveGoalProgress()` — not through `saveUser()` — to avoid overwriting it during profile edits. On startup, if `lastGoalDate` is older than yesterday, streak is reset to 0.

**App Store rating prompt**: shown once ever (gated by `AsyncStorage('ratingPromptShown')`) after the user's 10th all-time comment. Checked both on startup (if `history.length >= 10`) and in `handleCommentUsed` (if `commentHistory.length + 1 >= 10`). Opens `APP_STORE_URL` constant in `App.js` — **replace the placeholder ID (`0000000000`) with the real App Store ID after first submission**. Log Out clears `ratingPromptShown` so the prompt can appear again after re-onboarding.

**Apple Sign In**: `expo-apple-authentication` is installed. `app.json` has `usesAppleSignIn: true` under `ios` — this is required for EAS to add the `com.apple.developer.applesignin` entitlement to the provisioning profile. Adding this entitlement requires an interactive EAS build (not `--non-interactive`) the first time so it can authenticate with Apple and regenerate the profile. OnboardingScreen step 7 uses `AppleAuthentication.isAvailableAsync()` to detect support, shows the Apple button when available, falls back to manual name/email form otherwise. Apple only returns `email` on first sign-in; if it's absent, falls back to manual form pre-filled with name.

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
