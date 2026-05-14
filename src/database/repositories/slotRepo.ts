import type Database from 'better-sqlite3';
import * as anchorRepo from './anchorRepo.js';

export interface SlotRow {
  botluck_id: number;
  slot_index: number;
  slot_name: string;
  announced_at: string | null;
  announcement_message_id: string | null;
  filled_by: string | null;
  value: string | null;
  filled_at: string | null;
}

export function listForBotluck(db: Database.Database, botluckId: number): SlotRow[] {
  return db
    .prepare<[number], SlotRow>(
      `SELECT * FROM botluck_slots WHERE botluck_id = ? ORDER BY slot_index ASC`,
    )
    .all(botluckId);
}

export function getByName(
  db: Database.Database,
  botluckId: number,
  slotName: string,
): SlotRow | null {
  return (
    db
      .prepare<[number, string], SlotRow>(
        `SELECT * FROM botluck_slots WHERE botluck_id = ? AND slot_name = ?`,
      )
      .get(botluckId, slotName) ?? null
  );
}

export function getByIndex(
  db: Database.Database,
  botluckId: number,
  slotIndex: number,
): SlotRow | null {
  return (
    db
      .prepare<[number, number], SlotRow>(
        `SELECT * FROM botluck_slots WHERE botluck_id = ? AND slot_index = ?`,
      )
      .get(botluckId, slotIndex) ?? null
  );
}

export function markAnnounced(
  db: Database.Database,
  botluckId: number,
  slotIndex: number,
): void {
  db.prepare(
    `UPDATE botluck_slots SET announced_at = datetime('now') WHERE botluck_id = ? AND slot_index = ?`,
  ).run(botluckId, slotIndex);
}

export function setAnnouncementMessageId(
  db: Database.Database,
  botluckId: number,
  slotIndex: number,
  messageId: string,
): void {
  db.prepare(
    `UPDATE botluck_slots SET announcement_message_id = ? WHERE botluck_id = ? AND slot_index = ?`,
  ).run(messageId, botluckId, slotIndex);
  // Also record as an anchor so future replies to this message id route here.
  anchorRepo.add(db, botluckId, slotIndex, messageId);
}

export interface SlotWithBotluckId extends SlotRow {
  guild_id: string;
}

export function findOpenByMessageRef(
  db: Database.Database,
  messageId: string,
): SlotWithBotluckId | null {
  return anchorRepo.findOpenByAnchor(db, messageId);
}

export function lastFillForUserInBotluck(
  db: Database.Database,
  botluckId: number,
  userId: string,
): string | null {
  const row = db
    .prepare<[number, string], { at: string | null }>(
      `SELECT MAX(filled_at) AS at FROM botluck_slots WHERE botluck_id = ? AND filled_by = ?`,
    )
    .get(botluckId, userId);
  return row?.at ?? null;
}

export function fillIfOpen(
  db: Database.Database,
  botluckId: number,
  slotIndex: number,
  userId: string,
  value: string,
): boolean {
  const result = db
    .prepare(
      `UPDATE botluck_slots
       SET filled_by = ?, value = ?, filled_at = datetime('now')
       WHERE botluck_id = ? AND slot_index = ? AND filled_by IS NULL`,
    )
    .run(userId, value, botluckId, slotIndex);
  return result.changes > 0;
}

export function clear(db: Database.Database, botluckId: number, slotIndex: number): void {
  db.prepare(
    `UPDATE botluck_slots
     SET filled_by = NULL, value = NULL, filled_at = NULL
     WHERE botluck_id = ? AND slot_index = ?`,
  ).run(botluckId, slotIndex);
}

export function countFilled(db: Database.Database, botluckId: number): number {
  const row = db
    .prepare<[number], { count: number }>(
      `SELECT COUNT(*) AS count FROM botluck_slots WHERE botluck_id = ? AND filled_by IS NOT NULL`,
    )
    .get(botluckId);
  return row?.count ?? 0;
}

export function listOpen(db: Database.Database, botluckId: number): SlotRow[] {
  return db
    .prepare<[number], SlotRow>(
      `SELECT * FROM botluck_slots
       WHERE botluck_id = ? AND announced_at IS NOT NULL AND filled_by IS NULL
       ORDER BY slot_index ASC`,
    )
    .all(botluckId);
}

export function lastFillAt(db: Database.Database, botluckId: number): string | null {
  const row = db
    .prepare<[number], { at: string | null }>(
      `SELECT MAX(filled_at) AS at FROM botluck_slots WHERE botluck_id = ?`,
    )
    .get(botluckId);
  return row?.at ?? null;
}
