import type { Message } from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckRepo from '../database/repositories/botluckRepo.js';

export const name = 'messageCreate';

export function execute(message: Message, db: Database.Database): void {
  if (!message.guildId) return;
  if (message.author.bot) return;
  const botluck = botluckRepo.findRunningBySpawnChannel(
    db,
    message.guildId,
    message.channelId,
  );
  if (!botluck) return;
  botluckRepo.stampChannelActivity(db, botluck.id, message.createdAt);
}
