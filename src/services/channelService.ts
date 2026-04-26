import type { Client, MessageCreateOptions } from 'discord.js';

export async function sendToChannel(
  client: Client,
  channelId: string,
  payload: MessageCreateOptions,
): Promise<string | null> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      console.error(`Channel ${channelId} is not text-sendable.`);
      return null;
    }
    const allowedMentions = payload.allowedMentions ?? { parse: [] };
    const message = await channel.send({ ...payload, allowedMentions });
    return message.id;
  } catch (err) {
    console.error(`Failed to send to channel ${channelId}:`, err);
    return null;
  }
}
