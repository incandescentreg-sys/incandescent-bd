const { neon } = require('@neondatabase/serverless');

function getDb() {
  return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

async function ensureTable(sql) {
  await sql(`
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      fio TEXT NOT NULL DEFAULT '—',
      phone TEXT NOT NULL DEFAULT '—',
      email TEXT NOT NULL DEFAULT '—',
      address TEXT NOT NULL DEFAULT '—',
      social TEXT NOT NULL DEFAULT '—',
      auto TEXT NOT NULL DEFAULT '—',
      property TEXT NOT NULL DEFAULT '—',
      court TEXT NOT NULL DEFAULT '—',
      inn TEXT NOT NULL DEFAULT '—',
      passport TEXT NOT NULL DEFAULT '—',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

module.exports = { getDb, ensureTable };