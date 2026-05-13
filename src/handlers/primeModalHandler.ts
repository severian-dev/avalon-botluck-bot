import { type ModalSubmitInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import * as botluckService from '../services/botluckService.js';
import { BotluckError } from '../services/botluckService.js';
import { TemplateParseError } from '../services/templateService.js';
import { isAdmin } from '../services/permissionService.js';
import { refreshPresence } from '../services/presenceService.js';
import { parseBlindFlag } from '../builders/primeModal.js';
import {
  PRIME_MODAL,
  PRIME_MODAL_BLIND,
  PRIME_MODAL_TEMPLATE,
  PRIME_MODAL_THEME,
} from '../types/customIds.js';

export async function handle(
  interaction: ModalSubmitInteraction,
  db: Database.Database,
): Promise<boolean> {
  if (interaction.customId !== PRIME_MODAL) return false;
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    return true;
  }
  if (!isAdmin(interaction, db)) {
    await interaction.reply({ content: '⛔ Admin permission required.', ephemeral: true });
    return true;
  }

  const raw = interaction.fields.getTextInputValue(PRIME_MODAL_TEMPLATE);
  const themeRaw = interaction.fields.getTextInputValue(PRIME_MODAL_THEME);
  const theme = themeRaw.trim().length > 0 ? themeRaw.trim() : null;
  const blind = parseBlindFlag(interaction.fields.getTextInputValue(PRIME_MODAL_BLIND));

  try {
    const botluck = botluckService.prime(
      db,
      interaction.guildId,
      interaction.user.id,
      raw,
      theme,
      blind,
    );
    const slots = JSON.parse(botluck.slots_json) as string[];
    const springAt = new Date(botluck.spring_at);
    const unix = Math.floor(springAt.getTime() / 1000);
    await interaction.reply({
      content:
        `✅ Botluck primed${blind ? ' **(blind mode)**' : ''} with ${slots.length} slot(s): \`${slots.join('`, `')}\`\n` +
        `It will spring <t:${unix}:R> in <#${botluck.spawn_channel_id}>.`,
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
    refreshPresence(interaction.client, db);
  } catch (err) {
    if (err instanceof TemplateParseError) {
      await interaction.reply({ content: `⚠️ Template error: ${err.message}`, ephemeral: true });
      return true;
    }
    if (err instanceof BotluckError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return true;
    }
    throw err;
  }
  return true;
}
