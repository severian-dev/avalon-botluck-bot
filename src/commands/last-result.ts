import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import { isAdmin } from '../services/permissionService.js';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import * as slotRepo from '../database/repositories/slotRepo.js';
import { renderTemplate } from '../services/templateService.js';
import { buildAssembled } from '../builders/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('last-result')
  .setDescription("[Admin] Re-post the assembled text of the most recent completed botluck")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
  .setDMPermission(false);

export async function execute(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  if (!interaction.guildId) return;
  if (!isAdmin(interaction, db)) {
    await interaction.reply({ content: '⛔ Admin permission required.', ephemeral: true });
    return;
  }

  const botluck = botluckRepo.getLastCompleted(db, interaction.guildId);
  if (!botluck) {
    await interaction.reply({
      content: 'No completed botluck on record for this server yet.',
      ephemeral: true,
    });
    return;
  }

  const slots = slotRepo.listForBotluck(db, botluck.id);
  const values: Record<string, string> = {};
  for (const s of slots) {
    if (s.value !== null) values[s.slot_name] = s.value;
  }
  const assembled = renderTemplate(botluck.template, values);

  const embeds = buildAssembled(assembled);
  await interaction.reply({
    embeds: [embeds[0]],
    allowedMentions: { parse: [] },
  });
  for (let i = 1; i < embeds.length; i++) {
    await interaction.followUp({
      embeds: [embeds[i]],
      allowedMentions: { parse: [] },
    });
  }
}
