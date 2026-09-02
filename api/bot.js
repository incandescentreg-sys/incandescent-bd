const { neon } = require('@neondatabase/serverless');
const ALLOWED_FIELDS = ['fio','phone','email','address','social','auto','property','court','inn','passport'];
function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
async function ensureTable(sql) {
  await sql(`CREATE TABLE IF NOT EXISTS records (id SERIAL PRIMARY KEY,fio TEXT NOT NULL DEFAULT '—',phone TEXT NOT NULL DEFAULT '—',email TEXT NOT NULL DEFAULT '—',address TEXT NOT NULL DEFAULT '—',social TEXT NOT NULL DEFAULT '—',auto TEXT NOT NULL DEFAULT '—',property TEXT NOT NULL DEFAULT '—',court TEXT NOT NULL DEFAULT '—',inn TEXT NOT NULL DEFAULT '—',passport TEXT NOT NULL DEFAULT '—',created_at TIMESTAMP DEFAULT NOW());`);
}
async function searchRecords(sql, q) {
  const conditions = ALLOWED_FIELDS.map(f => sql`${sql(f)} ILIKE '%' || ${q} || '%'`);
  let orClause = conditions[0];
  for (let i = 1; i < conditions.length; i++) orClause = sql`${orClause} OR ${conditions[i]}`;
  return await sql`SELECT * FROM records WHERE ${orClause} ORDER BY id ASC LIMIT 10`;
}
function formatRecord(r) {
  let m = `👤 <b>${r.fio}</b>\n`;
  if(r.phone!=='—') m+=`📞 ${r.phone}\n`; if(r.email!=='—') m+=`📧 ${r.email}\n`;
  if(r.address!=='—') m+=`🏠 ${r.address}\n`; if(r.social!=='—') m+=`🌐 ${r.social}\n`;
  if(r.auto!=='—') m+=`🚗 ${r.auto}\n`; if(r.property!=='—') m+=`🏘 ${r.property}\n`;
  if(r.court!=='—') m+=`⚖️ ${r.court}\n`; if(r.inn!=='—') m+=`🔢 ИНН: ${r.inn}\n`;
  if(r.passport!=='—') m+=`🆔 Паспорт: ${r.passport}\n`; return m;
}
async function sendTelegram(chatId, text, pm) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if(!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:pm||'HTML',disable_web_page_preview:true})});
}
module.exports = async (req, res) => {
  if(req.method!=='POST') return res.status(200).end();
  try {
    const update = typeof req.body==='string' ? JSON.parse(req.body) : req.body;
    const msg = update.message;
    if(!msg||!msg.text) return res.status(200).end();
    const chatId = msg.chat.id, text = msg.text.trim();
    if(text==='/start') { await sendTelegram(chatId,'🔍 <b>Sherlock DB Bot</b>\n\nПришлите ФИО, телефон, email или любые данные для поиска.'); return res.json({ok:true}); }
    if(text==='/help') { await sendTelegram(chatId,'🔍 Просто отправьте текст — бот ищет по всем полям. Частичное совпадение. Макс 10 результатов.'); return res.json({ok:true}); }
    const sql = getDb(); await ensureTable(sql);
    const results = await searchRecords(sql, text);
    if(results.length===0) { await sendTelegram(chatId,'❌ Ничего не найдено.'); }
    else {
      let reply = `🔍 <b>Результаты:</b>\n━━━━━━━━━━━\n\n`;
      for(const r of results) reply += formatRecord(r)+'━━━━━━━━━━━\n';
      if(reply.length>4000) reply=reply.substring(0,3900)+'\n...';
      await sendTelegram(chatId, reply);
    }
    res.json({ok:true});
  } catch(err) { console.error(err); res.status(200).end(); }
};
