import { z } from 'zod';

export const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  GUILD_ID: z.string().min(1, 'GUILD_ID is required'),
  OWNER_DISCORD_ID: z.string().min(1, 'OWNER_DISCORD_ID is required'),
  DATABASE_PATH: z.string().optional(),
});

export type BotEnv = z.infer<typeof envSchema>;
