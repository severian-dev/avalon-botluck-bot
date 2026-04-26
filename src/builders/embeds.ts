import { EmbedBuilder, codeBlock } from 'discord.js';
import type { BotluckRow } from '../database/repositories/botluckRepo.js';
import type { SlotRow } from '../database/repositories/slotRepo.js';

const COLOR_PRIMED = 0x9b59b6;
const COLOR_RUNNING = 0xf1c40f;
const COLOR_COMPLETE = 0x2ecc71;
const COLOR_CANCELLED = 0x95a5a6;

export function buildSpringAnnouncement(
  botluck: BotluckRow,
  firstSlot: SlotRow,
  totalSlots: number,
): EmbedBuilder {
  const lines = [
    `A new ${totalSlots}-slot botluck is being assembled. First come, first served — one slot per person.`,
    `Once every slot is filled, your contributions will be assembled into a **character card**.`,
  ];
  if (botluck.theme) {
    lines.push('', `🎨 **Theme:** ${botluck.theme}`);
  }
  lines.push(
    '',
    `**First slot:** \`${firstSlot.slot_name}\``,
    `Be the first to claim it with:`,
    codeBlock(`/fill slot:${firstSlot.slot_name} value:"…"`),
  );

  return new EmbedBuilder()
    .setColor(COLOR_RUNNING)
    .setTitle('🍲 A botluck has started!')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Each slot opens after the previous one is filled.' })
    .setTimestamp(new Date());
}

export function buildSlotAnnouncement(slot: SlotRow, theme: string | null): EmbedBuilder {
  const lines: string[] = [];
  if (theme) lines.push(`🎨 **Theme:** ${theme}`, '');
  lines.push(`Be the first to claim it with:`, codeBlock(`/fill slot:${slot.slot_name} value:"…"`));

  return new EmbedBuilder()
    .setColor(COLOR_RUNNING)
    .setTitle(`📝 Next slot: \`${slot.slot_name}\``)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date());
}

export function buildFillAnnouncement(slot: SlotRow, fillerId: string): EmbedBuilder {
  const value = slot.value ?? '';
  return new EmbedBuilder()
    .setColor(COLOR_RUNNING)
    .setDescription(
      `✅ Slot \`${slot.slot_name}\` filled by <@${fillerId}>:\n> ${escapeForQuote(value)}`,
    );
}

export function buildCompletionAnnouncement(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_COMPLETE)
    .setTitle('🎉 The botluck is complete!')
    .setDescription('Posting the assembled result now…');
}

export function buildAssembled(text: string): string {
  return `🍲 **Botluck served:**\n>>> ${text}`;
}

export function buildCancellation(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_CANCELLED)
    .setTitle('🚫 Botluck cancelled.')
    .setDescription('An admin called it off. Re-prime to start fresh.');
}

export function buildStatus(botluck: BotluckRow, slots: SlotRow[]): EmbedBuilder {
  const filled = slots.filter((s) => s.filled_by !== null).length;
  const lines: string[] = [];
  if (botluck.theme) lines.push(`🎨 **Theme:** ${botluck.theme}`, '');
  for (const s of slots) {
    if (s.filled_by) lines.push(`✅ \`${s.slot_name}\` — <@${s.filled_by}>: ${truncate(s.value ?? '', 100)}`);
    else if (s.announced_at) lines.push(`⏳ \`${s.slot_name}\` — open`);
    else lines.push(`🔒 \`${s.slot_name}\` — not yet open`);
  }
  const color = botluck.state === 'primed' ? COLOR_PRIMED : COLOR_RUNNING;
  const title =
    botluck.state === 'primed'
      ? '🥣 Botluck primed (waiting to spring)'
      : `🍲 Botluck in progress (${filled}/${slots.length})`;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setFooter({
      text:
        botluck.state === 'primed'
          ? `Primed by ${botluck.primed_by} · springs ${botluck.spring_at}`
          : `Primed by ${botluck.primed_by}`,
    });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// Newlines in the user's value would break the markdown blockquote prefix on subsequent lines.
function escapeForQuote(s: string): string {
  return s.replace(/\n/g, '\n> ');
}
