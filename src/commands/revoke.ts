import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import { isAdmin } from '../services/permissionService.js';
import * as botluckService from '../services/botluckService.js';
import { BotluckError } from '../services/botluckService.js';
import { sendToChannel } from '../services/channelService.js';

export const data = new SlashCommandBuilder()
  .setName('revoke')
  .setDescription('[Admin] Reopen a slot, removing the current entry')
  .addStringOption((o) =>
    o.setName('slot').setDescription('Slot name to clear and reopen').setRequired(true),
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

  const slotName = interaction.options.getString('slot', true).trim();

  let result;
  try {
    result = botluckService.revoke(db, interaction.guildId, slotName);
  } catch (err) {
    if (err instanceof BotluckError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({
    content: `✅ Slot \`${slotName}\` reopened. <@${result.formerFiller}> can no longer claim that slot.`,
    ephemeral: true,
    allowedMentions: { users: [] },
  });

  await sendToChannel(interaction.client, result.botluck.spawn_channel_id, {
    content: `🔄 Slot \`${slotName}\` was revoked by an admin and is open again. Use \`/fill slot:${slotName} value:"…"\``,
  });
}
