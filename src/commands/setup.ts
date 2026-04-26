import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import * as guildConfigRepo from '../database/repositories/guildConfigRepo.js';
import { isAdmin } from '../services/permissionService.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('[Admin] Configure botluck channels and timing')
  .addChannelOption((o) =>
    o
      .setName('channel')
      .setDescription('Channel where the botluck springs and slots are filled')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false),
  )
  .addChannelOption((o) =>
    o
      .setName('result_channel')
      .setDescription('Channel where the assembled text is posted (defaults to spawn channel)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false),
  )
  .addIntegerOption((o) =>
    o
      .setName('spring_delay_hours')
      .setDescription('Hours between /prime and the spring (default 24)')
      .setMinValue(1)
      .setMaxValue(720)
      .setRequired(false),
  )
  .addIntegerOption((o) =>
    o
      .setName('slot_gap_min_seconds')
      .setDescription('Minimum gap between slot prompts (default 15)')
      .setMinValue(1)
      .setMaxValue(3600)
      .setRequired(false),
  )
  .addIntegerOption((o) =>
    o
      .setName('slot_gap_max_seconds')
      .setDescription('Maximum gap between slot prompts (default 30)')
      .setMinValue(1)
      .setMaxValue(3600)
      .setRequired(false),
  )
  .addIntegerOption((o) =>
    o
      .setName('reminder_after_seconds')
      .setDescription('Reminder threshold when no slot has been filled (default 300; 0 disables)')
      .setMinValue(0)
      .setMaxValue(86400)
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
  .setDMPermission(false);

export async function execute(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  if (!interaction.guildId) return;
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ Manage Guild permission required.', ephemeral: true });
    return;
  }

  const updates: string[] = [];

  const channel = interaction.options.getChannel('channel');
  if (channel) {
    guildConfigRepo.set(db, interaction.guildId, 'spawn_channel_id', channel.id);
    updates.push(`spawn channel = <#${channel.id}>`);
  }

  const resultChannel = interaction.options.getChannel('result_channel');
  if (resultChannel) {
    guildConfigRepo.set(db, interaction.guildId, 'result_channel_id', resultChannel.id);
    updates.push(`result channel = <#${resultChannel.id}>`);
  }

  const springDelay = interaction.options.getInteger('spring_delay_hours');
  if (springDelay !== null) {
    guildConfigRepo.set(db, interaction.guildId, 'spring_delay_hours', springDelay);
    updates.push(`spring_delay_hours = ${springDelay}`);
  }

  const gapMin = interaction.options.getInteger('slot_gap_min_seconds');
  if (gapMin !== null) {
    guildConfigRepo.set(db, interaction.guildId, 'slot_gap_min_seconds', gapMin);
    updates.push(`slot_gap_min_seconds = ${gapMin}`);
  }

  const gapMax = interaction.options.getInteger('slot_gap_max_seconds');
  if (gapMax !== null) {
    guildConfigRepo.set(db, interaction.guildId, 'slot_gap_max_seconds', gapMax);
    updates.push(`slot_gap_max_seconds = ${gapMax}`);
  }

  const reminderAfter = interaction.options.getInteger('reminder_after_seconds');
  if (reminderAfter !== null) {
    guildConfigRepo.set(db, interaction.guildId, 'reminder_after_seconds', reminderAfter);
    updates.push(`reminder_after_seconds = ${reminderAfter}`);
  }

  if (updates.length === 0) {
    const cfg = guildConfigRepo.get(db, interaction.guildId);
    const reminderLine =
      cfg.reminder_after_seconds === 0
        ? '_disabled_'
        : `${cfg.reminder_after_seconds}s after last fill if channel is active`;
    await interaction.reply({
      content:
        '**Current configuration**\n' +
        `• spawn channel: ${cfg.spawn_channel_id ? `<#${cfg.spawn_channel_id}>` : '_unset_'}\n` +
        `• result channel: ${cfg.result_channel_id ? `<#${cfg.result_channel_id}>` : '_falls back to spawn_'}\n` +
        `• spring delay: ${cfg.spring_delay_hours}h\n` +
        `• slot gap: ${cfg.slot_gap_min_seconds}–${cfg.slot_gap_max_seconds}s\n` +
        `• reminder: ${reminderLine}\n\n` +
        'Pass options to update.',
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
    return;
  }

  await interaction.reply({
    content: `✅ Updated:\n${updates.map((u) => `• ${u}`).join('\n')}`,
    ephemeral: true,
    allowedMentions: { parse: [] },
  });
}
