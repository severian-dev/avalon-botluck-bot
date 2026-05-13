import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import { isAdmin } from '../services/permissionService.js';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import * as slotRepo from '../database/repositories/slotRepo.js';
import * as guildConfigRepo from '../database/repositories/guildConfigRepo.js';
import { sendToChannel } from '../services/channelService.js';
import { buildSlotAnnouncement } from '../builders/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('reannounce')
  .setDescription('[Admin] Re-post the prompt for every open slot (recovers after a moved/deleted prompt)')
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

  const botluck = botluckRepo.getActive(db, interaction.guildId);
  if (!botluck) {
    await interaction.reply({ content: 'No active botluck.', ephemeral: true });
    return;
  }
  if (botluck.state !== 'running') {
    await interaction.reply({
      content: `Botluck is \`${botluck.state}\` — nothing to reannounce.`,
      ephemeral: true,
    });
    return;
  }

  const cfg = guildConfigRepo.get(db, interaction.guildId);
  const newSpawn = cfg.spawn_channel_id ?? botluck.spawn_channel_id;
  const newResult = cfg.result_channel_id ?? newSpawn;
  const channelChanged = newSpawn !== botluck.spawn_channel_id;
  if (channelChanged || newResult !== botluck.result_channel_id) {
    botluckRepo.setChannels(db, botluck.id, newSpawn, newResult);
  }

  const openSlots = slotRepo.listOpen(db, botluck.id);
  if (openSlots.length === 0) {
    await interaction.reply({
      content: channelChanged
        ? `Moved botluck to <#${newSpawn}>, but there are no open slots to reannounce.`
        : 'No open slots to reannounce.',
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
    return;
  }

  await interaction.reply({
    content: channelChanged
      ? `🔁 Moving botluck to <#${newSpawn}> and reposting ${openSlots.length} open slot prompt(s)…`
      : `🔁 Reposting ${openSlots.length} open slot prompt(s) in <#${newSpawn}>…`,
    ephemeral: true,
    allowedMentions: { parse: [] },
  });

  let reposted = 0;
  for (const slot of openSlots) {
    const messageId = await sendToChannel(interaction.client, newSpawn, {
      embeds: [buildSlotAnnouncement(slot, botluck.theme)],
    });
    if (messageId) {
      slotRepo.setAnnouncementMessageId(db, botluck.id, slot.slot_index, messageId);
      reposted++;
    }
  }

  await interaction.followUp({
    content: `✅ Reposted ${reposted}/${openSlots.length} prompt(s).`,
    ephemeral: true,
  });
}
