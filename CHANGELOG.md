# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Initial project scaffold: TypeScript + discord.js v14 + better-sqlite3, layered config, services + repositories + scheduler.
- `/setup` admin command for spawn channel, result channel, spring delay, slot gap.
- `/prime` admin command — opens a modal for the fill-in-the-blanks template; schedules the spring 24h out (configurable).
- `/fill slot value` — anyone can claim an announced, empty slot. One slot per user per botluck.
- `/revoke slot` admin command — clears a filled slot and bans the original filler from re-taking it.
- `/cancel` admin command — aborts the active botluck.
- `/status` — shows the current botluck state (ephemeral).
- Scheduler tick (5s) — springs primed botlucks at `spring_at`, announces the next slot 15–30s after each fill.
- Template parser preserves all surrounding text (newlines, brackets, parens, prose) and validates slot names.
- `/test-spring` (owner-only) — springs the currently primed botluck immediately, bypassing the spring delay. For testing only.
- Optional `theme` field on the prime modal — shown on the spring announcement and on every "next slot" prompt as a reminder.
- Spring announcement now mentions that the assembled result will become a character card.

### Changed

- Slot-fill announcement now shows the value the user submitted, not just who filled the slot.
- Bot now reminds the channel when no slot has been filled for 5 minutes (configurable via `reminder_after_seconds`) and the channel has had non-bot activity since the last progress. Set to `0` to disable.
- Bot's Discord presence reflects state: green "Playing /prime to start a botluck" when idle, idle "Watching 🥣 primed — waiting to spring" when primed, green "Playing 🍲 a botluck (slots open)" when running.
- `npm run reset-db` script — deletes the SQLite file and its WAL sidecars; honours `DATABASE_PATH`.

### Changed (breaking)

- **Submission mechanic is now reply-based.** Users submit by replying to the bot's slot-prompt messages in the spawn channel. Successful replies are parroted back to the channel; invalid replies (cooldown, banned, race-lost, empty, unrelated) are silently ignored.
- **`/fill` command removed.** Run `npm run deploy-commands` after upgrading to drop it from Discord.
- **"One slot per user per botluck" rule replaced with a 6h cooldown** (configurable via `submission_cooldown_hours` on `/setup`; `0` disables). A user can now win multiple slots over the course of a botluck, just rate-limited.
- Bot now requires the **MESSAGE_CONTENT** privileged gateway intent. Enable it in the Developer Portal before restarting.
- On startup, the bot re-announces any currently-open slot lacking a stored announcement message id. This is the migration path for botlucks that were primed/sprung under the old `/fill`-based model — they keep working under the reply-based flow without manual intervention.

### Fixed

- Cooldown and reminder math now correctly interpret SQLite-emitted timestamps as UTC regardless of host timezone (previously off by the TZ offset on non-UTC hosts).

### Added

- **Blind botluck mode.** Optional toggle on the prime modal (type `yes` to enable). When on, the channel parrot only acknowledges "@user filled `slot`" without showing the value, and `/status` hides values too. `/view` and the final assembled card always reveal values.
- **`/view` admin command.** Posts publicly in the current channel a list of every slot with its filler and submitted value, including for blind botlucks. The intended reveal mechanism.
- **`admin_role` config** in `/setup`. A role that's treated as admin alongside `Manage Guild` for all admin commands (`/setup`, `/prime`, `/revoke`, `/cancel`, `/view`).
- **`/reannounce` admin command.** Re-posts the prompt for every currently-open slot. Also picks up any spawn/result channel change made via `/setup` since prime time. Use this if you deleted the bot's slot prompt or changed the spawn channel mid-botluck.
- **Multiple reply anchors per slot.** Replies routed to a slot now match against any anchor for that slot — the original prompt, reminder messages, and `/reannounce` reposts. Users no longer have to find the original message to reply.
- **Cooldown reply.** When a user replies during the 6h cooldown window, the bot now replies (no ping) telling them how much time remains. Other invalid replies (banned, race-lost, empty, unrelated) stay silent.

### Schema

- New `slot_anchors(message_id PRIMARY KEY, botluck_id, slot_index, created_at)` table for the many-to-one anchor lookup. Backfilled from existing `botluck_slots.announcement_message_id` on first migration so in-flight botlucks don't lose their anchor.
