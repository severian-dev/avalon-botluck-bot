import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import { isAdmin } from '../services/permissionService.js';
import * as botluckService from '../services/botluckService.js';
import { BotluckError } from '../services/botluckService.js';
import { buildCancellation } from '../builders/embeds.js';
import { sendToChannel } from '../services/channelService.js';
import { refreshPresence } from '../services/presenceService.js';

export const data = new SlashCommandBuilder()
  .setName('cancel')
  .setDescription('[Admin] Cancel the active botluck')
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

  let botluck;
  try {
    botluck = botluckService.cancel(db, interaction.guildId);
  } catch (err) {
    if (err instanceof BotluckError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({ content: '✅ Botluck cancelled.', ephemeral: true });

  if (botluck.state === 'running') {
    await sendToChannel(interaction.client, botluck.spawn_channel_id, {
      embeds: [buildCancellation()],
    });
  }

  refreshPresence(interaction.client, db);
}
