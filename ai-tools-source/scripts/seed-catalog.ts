import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import type { AITool } from '../shared/catalog';

const ids = ['chatgpt', 'claude', 'gemini', 'deepseek', 'perplexity', 'notebooklm', 'canva', 'midjourney', 'firefly', 'runway', 'heygen', 'elevenlabs', 'suno', 'cursor', 'copilot', 'notion', 'zapier', 'gamma'];
const version = 'verified-ai-directory-2026-11-09-v1';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const migration = await fs.readFile(path.resolve('drizzle/0001_ai_catalog.sql'), 'utf8');
  for (const statement of migration.split(';').map(sql => sql.trim()).filter(Boolean)) await connection.query(statement);
  const [done] = await connection.execute<RowDataPacket[]>('SELECT version, tool_count FROM ai_catalog_seed_runs WHERE version = ? LIMIT 1', [version]);
  if (done.length) {
    console.log(`Seed already completed: ${done[0].tool_count} tools; existing edits preserved.`);
  } else {
    const tools: AITool[] = [];
    for (const id of ids) {
      try {
        const raw = JSON.parse(await fs.readFile(path.resolve('research', `${id}.json`), 'utf8'));
        delete raw.filePath;
        if (raw.id !== id || !raw.name || !Array.isArray(raw.sources) || !raw.sources.length) throw new Error(`Invalid data for ${id}`);
        for (const url of [raw.officialUrl, raw.pricingUrl, ...raw.sources.map((source: {url:string}) => source.url)]) {
          if (new URL(url).protocol !== 'https:') throw new Error(`Invalid public URL for ${id}`);
        }
        tools.push(raw as AITool);
      } catch (error) {
        console.error(`Cannot seed ${id}:`, error instanceof Error ? error.message : 'Invalid file');
        throw error;
      }
    }
    if (tools.length !== ids.length) throw new Error('Research incomplete; not marking seed complete');
    await connection.beginTransaction();
    try {
      for (const [order, tool] of tools.entries()) {
        await connection.execute('INSERT IGNORE INTO ai_tools (id, name, category, detail, display_order) VALUES (?, ?, ?, ?, ?)', [tool.id, tool.name, tool.category, JSON.stringify(tool), order]);
      }
      await connection.execute('INSERT INTO ai_catalog_seed_runs (version, tool_count) VALUES (?, ?)', [version, tools.length]);
      await connection.commit();
      console.log(`Saved ${tools.length} researched tools to persistent MySQL database.`);
    } catch (error) { await connection.rollback(); throw error; }
  }
  const [count] = await connection.query<RowDataPacket[]>('SELECT COUNT(id) AS count FROM ai_tools LIMIT 1');
  console.log(`Database catalogue count: ${count[0].count}`);
} finally { await connection.end(); }
