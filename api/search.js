const { getDb, ensureTable } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    await ensureTable(sql);

    const q = (req.query.q || '').trim();
    const fields = req.query.fields
      ? req.query.fields.split(',')
      : ['fio','phone','email','address','social','auto','property','court','inn','passport'];

    const allowed = ['fio','phone','email','address','social','auto','property','court','inn','passport'];

    if (!q) {
      const rows = await sql`SELECT * FROM records ORDER BY id ASC`;
      return res.json({ records: rows, total: rows.length, found: rows.length });
    }

    const conditions = fields
      .filter(f => allowed.includes(f))
      .map(f => sql`${sql(f)} ILIKE '%' || ${q} || '%'`);

    if (conditions.length === 0) return res.json({ records: [], total: 0, found: 0 });

    let orClause = conditions[0];
    for (let i = 1; i < conditions.length; i++) {
      orClause = sql`${orClause} OR ${conditions[i]}`;
    }

    const rows = await sql`SELECT * FROM records WHERE ${orClause} ORDER BY id ASC`;
    const total = await sql`SELECT COUNT(*) as count FROM records`;

    res.json({ records: rows, total: parseInt(total[0].count), found: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};