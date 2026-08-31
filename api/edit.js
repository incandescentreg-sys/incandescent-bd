const { getDb, ensureTable } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    await ensureTable(sql);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const id = parseInt(req.query.id || body.id);
    if (!id) return res.status(400).json({ error: 'ID обязателен' });

    const v = (val) => (val && val.trim()) ? val.trim() : '—';

    const result = await sql`
      UPDATE records SET
        fio = ${v(body.fio)}, phone = ${v(body.phone)}, email = ${v(body.email)},
        address = ${v(body.address)}, social = ${v(body.social)}, auto = ${v(body.auto)},
        property = ${v(body.property)}, court = ${v(body.court)},
        inn = ${v(body.inn)}, passport = ${v(body.passport)}
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json({ record: result[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};