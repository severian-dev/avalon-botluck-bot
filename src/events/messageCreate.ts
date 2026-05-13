import type { Message } from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import * as botluckService from '../services/botluckService.js';
import {
  buildAssembled,
  buildCompletionAnnouncement,
  buildFillAnnouncement,
} from '../builders/embeds.js';
import { sendToChannel } from '../services/channelService.js';
import { refreshPresence } from '../services/presenceService.js';

export const name = 'messageCreate';

export async function execute(message: Message, db: Database.Database): Promise<void> {
  if (!message.guildId) return;
  if (message.author.bot) return;

  const botluck = botluckRepo.findRunningBySpawnChannel(
    db,
    message.guildId,
    message.channelId,
  );
  if (!botluck) return;

  // Stamp channel activity so the reminder tick knows people are around.
  botluckRepo.stampChannelActivity(db, botluck.id, message.createdAt);

  const refId = message.reference?.messageId;
  if (!refId) return;

  const outcome = botluckService.fillByReply(db, refId, message.author.id, message.content);
  if (!outcome.ok) return; // silently ignore — cooldown, banned, race, empty, unrelated reply

  await sendToChannel(message.client, outcome.result.botluck.spawn_channel_id, {
    embeds: [
      buildFillAnnouncement(
        outcome.result.slot,
        message.author.id,
        outcome.result.botluck.blind === 1,
      ),
    ],
  });

  if (outcome.result.isComplete && outcome.result.assembledText !== null) {
    await sendToChannel(message.client, outcome.result.botluck.spawn_channel_id, {
      embeds: [buildCompletionAnnouncement()],
    });
    await sendToChannel(message.client, outcome.result.botluck.result_channel_id, {
      content: buildAssembled(outcome.result.assembledText),
    });
    refreshPresence(message.client, db);
  }
}
