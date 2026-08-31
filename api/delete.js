const { getDb, ensureTable } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    await ensureTable(sql);

    const id = parseInt(req.query.id);
    if (!id) return res.status(400).json({ error: 'ID обязателен' });

    const result = await sql`DELETE FROM records WHERE id = ${id} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: 'Запись не найдена' });

    res.json({ deleted: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};