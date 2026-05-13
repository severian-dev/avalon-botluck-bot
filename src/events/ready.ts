import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import { refreshPresence } from '../services/presenceService.js';
import { reannounceOrphanSlots } from '../services/reannounceService.js';

export const name = 'ready';
export const once = true;

export async function execute(client: Client, db: Database.Database): Promise<void> {
  console.log(`Logged in as ${client.user?.tag}`);
  refreshPresence(client, db);
  await reannounceOrphanSlots(client, db);
}
