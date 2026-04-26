# avalon-botluck-bot — Specification

Source of truth for the bot's feature scope. Update this file when behavior or data model changes.

## Concept

A "botluck" is a collaborative fill-in-the-blanks game. An admin primes the bot with a template such as:

```
A wandering {profession} named {name} from {address}, known for {quirk}.
```

The bot waits a configured delay (default 24 hours), then springs onto a designated channel and opens the slots one at a time. Anyone can race to claim a slot with `/fill slot:<name> value:"…"`. Each user can fill at most one slot per botluck. Once all slots are filled, the assembled text is posted to the result channel and the botluck ends. To run another, an admin re-primes the bot.

## Lifecycle

```
idle ──/prime──▶ primed ──spring tick──▶ running ──last fill──▶ complete
                   │                       │
                   └──── /cancel ─────────▶ cancelled
                                            │
                                          /cancel
```

- **idle** — no active botluck.
- **primed** — template stored, waiting for `spring_at`.
- **running** — sprung, slots are being filled.
- **complete** — every slot is filled; assembled text was posted.
- **cancelled** — admin aborted; must re-prime.

Only one active botluck per guild (`primed` or `running`) is allowed; enforced by a partial unique index.

## Slot mechanics

- Slots are extracted from `{slotname}` markers in the template, in order.
- Slot names: letters, digits, underscores; must start with a letter; case-insensitive uniqueness.
- All other characters in the template (newlines, brackets, parens, plain text) round-trip to the final assembled output verbatim.
- Each slot has two states: **announced** (the bot has prompted it) and **filled** (someone claimed it).
- An optional `theme` (set on the prime modal alongside the template) is shown on the spring announcement and every "next slot" prompt as a reminder of the overall vibe.

### Slot timing

- When the bot springs, it announces slot 0 immediately as part of the spring message, opening it for fill.
- After a slot is filled, the bot waits a random gap of `slot_gap_min_seconds`–`slot_gap_max_seconds` (default 15–30s), then announces the next slot.
- A slot, once announced, stays open until filled — there is no per-slot deadline.
- If `/revoke` clears a slot mid-botluck, the slot reopens and is fillable in parallel with whatever slot is currently the most recently announced. The botluck completes only when all slots are filled.

### Fill rules

`/fill slot:<name> value:"<text>"` succeeds when:

1. There is a `running` botluck in the guild.
2. The slot exists and has been announced.
3. The slot is currently empty.
4. The user is not banned from this slot (set by a prior `/revoke` against them).
5. The user has not already filled another slot in this botluck.

Fills are atomic: a `WHERE filled_by IS NULL` clause makes simultaneous `/fill` calls on the same open slot deterministic (one wins).

### Revoke rules

`/revoke slot:<name>` (admin-only) clears a filled slot:

- The slot's value and filler are cleared.
- The original filler is added to a per-slot ban list, so they cannot re-take that specific slot.
- The user remains eligible for any other open slot (their fill was wiped).
- The botluck does not rewind; later announcements continue on schedule.

### Cancel rules

`/cancel` (admin-only) marks the active botluck as `cancelled`. The spawn channel is notified if the botluck was `running`.

## Configuration (per guild)

Stored in `guild_config`:

| key | default | meaning |
|-----|---------|---------|
| `spawn_channel_id` | _unset_ | where the bot springs and slot prompts go (required to prime) |
| `result_channel_id` | _unset_ | where the assembled text lands (defaults to `spawn_channel_id` if unset) |
| `spring_delay_hours` | `24` | hours between `/prime` and the spring |
| `slot_gap_min_seconds` | `15` | minimum gap between slot prompts |
| `slot_gap_max_seconds` | `30` | maximum gap between slot prompts |

All set via `/setup`. Calling `/setup` with no options shows the current configuration.

## Commands

| command | who | purpose |
|---------|-----|---------|
| `/setup` | admin | configure channels and timing |
| `/prime` | admin | open the modal to paste a template; stores it and schedules the spring |
| `/fill slot value` | anyone | claim an announced, empty slot |
| `/revoke slot` | admin | reopen a filled slot, banning the original filler from it |
| `/cancel` | admin | abort the active botluck |
| `/status` | anyone | show the current botluck state (ephemeral) |

## Data model

### `guild_config`
Per-guild settings. See table above.

### `botlucks`
One row per botluck. The active row (if any) is the one with `state IN ('primed','running')`.

| column | type | notes |
|---|---|---|
| `id` | INTEGER PK | |
| `guild_id` | TEXT | |
| `state` | TEXT | `primed` / `running` / `complete` / `cancelled` |
| `template` | TEXT | raw template, with `{slot}` markers preserved |
| `slots_json` | TEXT | JSON array of slot names in order |
| `spawn_channel_id` | TEXT | snapshot at prime time |
| `result_channel_id` | TEXT | snapshot at prime time |
| `primed_by` | TEXT | user id |
| `primed_at` | TEXT | ISO timestamp |
| `spring_at` | TEXT | when the spring tick should fire |
| `sprung_at` | TEXT NULL | filled when state→running |
| `next_announce_index` | INTEGER NULL | which slot the scheduler will announce next; NULL when nothing remains to announce |
| `next_announce_at` | TEXT NULL | when to fire the next announcement; NULL when waiting for a fill |
| `announcement_message_id` | TEXT NULL | message id of the spring announcement |
| `completed_at` | TEXT NULL | |
| `cancelled_at` | TEXT NULL | |
| `theme` | TEXT NULL | optional theme provided at prime time; shown on the spring + slot announcements |

### `botluck_slots`
One row per slot per botluck.

| column | type |
|---|---|
| `botluck_id` | INTEGER FK |
| `slot_index` | INTEGER |
| `slot_name` | TEXT |
| `announced_at` | TEXT NULL |
| `filled_by` | TEXT NULL — user id |
| `value` | TEXT NULL |
| `filled_at` | TEXT NULL |

PK `(botluck_id, slot_index)`.

### `botluck_bans`
Records the per-slot ban after a `/revoke`.

| column | type |
|---|---|
| `botluck_id` | INTEGER FK |
| `slot_index` | INTEGER |
| `user_id` | TEXT |
| `banned_at` | TEXT |

PK `(botluck_id, slot_index, user_id)`.

## Scheduler

A single `setInterval` ticks every 5 seconds and:

1. Looks for `state='primed'` rows with `spring_at <= now`. For each, posts the spring announcement (which opens slot 0) and transitions to `running`.
2. Looks for `state='running'` rows with `next_announce_at <= now`. For each, posts the next slot's prompt, marks it announced, advances `next_announce_index`, and clears `next_announce_at`.

The scheduler holds no in-memory timers — all state lives in SQLite, so restarts are seamless.
