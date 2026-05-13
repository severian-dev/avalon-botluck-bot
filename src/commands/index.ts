import type { BotClient, Command } from '../client.js';
import * as setup from './setup.js';
import * as prime from './prime.js';
import * as revoke from './revoke.js';
import * as cancel from './cancel.js';
import * as status from './status.js';
import * as view from './view.js';
import * as testSpring from './test-spring.js';

const commands: Command[] = [
  setup,
  prime,
  revoke,
  cancel,
  status,
  view,
  testSpring,
] as unknown as Command[];

export async function loadCommands(client: BotClient): Promise<void> {
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
}

export function getCommandData(): unknown[] {
  return commands.map((c) => c.data.toJSON());
}
