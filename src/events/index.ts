import type Database from 'better-sqlite3';
import type { BotClient } from '../client.js';
import type { BotEnv } from '../config/schema.js';
import * as ready from './ready.js';
import * as interactionCreate from './interactionCreate.js';
import * as messageCreate from './messageCreate.js';

interface EventModule {
  name: string;
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => void | Promise<void>;
}

const events: EventModule[] = [ready, interactionCreate, messageCreate];

export function registerEvents(client: BotClient, db: Database.Database, env: BotEnv): void {
  for (const event of events) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (...args: any[]) => event.execute(...args, db, env);
    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
  }
}
