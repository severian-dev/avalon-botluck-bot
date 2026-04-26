import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import type { BotEnv } from '../config/schema.js';
import * as botluckRepo from '../database/repositories/botluckRepo.js';
import { performSpring } from '../scheduler/botluckScheduler.js';

export const data = new SlashCommandBuilder()
  .setName('test-spring')
  .setDescription('[Owner] Spring the currently primed botluck immediately (testing only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
  .setDMPermission(false);

export async function execute(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
  env: BotEnv,
): Promise<void> {
  if (!interaction.guildId) return;
  if (interaction.user.id !== env.OWNER_DISCORD_ID) {
    await interaction.reply({ content: '⛔ Owner-only.', ephemeral: true });
    return;
  }

  const active = botluckRepo.getActive(db, interaction.guildId);
  if (!active) {
    await interaction.reply({ content: '⚠️ No active botluck.', ephemeral: true });
    return;
  }
  if (active.state !== 'primed') {
    await interaction.reply({
      content: `⚠️ Botluck is in state \`${active.state}\`, not \`primed\`.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ content: '🐇 Springing now…', ephemeral: true });

  try {
    const sprung = await performSpring(interaction.client, db, active.id);
    if (!sprung) {
      await interaction.followUp({
        content: '⚠️ Spring failed (channel unreachable). Botluck still primed.',
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error('test-spring failed:', err);
    await interaction.followUp({
      content: `⚠️ Spring threw: ${err instanceof Error ? err.message : String(err)}`,
      ephemeral: true,
    });
  }
}
