import type Database from 'better-sqlite3';

export interface GuildConfigRow {
  guild_id: string;
  spawn_channel_id: string | null;
  result_channel_id: string | null;
  spring_delay_hours: number;
  slot_gap_min_seconds: number;
  slot_gap_max_seconds: number;
  reminder_after_seconds: number;
  submission_cooldown_hours: number;
}

export const ALLOWED_KEYS = [
  'spawn_channel_id',
  'result_channel_id',
  'spring_delay_hours',
  'slot_gap_min_seconds',
  'slot_gap_max_seconds',
  'reminder_after_seconds',
  'submission_cooldown_hours',
] as const;

export type ConfigKey = (typeof ALLOWED_KEYS)[number];

export function ensure(db: Database.Database, guildId: string): void {
  db.prepare(`INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)`).run(guildId);
}

export function get(db: Database.Database, guildId: string): GuildConfigRow {
  ensure(db, guildId);
  const row = db
    .prepare<[string], GuildConfigRow>(`SELECT * FROM guild_config WHERE guild_id = ?`)
    .get(guildId);
  if (!row) throw new Error('guild_config row missing after ensure');
  return row;
}

export function set(
  db: Database.Database,
  guildId: string,
  key: ConfigKey,
  value: string | number | null,
): void {
  ensure(db, guildId);
  db.prepare(`UPDATE guild_config SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
}
