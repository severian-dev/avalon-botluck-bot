import { createClient } from './client.js';
import { loadEnv } from './config/loader.js';
import { initDatabase } from './database/connection.js';
import { registerEvents } from './events/index.js';
import { loadCommands } from './commands/index.js';
import { startSchedulers } from './scheduler/index.js';

const env = loadEnv();
const db = initDatabase();

const client = createClient();
await loadCommands(client);
registerEvents(client, db, env);

client.once('ready', () => {
  startSchedulers(client, db);
});

function shutdown(): void {
  console.log('Shutting down...');
  client.destroy();
  db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(env.DISCORD_TOKEN);
