import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Logger } from "../../domain/ports/system";
import type { Database } from "./database";

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations/", import.meta.url));

/** Applies every .sql file in migrations/ that hasn't run yet, in filename order. */
export async function migrate(db: Database, logger?: Logger): Promise<string[]> {
  await db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
  );

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(MIGRATIONS_DIR + file, "utf8");
    // multi statement files can't go through a parameterised query, so run them
    // with exec and record the migration in the same go
    await db.exec(`begin;\n${sql}\ninsert into schema_migrations (name) values ('${file}');\ncommit;`);
    logger?.info("applied migration", { file });
    ran.push(file);
  }

  return ran;
}
