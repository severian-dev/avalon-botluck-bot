import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import * as slotRepo from '../database/repositories/slotRepo.js';
import { sendToChannel } from '../services/channelService.js';
import { buildSlotAnnouncement } from '../builders/embeds.js';

/**
 * On startup, any running botluck whose currently-open slot lacks
 * `announcement_message_id` predates the reply-based model. Post a fresh
 * "reply to this message" prompt so users have an anchor to reply to.
 */
export async function reannounceOrphanSlots(client: Client, db: Database.Database): Promise<void> {
  const running = botluckRepo.listRunning(db);
  for (const botluck of running) {
    const openSlots = slotRepo.listOpen(db, botluck.id);
    for (const slot of openSlots) {
      if (slot.announcement_message_id !== null) continue;
      try {
        const messageId = await sendToChannel(client, botluck.spawn_channel_id, {
          embeds: [buildSlotAnnouncement(slot, botluck.theme)],
        });
        if (messageId) {
          slotRepo.setAnnouncementMessageId(db, botluck.id, slot.slot_index, messageId);
        }
      } catch (err) {
        console.error(
          `Re-announce failed for botluck ${botluck.id} slot ${slot.slot_name}:`,
          err,
        );
      }
    }
  }
}
