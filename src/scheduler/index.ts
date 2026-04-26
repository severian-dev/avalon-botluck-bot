import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import { startBotluckScheduler } from './botluckScheduler.js';

export function startSchedulers(client: Client, db: Database.Database): void {
  startBotluckScheduler(client, db);
}
