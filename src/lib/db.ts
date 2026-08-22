import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

export interface DbRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface DbStatement {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => DbRunResult;
}

export interface Db {
  exec: (sql: string) => void;
  pragma: (pragma: string) => void;
  prepare: (sql: string) => DbStatement;
  transaction: <T extends (...args: never[]) => void>(fn: T) => T;
}

function createDb(databasePath: string): Db {
  const raw = new DatabaseSync(databasePath);

  return {
    exec: (sql) => raw.exec(sql),
    pragma: (pragma) => raw.exec(`PRAGMA ${pragma}`),
    prepare: (sql) => raw.prepare(sql),
    transaction: <T extends (...args: never[]) => void>(fn: T): T =>
      ((...args: Parameters<T>) => {
        raw.exec("BEGIN IMMEDIATE");
        try {
          fn(...args);
          raw.exec("COMMIT");
        } catch (err) {
          raw.exec("ROLLBACK");
          throw err;
        }
      }) as T,
  };
}

function initDb(): Db {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const DB_PATH = path.join(dataDir, "macro.db");
  const db = createDb(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
CREATE TABLE IF NOT EXISTS currencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS indicator_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency_id INTEGER NOT NULL,
  indicator_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Growth','Inflation','Labor')),
  previous REAL DEFAULT 0,
  forecast REAL DEFAULT 0,
  actual REAL DEFAULT 0,
  sigma REAL DEFAULT 0,
  sign INTEGER NOT NULL DEFAULT 1,
  weight REAL NOT NULL,
  release_date TEXT NOT NULL DEFAULT (date('now')),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(currency_id, indicator_name, release_date)
);

CREATE TABLE IF NOT EXISTS market_positioning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cot_spx_net_spec REAL DEFAULT 0,
  cot_usd_net_spec REAL DEFAULT 0,
  vix_level REAL DEFAULT 20,
  retail_sentiment TEXT DEFAULT 'neutral',
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS indicator_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator_name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  sign INTEGER NOT NULL,
  weight REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS country_indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_currency_id INTEGER NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  indicator_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Growth','Inflation','Labor')),
  previous REAL DEFAULT 0,
  forecast REAL DEFAULT 0,
  actual REAL DEFAULT 0,
  sigma REAL DEFAULT 0,
  sign INTEGER NOT NULL DEFAULT 1,
  weight REAL NOT NULL,
  release_date TEXT NOT NULL DEFAULT (date('now')),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(parent_currency_id, country_code, indicator_name, release_date)
);

CREATE TABLE IF NOT EXISTS signal_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  pair TEXT NOT NULL,
  signal TEXT NOT NULL,
  strength TEXT NOT NULL,
  macro_diff REAL DEFAULT 0,
  entry_price REAL DEFAULT 0,
  exit_price REAL DEFAULT 0,
  stop_loss REAL DEFAULT 0,
  take_profit REAL DEFAULT 0,
  risk_percent REAL DEFAULT 0,
  return_pct REAL DEFAULT 0,
  result TEXT DEFAULT 'Open',
  UNIQUE(snapshot_date, pair)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  synced_at INTEGER DEFAULT (unixepoch()),
  period TEXT NOT NULL,
  events_fetched INTEGER DEFAULT 0,
  events_mapped INTEGER DEFAULT 0,
  events_saved INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ok',
  error TEXT
);

CREATE TABLE IF NOT EXISTS economic_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  event_name TEXT NOT NULL,
  indicator_name TEXT,
  impact TEXT NOT NULL DEFAULT 'low',
  event_time TEXT NOT NULL,
  release_date TEXT NOT NULL,
  previous REAL DEFAULT 0,
  forecast REAL DEFAULT 0,
  actual REAL,
  unit TEXT,
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(source, currency_code, event_name, event_time)
);

CREATE TABLE IF NOT EXISTS treasury_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  month1 REAL DEFAULT 0,
  month2 REAL DEFAULT 0,
  month3 REAL DEFAULT 0,
  month6 REAL DEFAULT 0,
  year1 REAL DEFAULT 0,
  year2 REAL DEFAULT 0,
  year3 REAL DEFAULT 0,
  year5 REAL DEFAULT 0,
  year7 REAL DEFAULT 0,
  year10 REAL DEFAULT 0,
  year20 REAL DEFAULT 0,
  year30 REAL DEFAULT 0
);
`);

const templates = [
  { name: "PMI Manufacturing", category: "Growth", sign: 1, weight: 0.35 },
  { name: "PMI Services", category: "Growth", sign: 1, weight: 0.30 },
  { name: "Retail Sales", category: "Growth", sign: 1, weight: 0.20 },
  { name: "Industrial Production", category: "Growth", sign: 1, weight: 0.15 },
  { name: "GDP", category: "Growth", sign: 1, weight: 0.30 },
  { name: "Durable Goods Orders", category: "Growth", sign: 1, weight: 0.10 },
  { name: "Personal Income", category: "Growth", sign: 1, weight: 0.10 },
  { name: "CPI", category: "Inflation", sign: 1, weight: 0.40 },
  { name: "Core PCE", category: "Inflation", sign: 1, weight: 0.40 },
  { name: "PPI", category: "Inflation", sign: 1, weight: 0.20 },
  { name: "NFP", category: "Labor", sign: 1, weight: 0.50 },
  { name: "Unemployment Rate", category: "Labor", sign: -1, weight: 0.30 },
  { name: "Jobless Claims", category: "Labor", sign: -1, weight: 0.20 },
];

const count = db.prepare("SELECT COUNT(*) as c FROM indicator_templates").get() as { c: number };
if (count.c === 0) {
  const insert = db.prepare(
    "INSERT INTO indicator_templates (indicator_name, category, sign, weight) VALUES (?, ?, ?, ?)"
  );
  for (const t of templates) {
    insert.run(t.name, t.category, t.sign, t.weight);
  }
}

// Migration: add release_date if missing on older schema
try {
  db.prepare("SELECT release_date FROM indicator_data LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE indicator_data ADD COLUMN release_date TEXT DEFAULT (date('now'))");
}

// Migration: add source column to indicator_data
try {
  db.prepare("SELECT source FROM indicator_data LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE indicator_data ADD COLUMN source TEXT DEFAULT 'manual'");
}

// Migration: add risk management columns to signal_snapshots
try {
  db.prepare("SELECT stop_loss FROM signal_snapshots LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE signal_snapshots ADD COLUMN stop_loss REAL DEFAULT 0");
  db.exec("ALTER TABLE signal_snapshots ADD COLUMN take_profit REAL DEFAULT 0");
  db.exec("ALTER TABLE signal_snapshots ADD COLUMN risk_percent REAL DEFAULT 0");
}

const mpCount = db.prepare("SELECT COUNT(*) as c FROM market_positioning").get() as { c: number };
if (mpCount.c === 0) {
  db.prepare(
    "INSERT INTO market_positioning (cot_spx_net_spec, cot_usd_net_spec, vix_level, retail_sentiment) VALUES (0, 0, 20, 'neutral')"
  ).run();
}

  return db;
}

let _db: Db | null = null;

function getDb(): Db {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}

const db = new Proxy({} as Db, {
  get(_target, prop: keyof Db) {
    return getDb()[prop];
  },
});

export default db;
