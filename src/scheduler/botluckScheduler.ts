import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import * as botluckService from '../services/botluckService.js';
import { sendToChannel } from '../services/channelService.js';
import {
  buildSlotAnnouncement,
  buildSpringAnnouncement,
} from '../builders/embeds.js';

const TICK_SECONDS = 5;

export async function performSpring(
  client: Client,
  db: Database.Database,
  botluckId: number,
): Promise<boolean> {
  const plan = botluckService.springPlan(db, botluckId);
  const slots = JSON.parse(plan.botluck.slots_json) as string[];
  const messageId = await sendToChannel(client, plan.botluck.spawn_channel_id, {
    embeds: [buildSpringAnnouncement(plan.botluck, plan.firstSlot, slots.length)],
  });
  if (!messageId) {
    console.error(`Could not post spring for botluck ${botluckId} — leaving primed.`);
    return false;
  }
  botluckService.commitSpring(db, botluckId, messageId);
  return true;
}

async function runSpringTick(client: Client, db: Database.Database): Promise<void> {
  const due = botluckRepo.listSpringDue(db, new Date());
  for (const row of due) {
    try {
      await performSpring(client, db, row.id);
    } catch (err) {
      console.error(`Spring tick error for botluck ${row.id}:`, err);
    }
  }
}

async function runAnnounceTick(client: Client, db: Database.Database): Promise<void> {
  const due = botluckRepo.listAnnounceDue(db, new Date());
  for (const row of due) {
    try {
      const plan = botluckService.announceNextPlan(db, row.id);
      if (!plan) continue;
      await sendToChannel(client, plan.botluck.spawn_channel_id, {
        embeds: [buildSlotAnnouncement(plan.slot, plan.botluck.theme)],
      });
      botluckService.commitAnnounce(db, plan.botluck.id, plan.slot.slot_index);
    } catch (err) {
      console.error(`Announce tick error for botluck ${row.id}:`, err);
    }
  }
}

export function startBotluckScheduler(client: Client, db: Database.Database): NodeJS.Timeout {
  const tick = async () => {
    try {
      await runSpringTick(client, db);
      await runAnnounceTick(client, db);
    } catch (err) {
      console.error('botluck tick error:', err);
    }
  };
  return setInterval(tick, TICK_SECONDS * 1000);
}
