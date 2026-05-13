import type Database from 'better-sqlite3';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import * as slotRepo from '../database/repositories/slotRepo.js';
import * as banRepo from '../database/repositories/banRepo.js';
import * as guildConfigRepo from '../database/repositories/guildConfigRepo.js';
import { parseTemplate, renderTemplate } from './templateService.js';
import { parseSqliteDateMs } from '../utils/sqliteDate.js';
import type { BotluckRow } from '../database/repositories/botluckRepo.js';
import type { SlotRow } from '../database/repositories/slotRepo.js';

export class BotluckError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

function nowMs(): number {
  return Date.now();
}

function randomGapSeconds(minSec: number, maxSec: number): number {
  const lo = Math.min(minSec, maxSec);
  const hi = Math.max(minSec, maxSec);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export function prime(
  db: Database.Database,
  guildId: string,
  primedBy: string,
  rawTemplate: string,
  theme: string | null = null,
  blind = false,
): BotluckRow {
  const cfg = guildConfigRepo.get(db, guildId);
  if (!cfg.spawn_channel_id) {
    throw new BotluckError(
      'No spawn channel configured. An admin must run `/setup channel:#…` first.',
      'NO_SPAWN_CHANNEL',
    );
  }

  const existing = botluckRepo.getActive(db, guildId);
  if (existing) {
    throw new BotluckError(
      existing.state === 'primed'
        ? 'A botluck is already primed and waiting to spring.'
        : 'A botluck is already running.',
      'ALREADY_ACTIVE',
    );
  }

  const parsed = parseTemplate(rawTemplate);
  const springAt = new Date(nowMs() + cfg.spring_delay_hours * 3600 * 1000);

  return botluckRepo.create(db, {
    guildId,
    template: parsed.template,
    slots: parsed.slots,
    spawnChannelId: cfg.spawn_channel_id,
    resultChannelId: cfg.result_channel_id ?? cfg.spawn_channel_id,
    primedBy,
    springAt,
    theme,
    blind,
  });
}

export interface SpringResult {
  botluck: BotluckRow;
  firstSlot: SlotRow;
  hasMoreSlots: boolean;
}

/**
 * Mark the botluck as running and the first slot as announced.
 * Caller is responsible for posting the announcement and then calling commitSpring with the message id.
 */
export function springPlan(db: Database.Database, botluckId: number): SpringResult {
  const botluck = botluckRepo.getById(db, botluckId);
  if (!botluck) throw new BotluckError('Botluck vanished.', 'NOT_FOUND');
  if (botluck.state !== 'primed') {
    throw new BotluckError(`Botluck is in state '${botluck.state}', cannot spring.`, 'BAD_STATE');
  }
  const firstSlot = slotRepo.getByIndex(db, botluckId, 0);
  if (!firstSlot) throw new BotluckError('Botluck has no slots.', 'NO_SLOTS');
  const slots = JSON.parse(botluck.slots_json) as string[];
  return { botluck, firstSlot, hasMoreSlots: slots.length > 1 };
}

export function commitSpring(
  db: Database.Database,
  botluckId: number,
  announcementMessageId: string,
): void {
  const tx = db.transaction(() => {
    const botluck = botluckRepo.getById(db, botluckId);
    if (!botluck) return;
    const slots = JSON.parse(botluck.slots_json) as string[];
    botluckRepo.markSprung(db, botluckId, announcementMessageId);
    slotRepo.markAnnounced(db, botluckId, 0);
    botluckRepo.setNextAnnounce(db, botluckId, slots.length > 1 ? 1 : null, null);
  });
  tx();
}

export interface FillSuccess {
  botluck: BotluckRow;
  slot: SlotRow;
  totalSlots: number;
  filledCount: number;
  isComplete: boolean;
  assembledText: string | null;
  nextSlot: SlotRow | null;
  nextAnnounceAt: Date | null;
}

export type FillSkipReason =
  | 'no_open_slot_for_reference'
  | 'banned'
  | 'on_cooldown'
  | 'empty'
  | 'too_long'
  | 'race_lost';

export type FillOutcome =
  | { ok: true; result: FillSuccess }
  | { ok: false; reason: FillSkipReason };

/**
 * Submission entry point: a user replied to a slot-prompt message.
 * Looks up the open slot by the replied-to message id, applies the 6h-per-user cooldown,
 * and atomically claims the slot. Returns ok=false silently for any failure;
 * the messageCreate handler treats all non-ok outcomes as "do nothing".
 */
export function fillByReply(
  db: Database.Database,
  refMessageId: string,
  userId: string,
  rawValue: string,
): FillOutcome {
  const slot = slotRepo.findOpenByMessageRef(db, refMessageId);
  if (!slot) return { ok: false, reason: 'no_open_slot_for_reference' };

  const botluck = botluckRepo.getById(db, slot.botluck_id);
  if (!botluck || botluck.state !== 'running') {
    return { ok: false, reason: 'no_open_slot_for_reference' };
  }

  if (banRepo.isBanned(db, botluck.id, slot.slot_index, userId)) {
    return { ok: false, reason: 'banned' };
  }

  const cfg = guildConfigRepo.get(db, botluck.guild_id);
  const lastFillIso = slotRepo.lastFillForUserInBotluck(db, botluck.id, userId);
  if (lastFillIso !== null) {
    const elapsedMs = nowMs() - parseSqliteDateMs(lastFillIso);
    const cooldownMs = cfg.submission_cooldown_hours * 3600 * 1000;
    if (elapsedMs < cooldownMs) return { ok: false, reason: 'on_cooldown' };
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (trimmed.length > 500) return { ok: false, reason: 'too_long' };

  let outcome: FillOutcome | null = null;

  const tx = db.transaction(() => {
    const claimed = slotRepo.fillIfOpen(db, botluck.id, slot.slot_index, userId, trimmed);
    if (!claimed) {
      outcome = { ok: false, reason: 'race_lost' };
      return;
    }

    const totalSlots = JSON.parse(botluck.slots_json).length as number;
    const filledCount = slotRepo.countFilled(db, botluck.id);
    const isComplete = filledCount >= totalSlots;

    if (isComplete) {
      botluckRepo.markComplete(db, botluck.id);
      const filledRows = slotRepo.listForBotluck(db, botluck.id);
      const values: Record<string, string> = {};
      for (const r of filledRows) {
        if (r.value !== null) values[r.slot_name] = r.value;
      }
      const assembled = renderTemplate(botluck.template, values);
      const updatedSlot = slotRepo.getByIndex(db, botluck.id, slot.slot_index)!;
      const updatedBotluck = botluckRepo.getById(db, botluck.id)!;
      outcome = {
        ok: true,
        result: {
          botluck: updatedBotluck,
          slot: updatedSlot,
          totalSlots,
          filledCount,
          isComplete: true,
          assembledText: assembled,
          nextSlot: null,
          nextAnnounceAt: null,
        },
      };
      return;
    }

    const slots = JSON.parse(botluck.slots_json) as string[];
    const nextIndex = botluck.next_announce_index;
    let nextSlotRow: SlotRow | null = null;
    let at: Date | null = null;
    if (nextIndex !== null && nextIndex < slots.length) {
      const gap = randomGapSeconds(cfg.slot_gap_min_seconds, cfg.slot_gap_max_seconds);
      at = new Date(nowMs() + gap * 1000);
      botluckRepo.setNextAnnounce(db, botluck.id, nextIndex, at);
      nextSlotRow = slotRepo.getByIndex(db, botluck.id, nextIndex);
    } else {
      botluckRepo.setNextAnnounce(db, botluck.id, null, null);
    }

    const updatedSlot = slotRepo.getByIndex(db, botluck.id, slot.slot_index)!;
    const updatedBotluck = botluckRepo.getById(db, botluck.id)!;
    outcome = {
      ok: true,
      result: {
        botluck: updatedBotluck,
        slot: updatedSlot,
        totalSlots,
        filledCount,
        isComplete: false,
        assembledText: null,
        nextSlot: nextSlotRow,
        nextAnnounceAt: at,
      },
    };
  });

  tx();

  if (!outcome) return { ok: false, reason: 'race_lost' };
  return outcome;
}

export interface AnnounceResult {
  botluck: BotluckRow;
  slot: SlotRow;
  hasMoreSlots: boolean;
}

/** Caller-driven slot announcement. Returns the slot to announce; commit after posting. */
export function announceNextPlan(
  db: Database.Database,
  botluckId: number,
): AnnounceResult | null {
  const botluck = botluckRepo.getById(db, botluckId);
  if (!botluck || botluck.state !== 'running') return null;
  if (botluck.next_announce_index === null) return null;
  const slot = slotRepo.getByIndex(db, botluckId, botluck.next_announce_index);
  if (!slot) return null;
  const slots = JSON.parse(botluck.slots_json) as string[];
  return {
    botluck,
    slot,
    hasMoreSlots: botluck.next_announce_index + 1 < slots.length,
  };
}

export function commitAnnounce(db: Database.Database, botluckId: number, slotIndex: number): void {
  const tx = db.transaction(() => {
    const botluck = botluckRepo.getById(db, botluckId);
    if (!botluck) return;
    const slots = JSON.parse(botluck.slots_json) as string[];
    slotRepo.markAnnounced(db, botluckId, slotIndex);
    const next = slotIndex + 1;
    botluckRepo.setNextAnnounce(db, botluckId, next < slots.length ? next : null, null);
  });
  tx();
}

export interface RevokeSuccess {
  botluck: BotluckRow;
  slot: SlotRow;
  formerFiller: string;
}

export function revoke(
  db: Database.Database,
  guildId: string,
  slotName: string,
): RevokeSuccess {
  const botluck = botluckRepo.getActive(db, guildId);
  if (!botluck) throw new BotluckError('No active botluck right now.', 'NO_ACTIVE');
  if (botluck.state !== 'running') {
    throw new BotluckError('Botluck has not started yet.', 'NOT_RUNNING');
  }

  const slot = slotRepo.getByName(db, botluck.id, slotName);
  if (!slot) {
    throw new BotluckError(`No slot named "${slotName}" in this botluck.`, 'UNKNOWN_SLOT');
  }
  if (slot.filled_by === null) {
    throw new BotluckError(`Slot "${slotName}" isn't filled.`, 'NOT_FILLED');
  }

  const formerFiller = slot.filled_by;

  const tx = db.transaction(() => {
    banRepo.add(db, botluck.id, slot.slot_index, formerFiller);
    slotRepo.clear(db, botluck.id, slot.slot_index);
  });
  tx();

  const updatedSlot = slotRepo.getByName(db, botluck.id, slotName)!;
  return { botluck, slot: updatedSlot, formerFiller };
}

export function cancel(db: Database.Database, guildId: string): BotluckRow {
  const botluck = botluckRepo.getActive(db, guildId);
  if (!botluck) throw new BotluckError('No active botluck to cancel.', 'NO_ACTIVE');
  botluckRepo.markCancelled(db, botluck.id);
  return botluck;
}

export interface ReminderPlan {
  botluck: BotluckRow;
  openSlots: SlotRow[];
}

/** Returns botlucks where a reminder should fire right now, plus the open slots to nudge about. */
export function planRemindersDue(db: Database.Database, now: Date): ReminderPlan[] {
  const out: ReminderPlan[] = [];
  const running = botluckRepo.listRunning(db);
  for (const botluck of running) {
    const cfg = guildConfigRepo.get(db, botluck.guild_id);
    const thresholdMs = cfg.reminder_after_seconds * 1000;
    if (thresholdMs <= 0) continue;

    const openSlots = slotRepo.listOpen(db, botluck.id);
    if (openSlots.length === 0) continue;

    const sprungAt = botluck.sprung_at ? parseSqliteDateMs(botluck.sprung_at) : 0;
    const lastFillIso = slotRepo.lastFillAt(db, botluck.id);
    const lastFillMs = lastFillIso ? parseSqliteDateMs(lastFillIso) : 0;
    const lastReminderMs = botluck.last_reminder_at
      ? parseSqliteDateMs(botluck.last_reminder_at)
      : 0;
    const lastChannelMs = botluck.last_channel_message_at
      ? parseSqliteDateMs(botluck.last_channel_message_at)
      : 0;

    const referenceMs = Math.max(sprungAt, lastFillMs, lastReminderMs);
    if (now.getTime() - referenceMs < thresholdMs) continue;
    // Channel must have seen a non-bot message after the last progress/reminder.
    if (lastChannelMs <= referenceMs) continue;

    out.push({ botluck, openSlots });
  }
  return out;
}

export interface BotluckSnapshot {
  botluck: BotluckRow;
  slots: SlotRow[];
  totalSlots: number;
  filledCount: number;
}

export function snapshot(db: Database.Database, guildId: string): BotluckSnapshot | null {
  const botluck = botluckRepo.getActive(db, guildId);
  if (!botluck) return null;
  const slots = slotRepo.listForBotluck(db, botluck.id);
  return {
    botluck,
    slots,
    totalSlots: slots.length,
    filledCount: slots.filter((s) => s.filled_by !== null).length,
  };
}
