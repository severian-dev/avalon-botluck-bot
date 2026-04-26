import { resolve } from 'node:path';
import { rmSync, existsSync } from 'node:fs';

const dbPath = process.env.DATABASE_PATH ?? resolve(process.cwd(), 'avalon-botluck.db');
const targets = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

let removed = 0;
for (const path of targets) {
  if (existsSync(path)) {
    rmSync(path);
    console.log(`removed ${path}`);
    removed++;
  }
}

if (removed === 0) {
  console.log(`nothing to remove (looked at ${dbPath} and its WAL sidecars)`);
} else {
  console.log(`done — next bot start will recreate the schema from scratch`);
}
