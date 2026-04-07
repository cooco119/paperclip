#!/usr/bin/env tsx
/**
 * Migrate v1 Overlord knowledge items into the Paperclip Knowledge Hub API.
 *
 * Usage:
 *   PAPERCLIP_API_URL=http://localhost:3000 PAPERCLIP_API_KEY=<key> COMPANY_ID=<id> \
 *     tsx scripts/migrate-v1-knowledge.ts
 *
 * Reads from ~/.agents/overlord/shared/knowledge/
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const KNOWLEDGE_DIR = join(homedir(), ".agents/overlord/shared/knowledge");
const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.COMPANY_ID;

if (!API_URL || !API_KEY || !COMPANY_ID) {
  console.error("Missing required env: PAPERCLIP_API_URL, PAPERCLIP_API_KEY, COMPANY_ID");
  process.exit(1);
}

interface V1Item {
  id: string;
  type: "learning" | "pattern" | "failure";
  title: string;
  path: string;
  date: string;
  tags: string[];
}

async function main() {
  const indexRaw = await readFile(join(KNOWLEDGE_DIR, "index.json"), "utf-8");
  const index: { items: V1Item[] } = JSON.parse(indexRaw);

  console.log(`Found ${index.items.length} v1 knowledge items to migrate.`);

  let migrated = 0;
  let failed = 0;

  for (const item of index.items) {
    let body: string;
    try {
      body = await readFile(join(KNOWLEDGE_DIR, item.path), "utf-8");
    } catch {
      console.warn(`  [SKIP] Could not read file: ${item.path}`);
      failed++;
      continue;
    }

    const payload = {
      type: item.type,
      title: item.title,
      body,
      tags: item.tags,
      applicableTo: [],
    };

    const res = await fetch(`${API_URL}/api/companies/${COMPANY_ID}/knowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const created = await res.json();
      console.log(`  [OK] ${item.id} → ${created.id}`);
      migrated++;
    } else {
      const errText = await res.text();
      console.error(`  [FAIL] ${item.id}: ${res.status} ${errText}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
