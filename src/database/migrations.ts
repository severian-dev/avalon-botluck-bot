import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id                TEXT PRIMARY KEY,
      spawn_channel_id        TEXT,
      result_channel_id       TEXT,
      spring_delay_hours      INTEGER NOT NULL DEFAULT 24,
      slot_gap_min_seconds    INTEGER NOT NULL DEFAULT 15,
      slot_gap_max_seconds    INTEGER NOT NULL DEFAULT 30,
      reminder_after_seconds  INTEGER NOT NULL DEFAULT 300
    );

    CREATE TABLE IF NOT EXISTS botlucks (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id                 TEXT NOT NULL,
      state                    TEXT NOT NULL CHECK(state IN ('primed', 'running', 'complete', 'cancelled')),
      template                 TEXT NOT NULL,
      slots_json               TEXT NOT NULL,
      spawn_channel_id         TEXT NOT NULL,
      result_channel_id        TEXT NOT NULL,
      primed_by                TEXT NOT NULL,
      primed_at                TEXT NOT NULL DEFAULT (datetime('now')),
      spring_at                TEXT NOT NULL,
      sprung_at                TEXT,
      next_announce_index      INTEGER,
      next_announce_at         TEXT,
      announcement_message_id  TEXT,
      completed_at             TEXT,
      cancelled_at             TEXT,
      theme                    TEXT,
      last_reminder_at         TEXT,
      last_channel_message_at  TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_botlucks_active_per_guild
      ON botlucks(guild_id) WHERE state IN ('primed', 'running');

    CREATE INDEX IF NOT EXISTS idx_botlucks_state_spring
      ON botlucks(state, spring_at);

    CREATE INDEX IF NOT EXISTS idx_botlucks_state_next_announce
      ON botlucks(state, next_announce_at);

    CREATE TABLE IF NOT EXISTS botluck_slots (
      botluck_id  INTEGER NOT NULL REFERENCES botlucks(id) ON DELETE CASCADE,
      slot_index  INTEGER NOT NULL,
      slot_name   TEXT NOT NULL,
      announced_at TEXT,
      filled_by   TEXT,
      value       TEXT,
      filled_at   TEXT,
      PRIMARY KEY (botluck_id, slot_index)
    );

    CREATE INDEX IF NOT EXISTS idx_botluck_slots_name
      ON botluck_slots(botluck_id, slot_name);

    CREATE TABLE IF NOT EXISTS botluck_bans (
      botluck_id  INTEGER NOT NULL REFERENCES botlucks(id) ON DELETE CASCADE,
      slot_index  INTEGER NOT NULL,
      user_id     TEXT NOT NULL,
      banned_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (botluck_id, slot_index, user_id)
    );
  `);

  ensureColumn(db, 'botlucks', 'theme', 'TEXT');
  ensureColumn(db, 'botlucks', 'last_reminder_at', 'TEXT');
  ensureColumn(db, 'botlucks', 'last_channel_message_at', 'TEXT');
  ensureColumn(db, 'guild_config', 'reminder_after_seconds', 'INTEGER NOT NULL DEFAULT 300');
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  type: string,
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
