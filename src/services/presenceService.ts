import { ActivityType, type Client, type PresenceData } from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckRepo from '../database/repositories/botluckRepo.js';

export function refreshPresence(client: Client, db: Database.Database): void {
  if (!client.user) return;

  const running = db
    .prepare(`SELECT COUNT(*) AS n FROM botlucks WHERE state = 'running'`)
    .get() as { n: number };
  const primed = db
    .prepare(`SELECT COUNT(*) AS n FROM botlucks WHERE state = 'primed'`)
    .get() as { n: number };

  let presence: PresenceData;
  if (running.n > 0) {
    presence = {
      status: 'online',
      activities: [{ type: ActivityType.Playing, name: '🍲 a botluck (slots open)' }],
    };
  } else if (primed.n > 0) {
    presence = {
      status: 'idle',
      activities: [{ type: ActivityType.Watching, name: '🥣 primed — waiting to spring' }],
    };
  } else {
    presence = {
      status: 'online',
      activities: [{ type: ActivityType.Playing, name: '/prime to start a botluck' }],
    };
  }

  client.user.setPresence(presence);
}
