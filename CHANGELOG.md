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
