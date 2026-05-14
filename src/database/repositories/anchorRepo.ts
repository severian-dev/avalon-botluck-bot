import type Database from 'better-sqlite3';
import type { SlotRow } from './slotRepo.js';

export function add(
  db: Database.Database,
  botluckId: number,
  slotIndex: number,
  messageId: string,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO slot_anchors (message_id, botluck_id, slot_index) VALUES (?, ?, ?)`,
  ).run(messageId, botluckId, slotIndex);
}

export interface OpenSlotByAnchor extends SlotRow {
  guild_id: string;
}

/** Find the open slot whose anchors include this message id and whose botluck is running. */
export function findOpenByAnchor(
  db: Database.Database,
  messageId: string,
): OpenSlotByAnchor | null {
  return (
    db
      .prepare<[string], OpenSlotByAnchor>(
        `SELECT s.*, b.guild_id AS guild_id FROM slot_anchors a
           JOIN botluck_slots s
             ON s.botluck_id = a.botluck_id AND s.slot_index = a.slot_index
           JOIN botlucks b
             ON b.id = s.botluck_id
          WHERE a.message_id = ?
            AND s.filled_by IS NULL
            AND b.state = 'running'`,
      )
      .get(messageId) ?? null
  );
}
