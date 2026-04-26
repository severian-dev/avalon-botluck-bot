import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import { refreshPresence } from '../services/presenceService.js';

export const name = 'ready';
export const once = true;

export function execute(client: Client, db: Database.Database): void {
  console.log(`Logged in as ${client.user?.tag}`);
  refreshPresence(client, db);
}
