import type { Config } from 'drizzle-kit';

export default {
  schema: './src/core/storage/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './clisys.db',
  },
} satisfies Config;
