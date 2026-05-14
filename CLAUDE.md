# CLAUDE.md

Project-specific instructions for working on avalon-botluck-bot.

## Project Overview

Discord bot that springs a fill-in-the-blanks "botluck" on a designated channel after priming. An admin primes the bot with a template like `A wandering {profession} named {name} from {address}, known for {quirk}.` After a fixed delay (default 24h) the bot springs in the configured channel, opens the first slot, and lets users race to claim each slot in order by **replying to the bot's slot-prompt message**. A per-user submission cooldown (default 6h, configurable) caps how often any one person can win slots in the same botluck. Once all slots are filled, the assembled text is posted to the result channel and the botluck must be re-primed.

The full feature spec lives in `SPECIFICATION.md` — treat it as the source of truth.

## Key Commands

- `npm run dev` — run with tsx (development)
- `npm run build` — compile with tsup
- `npm start` — run compiled output (requires .env)
- `npm run deploy-commands` — register slash commands with Discord
- `npm run typecheck` — `tsc --noEmit`

## Project Structure

- `src/commands/` — slash command definitions, one file per command (`setup`, `prime`, `revoke`, `cancel`, `status`, `view`, `reannounce`, `test-spring`, `last-result`). There is no `/fill`: submissions come in via `messageCreate` as replies to slot-prompt messages.
- `src/events/` — Discord event handlers (`ready`, `interactionCreate`, `messageCreate` for reply-based fills)
- `src/handlers/` — modal interaction handlers (`primeModalHandler`)
- `src/builders/` — pure functions that construct embeds and modals
- `src/services/` — business logic, no Discord API. `botluckService` is the single chokepoint for state changes; `templateService` parses and renders `{slot}` templates
- `src/scheduler/` — single tick that springs primed botlucks and announces the next slot after the fill gap
- `src/database/repositories/` — data access layer, one file per table (`guildConfig`, `botluck`, `slot`, `ban`)
- `src/config/` — env loader and zod schema
- `src/types/customIds.ts` — modal/button custom-ID constants

## Conventions

- **Single chokepoint for state changes.** Every state transition (prime, spring, fill, revoke, cancel, complete) goes through `botluckService`. SQL is wrapped in `db.transaction()` so paired writes (e.g. fill slot + schedule next announce) are atomic.
- **One active botluck per guild.** Enforced by the partial unique index `uq_botlucks_active_per_guild` on `botlucks(guild_id) WHERE state IN ('primed','running')`. Re-priming requires `/cancel` first.
- **Atomic fill.** The slot row is updated with `WHERE filled_by IS NULL`, so two simultaneous `/fill` calls on the same open slot resolve cleanly (one wins, the other gets a `RACE_LOST` error).
- **Admin commands** check `PermissionFlagsBits.ManageGuild` via `permissionService.isAdmin` (the configured `admin_role`, if any, also passes). `/setup`, `/prime`, `/revoke`, `/cancel`, `/view`, `/reannounce`, and `/last-result` are admin-only. `/status` is open to anyone. `/test-spring` is owner-only. Submissions themselves are reply-based, not a command.
- **Running `/setup` with no options prints the current config.** There is no separate `/config` command — when adding admin tooling that needs to inspect configuration, surface it through `/setup` rather than fragmenting into a parallel command.
- **State persists across restarts.** No in-memory timers — the scheduler reads `spring_at` and `next_announce_at` from SQLite each tick, so restarts don't lose primed botlucks.
- **Templates preserve formatting.** Whatever the admin pastes (newlines, brackets, parens, prose) round-trips through to the final assembled output unchanged except for `{slot}` substitutions. The parser only validates that slot names are word-shaped and unique.
- **Custom IDs** for modals are centralized in `src/types/customIds.ts`.
- **Per-guild data.** Every table has `guild_id`. Multi-guild safe even if we run in one server today.

## Documentation Rules

When making changes, **always update**:

- **CHANGELOG.md** — add entries under `[Unreleased]` following Keep a Changelog format.
- **README.md** — update the features list or command table if user-facing behavior changes.
- **SPECIFICATION.md** — update if the data model or feature scope changes.
