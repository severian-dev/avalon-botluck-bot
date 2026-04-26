import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckService from '../services/botluckService.js';
import { buildStatus } from '../builders/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show the current botluck status')
  .setDMPermission(false);

export async function execute(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  if (!interaction.guildId) return;
  const snap = botluckService.snapshot(db, interaction.guildId);
  if (!snap) {
    await interaction.reply({ content: 'No botluck is active right now.', ephemeral: true });
    return;
  }
  await interaction.reply({
    embeds: [buildStatus(snap.botluck, snap.slots)],
    ephemeral: true,
    allowedMentions: { users: [] },
  });
}
