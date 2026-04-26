# avalon-botluck-bot

Discord bot that springs a fill-in-the-blanks "botluck" on a designated channel after priming. Admin primes the bot with a template like:

```
A wandering {profession} named {name} from {address}, known for {quirk}.
```

Twenty-four hours later (configurable) the bot springs in the spawn channel, opens slots in order, and lets users race to claim each one with `/fill`. One slot per person. When all slots are filled, the assembled text is posted to the result channel.

## Quick start

```bash
npm install
cp .env.example .env
# fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OWNER_DISCORD_ID
npm run deploy-commands
npm run dev
```

In the server:

```
/setup channel:#botluck result_channel:#botluck-results
/prime           # opens a modal — paste your {slot}-marked template
```

Then wait. When the bot springs, anyone can run `/fill slot:profession value:"druid"` to claim that slot.

## Configuration (per guild)

| option | default | meaning |
|---|---|---|
| `channel` | _required_ | where the botluck springs and slot prompts go |
| `result_channel` | falls back to `channel` | where the final assembled text is posted |
| `spring_delay_hours` | `24` | hours between `/prime` and the spring |
| `slot_gap_min_seconds` | `15` | minimum gap between slot prompts |
| `slot_gap_max_seconds` | `30` | maximum gap between slot prompts |

Set with `/setup`. Run `/setup` with no options to view the current config.

## Commands

| command | who | what it does |
|---|---|---|
| `/setup [channel] [result_channel] [...]` | admin | configure channels and timing |
| `/prime` | admin | open a modal to paste the template; schedules the spring |
| `/fill slot value` | anyone | claim an announced, empty slot |
| `/revoke slot` | admin | reopen a filled slot; the original filler is banned from re-taking it |
| `/cancel` | admin | abort the active botluck |
| `/status` | anyone | show the current state (ephemeral) |
| `/test-spring` | owner | spring the primed botluck immediately, bypassing the delay (testing only) |

## Template syntax

Whatever you paste in the prime modal is preserved verbatim — newlines, brackets, parens, prose, all of it — except for `{slotname}` markers, which become the slots users fill. Slot names must start with a letter and use only letters, digits, and underscores. Each name must appear once.

Example template:

```
[Wandering vagabond]

Name: {name}
Class: {profession}
From: {address}

— Likes: {hobby}
— Quirk: {quirk}
```

## Environment

```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
OWNER_DISCORD_ID=
DATABASE_PATH=  # optional; defaults to ./avalon-botluck.db
```

## Scripts

- `npm run dev` — run with tsx
- `npm run build` — compile with tsup
- `npm start` — run compiled output
- `npm run deploy-commands` — register slash commands
- `npm run typecheck` — type-check without emit

See `SPECIFICATION.md` for the full feature spec and data model.
