import DatabaseConstructor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { runMigrations } from './migrations.js';

export function initDatabase(path?: string): Database.Database {
  const dbPath = path ?? process.env.DATABASE_PATH ?? resolve(process.cwd(), 'avalon-botluck.db');
  const db = new DatabaseConstructor(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}
