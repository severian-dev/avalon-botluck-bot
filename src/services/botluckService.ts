import type Database from 'better-sqlite3';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import * as slotRepo from '../database/repositories/slotRepo.js';
import * as banRepo from '../database/repositories/banRepo.js';
import * as guildConfigRepo from '../database/repositories/guildConfigRepo.js';
import { parseTemplate, renderTemplate } from './templateService.js';
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

export function fill(
  db: Database.Database,
  guildId: string,
  userId: string,
  slotName: string,
  value: string,
): FillSuccess {
  const cfg = guildConfigRepo.get(db, guildId);
  const botluck = botluckRepo.getActive(db, guildId);
  if (!botluck) throw new BotluckError('No active botluck right now.', 'NO_ACTIVE');
  if (botluck.state !== 'running') {
    throw new BotluckError('The botluck has not started yet.', 'NOT_RUNNING');
  }

  const slot = slotRepo.getByName(db, botluck.id, slotName);
  if (!slot) {
    throw new BotluckError(`No slot named "${slotName}" in this botluck.`, 'UNKNOWN_SLOT');
  }
  const existingFill = slotRepo.findFillerInBotluck(db, botluck.id, userId);
  if (existingFill) {
    throw new BotluckError(
      `You already filled slot "${existingFill.slot_name}" in this botluck.`,
      'ONE_PER_BOTLUCK',
    );
  }
  if (banRepo.isBanned(db, botluck.id, slot.slot_index, userId)) {
    throw new BotluckError(`You can no longer fill slot "${slotName}".`, 'BANNED');
  }
  if (slot.announced_at === null) {
    throw new BotluckError(`Slot "${slotName}" hasn't opened yet.`, 'NOT_ANNOUNCED');
  }
  if (slot.filled_by !== null) {
    throw new BotluckError(
      `Slot "${slotName}" was already filled by <@${slot.filled_by}>.`,
      'ALREADY_FILLED',
    );
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) throw new BotluckError('Value cannot be empty.', 'EMPTY_VALUE');
  if (trimmed.length > 500) throw new BotluckError('Value too long (max 500 chars).', 'TOO_LONG');

  let result: FillSuccess | null = null;

  const tx = db.transaction(() => {
    const claimed = slotRepo.fillIfOpen(db, botluck.id, slot.slot_index, userId, trimmed);
    if (!claimed) {
      throw new BotluckError(`Someone else just claimed slot "${slotName}".`, 'RACE_LOST');
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
      result = {
        botluck: updatedBotluck,
        slot: updatedSlot,
        totalSlots,
        filledCount,
        isComplete: true,
        assembledText: assembled,
        nextSlot: null,
        nextAnnounceAt: null,
      };
      return;
    }

    // Not complete. If there's a next slot to announce, schedule it.
    const slots = JSON.parse(botluck.slots_json) as string[];
    let nextIndex: number | null = botluck.next_announce_index;

    // Discover the lowest-index slot that hasn't been announced yet.
    if (nextIndex === null || nextIndex >= slots.length) {
      // All slots have been announced; just wait for fills (no schedule change).
      botluckRepo.setNextAnnounce(db, botluck.id, null, null);
      const updatedSlot = slotRepo.getByIndex(db, botluck.id, slot.slot_index)!;
      const updatedBotluck = botluckRepo.getById(db, botluck.id)!;
      result = {
        botluck: updatedBotluck,
        slot: updatedSlot,
        totalSlots,
        filledCount,
        isComplete: false,
        assembledText: null,
        nextSlot: null,
        nextAnnounceAt: null,
      };
      return;
    }

    const gap = randomGapSeconds(cfg.slot_gap_min_seconds, cfg.slot_gap_max_seconds);
    const at = new Date(nowMs() + gap * 1000);
    botluckRepo.setNextAnnounce(db, botluck.id, nextIndex, at);

    const nextSlotRow = slotRepo.getByIndex(db, botluck.id, nextIndex);
    const updatedSlot = slotRepo.getByIndex(db, botluck.id, slot.slot_index)!;
    const updatedBotluck = botluckRepo.getById(db, botluck.id)!;
    result = {
      botluck: updatedBotluck,
      slot: updatedSlot,
      totalSlots,
      filledCount,
      isComplete: false,
      assembledText: null,
      nextSlot: nextSlotRow,
      nextAnnounceAt: at,
    };
  });

  tx();

  if (!result) throw new BotluckError('Fill transaction did not produce a result.', 'INTERNAL');
  return result;
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
