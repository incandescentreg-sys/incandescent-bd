const { getDb, ensureTable } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    await ensureTable(sql);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body.fio || !body.fio.trim()) return res.status(400).json({ error: 'Поле ФИО обязательно' });

    const v = (val) => (val && val.trim()) ? val.trim() : '—';

    const result = await sql`
      INSERT INTO records (fio, phone, email, address, social, auto, property, court, inn, passport)
      VALUES (${v(body.fio)}, ${v(body.phone)}, ${v(body.email)}, ${v(body.address)},
              ${v(body.social)}, ${v(body.auto)}, ${v(body.property)}, ${v(body.court)},
              ${v(body.inn)}, ${v(body.passport)})
      RETURNING *
    `;

    res.json({ record: result[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};