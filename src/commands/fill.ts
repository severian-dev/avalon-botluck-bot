import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckService from '../services/botluckService.js';
import { BotluckError } from '../services/botluckService.js';
import {
  buildAssembled,
  buildCompletionAnnouncement,
  buildFillAnnouncement,
} from '../builders/embeds.js';
import { sendToChannel } from '../services/channelService.js';

export const data = new SlashCommandBuilder()
  .setName('fill')
  .setDescription('Claim a slot in the active botluck')
  .addStringOption((o) =>
    o.setName('slot').setDescription('Slot name (e.g. name, address, quirk)').setRequired(true),
  )
  .addStringOption((o) =>
    o.setName('value').setDescription('Your contribution for that slot').setRequired(true),
  )
  .setDMPermission(false);

export async function execute(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  if (!interaction.guildId) return;

  const slotName = interaction.options.getString('slot', true).trim();
  const value = interaction.options.getString('value', true);

  let result;
  try {
    result = botluckService.fill(db, interaction.guildId, interaction.user.id, slotName, value);
  } catch (err) {
    if (err instanceof BotluckError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({
    content: `✅ You claimed slot \`${slotName}\`.`,
    ephemeral: true,
  });

  await sendToChannel(interaction.client, result.botluck.spawn_channel_id, {
    embeds: [buildFillAnnouncement(result.slot, interaction.user.id)],
  });

  if (result.isComplete && result.assembledText !== null) {
    await sendToChannel(interaction.client, result.botluck.spawn_channel_id, {
      embeds: [buildCompletionAnnouncement()],
    });
    await sendToChannel(interaction.client, result.botluck.result_channel_id, {
      content: buildAssembled(result.assembledText),
    });
  }
}
