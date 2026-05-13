import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import { isAdmin } from '../services/permissionService.js';
import * as botluckService from '../services/botluckService.js';
import { buildAdminView } from '../builders/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('view')
  .setDescription('[Admin] Show all slots, entries, and submitters in the current channel')
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

  const snap = botluckService.snapshot(db, interaction.guildId);
  if (!snap) {
    await interaction.reply({ content: 'No active botluck.', ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [buildAdminView(snap.botluck, snap.slots)],
    allowedMentions: { users: [] },
  });
}
