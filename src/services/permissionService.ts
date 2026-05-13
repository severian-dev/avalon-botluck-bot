import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import type Database from 'better-sqlite3';
import * as guildConfigRepo from '../database/repositories/guildConfigRepo.js';

export function isAdmin(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  db?: Database.Database,
): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;

  if (!db || !interaction.guildId) return false;
  const cfg = guildConfigRepo.get(db, interaction.guildId);
  if (!cfg.admin_role_id) return false;

  const roles = interaction.member?.roles;
  if (!roles) return false;
  if (Array.isArray(roles)) return roles.includes(cfg.admin_role_id);
  if ('cache' in roles) return roles.cache.has(cfg.admin_role_id);
  return false;
}
