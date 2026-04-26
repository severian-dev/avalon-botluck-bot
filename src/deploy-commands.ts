import { REST, Routes } from 'discord.js';
import { getCommandData } from './commands/index.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID environment variables.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
const commands = getCommandData();

try {
  console.log(`Registering ${commands.length} commands for guild ${guildId}...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('Commands registered successfully.');
} catch (error) {
  console.error('Failed to register commands:', error);
  process.exit(1);
}
