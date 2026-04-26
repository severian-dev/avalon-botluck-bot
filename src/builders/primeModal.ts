import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  PRIME_MODAL,
  PRIME_MODAL_TEMPLATE,
  PRIME_MODAL_THEME,
} from '../types/customIds.js';

export function buildPrimeModal(): ModalBuilder {
  const template = new TextInputBuilder()
    .setCustomId(PRIME_MODAL_TEMPLATE)
    .setLabel('Template (use {slot} placeholders)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('A wandering {profession} named {name} from {address}, known for {quirk}.')
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(4000);

  const theme = new TextInputBuilder()
    .setCustomId(PRIME_MODAL_THEME)
    .setLabel('Theme (optional, shown in announcements)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. wandering medieval rogue, cyberpunk barista')
    .setRequired(false)
    .setMaxLength(120);

  return new ModalBuilder()
    .setCustomId(PRIME_MODAL)
    .setTitle('Prime a botluck')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(template),
      new ActionRowBuilder<TextInputBuilder>().addComponents(theme),
    );
}
