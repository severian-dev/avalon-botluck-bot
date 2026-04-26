import type Database from 'better-sqlite3';

export type BotluckState = 'primed' | 'running' | 'complete' | 'cancelled';

export interface BotluckRow {
  id: number;
  guild_id: string;
  state: BotluckState;
  template: string;
  slots_json: string;
  spawn_channel_id: string;
  result_channel_id: string;
  primed_by: string;
  primed_at: string;
  spring_at: string;
  sprung_at: string | null;
  next_announce_index: number | null;
  next_announce_at: string | null;
  announcement_message_id: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface CreateBotluckInput {
  guildId: string;
  template: string;
  slots: string[];
  spawnChannelId: string;
  resultChannelId: string;
  primedBy: string;
  springAt: Date;
}

export function getActive(db: Database.Database, guildId: string): BotluckRow | null {
  return (
    db
      .prepare<[string], BotluckRow>(
        `SELECT * FROM botlucks WHERE guild_id = ? AND state IN ('primed', 'running')`,
      )
      .get(guildId) ?? null
  );
}

export function getById(db: Database.Database, id: number): BotluckRow | null {
  return (
    db.prepare<[number], BotluckRow>(`SELECT * FROM botlucks WHERE id = ?`).get(id) ?? null
  );
}

export function create(db: Database.Database, input: CreateBotluckInput): BotluckRow {
  const insert = db.prepare(`
    INSERT INTO botlucks (
      guild_id, state, template, slots_json,
      spawn_channel_id, result_channel_id,
      primed_by, spring_at, next_announce_index, next_announce_at
    ) VALUES (?, 'primed', ?, ?, ?, ?, ?, ?, 0, NULL)
  `);
  const result = insert.run(
    input.guildId,
    input.template,
    JSON.stringify(input.slots),
    input.spawnChannelId,
    input.resultChannelId,
    input.primedBy,
    input.springAt.toISOString(),
  );
  const id = Number(result.lastInsertRowid);

  const insertSlot = db.prepare(
    `INSERT INTO botluck_slots (botluck_id, slot_index, slot_name) VALUES (?, ?, ?)`,
  );
  for (let i = 0; i < input.slots.length; i++) {
    insertSlot.run(id, i, input.slots[i]);
  }

  const row = getById(db, id);
  if (!row) throw new Error('botluck row missing after insert');
  return row;
}

export function listSpringDue(db: Database.Database, now: Date): BotluckRow[] {
  return db
    .prepare<[string], BotluckRow>(
      `SELECT * FROM botlucks WHERE state = 'primed' AND spring_at <= ?`,
    )
    .all(now.toISOString());
}

export function listAnnounceDue(db: Database.Database, now: Date): BotluckRow[] {
  return db
    .prepare<[string], BotluckRow>(
      `SELECT * FROM botlucks
       WHERE state = 'running'
         AND next_announce_at IS NOT NULL
         AND next_announce_at <= ?`,
    )
    .all(now.toISOString());
}

export function markSprung(
  db: Database.Database,
  id: number,
  announcementMessageId: string,
): void {
  db.prepare(
    `UPDATE botlucks
     SET state = 'running',
         sprung_at = datetime('now'),
         announcement_message_id = ?
     WHERE id = ?`,
  ).run(announcementMessageId, id);
}

export function setNextAnnounce(
  db: Database.Database,
  id: number,
  index: number | null,
  at: Date | null,
): void {
  db.prepare(
    `UPDATE botlucks SET next_announce_index = ?, next_announce_at = ? WHERE id = ?`,
  ).run(index, at?.toISOString() ?? null, id);
}

export function markComplete(db: Database.Database, id: number): void {
  db.prepare(
    `UPDATE botlucks
     SET state = 'complete',
         completed_at = datetime('now'),
         next_announce_index = NULL,
         next_announce_at = NULL
     WHERE id = ?`,
  ).run(id);
}

export function markCancelled(db: Database.Database, id: number): void {
  db.prepare(
    `UPDATE botlucks
     SET state = 'cancelled',
         cancelled_at = datetime('now'),
         next_announce_index = NULL,
         next_announce_at = NULL
     WHERE id = ?`,
  ).run(id);
}
