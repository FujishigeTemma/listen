import * as schema from "@listen/db";
import { Cloudflare } from "cloudflare";
import { drizzle } from "drizzle-orm/sqlite-proxy";

export interface D1HttpConfig {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export function createDB(config: D1HttpConfig) {
  const cf = new Cloudflare({ apiToken: config.apiToken });

  return drizzle(
    async (sql, params, method) => {
      const results = await Array.fromAsync(
        cf.d1.database.raw(config.databaseId, {
          account_id: config.accountId,
          sql,
          params: params.map(String),
        }),
      );

      const rows = results[0]?.results?.rows ?? [];

      if (method === "get") {
        return { rows: rows[0] ?? [] };
      }

      return { rows };
    },
    { schema },
  );
}

export type DB = ReturnType<typeof createDB>;
