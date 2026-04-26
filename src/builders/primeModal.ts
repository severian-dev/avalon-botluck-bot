import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { PRIME_MODAL, PRIME_MODAL_TEMPLATE } from '../types/customIds.js';

export function buildPrimeModal(): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId(PRIME_MODAL_TEMPLATE)
    .setLabel('Template (use {slot} placeholders)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('A wandering {profession} named {name} from {address}, known for {quirk}.')
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(4000);

  return new ModalBuilder()
    .setCustomId(PRIME_MODAL)
    .setTitle('Prime a botluck')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}
