import type Database from 'better-sqlite3';

export function add(
  db: Database.Database,
  botluckId: number,
  slotIndex: number,
  userId: string,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO botluck_bans (botluck_id, slot_index, user_id) VALUES (?, ?, ?)`,
  ).run(botluckId, slotIndex, userId);
}

export function isBanned(
  db: Database.Database,
  botluckId: number,
  slotIndex: number,
  userId: string,
): boolean {
  const row = db
    .prepare<[number, number, string], { count: number }>(
      `SELECT COUNT(*) AS count FROM botluck_bans
       WHERE botluck_id = ? AND slot_index = ? AND user_id = ?`,
    )
    .get(botluckId, slotIndex, userId);
  return (row?.count ?? 0) > 0;
}
