import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import { isAdmin } from '../services/permissionService.js';
import { buildPrimeModal } from '../builders/primeModal.js';
import * as botluckService from '../services/botluckService.js';
import * as guildConfigRepo from '../database/repositories/guildConfigRepo.js';

export const data = new SlashCommandBuilder()
  .setName('prime')
  .setDescription('[Admin] Prime a botluck with a fill-in-the-blanks template')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
  .setDMPermission(false);

export async function execute(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  if (!interaction.guildId) return;
  if (!isAdmin(interaction, db)) {
    await interaction.reply({ content: '⛔ Manage Guild permission required.', ephemeral: true });
    return;
  }

  const cfg = guildConfigRepo.get(db, interaction.guildId);
  if (!cfg.spawn_channel_id) {
    await interaction.reply({
      content: '⚠️ No spawn channel configured. Run `/setup channel:#…` first.',
      ephemeral: true,
    });
    return;
  }

  const existing = botluckService.snapshot(db, interaction.guildId);
  if (existing) {
    await interaction.reply({
      content:
        existing.botluck.state === 'primed'
          ? '⚠️ A botluck is already primed and waiting to spring. Use `/cancel` first to start over.'
          : '⚠️ A botluck is already running. Use `/cancel` first to start over.',
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildPrimeModal());
}
