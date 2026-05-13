import { Client, Collection, GatewayIntentBits } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from 'better-sqlite3';
import type { BotEnv } from './config/schema.js';

export interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction, db: Database.Database, env: BotEnv): Promise<void>;
}

export interface BotClient extends Client {
  commands: Collection<string, Command>;
}

export function createClient(): BotClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  }) as BotClient;

  client.commands = new Collection();
  return client;
}
