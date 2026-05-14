import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ss_cable_erp';

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export type DB = typeof db;
