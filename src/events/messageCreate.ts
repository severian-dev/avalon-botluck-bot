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

function formatRemaining(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 1) return 'less than a minute';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

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
  if (!outcome.ok) {
    if (outcome.reason === 'on_cooldown') {
      await message
        .reply({
          content: `⏳ You're on cooldown — try again in ${formatRemaining(outcome.remainingMs)}.`,
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
    }
    return; // silently ignore everything else
  }

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
    for (const embed of buildAssembled(outcome.result.assembledText)) {
      await sendToChannel(message.client, outcome.result.botluck.result_channel_id, {
        embeds: [embed],
      });
    }
    refreshPresence(message.client, db);
  }
}
