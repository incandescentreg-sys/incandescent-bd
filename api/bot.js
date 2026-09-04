const { neon } = require('@neondatabase/serverless');
const ALLOWED_FIELDS = ['fio','phone','email','address','social','auto','property','court','inn','passport'];
function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
async function ensureTable(sql) {
  await sql(`CREATE TABLE IF NOT EXISTS records (id SERIAL PRIMARY KEY,fio TEXT NOT NULL DEFAULT '—',phone TEXT NOT NULL DEFAULT '—',email TEXT NOT NULL DEFAULT '—',address TEXT NOT NULL DEFAULT '—',social TEXT NOT NULL DEFAULT '—',auto TEXT NOT NULL DEFAULT '—',property TEXT NOT NULL DEFAULT '—',court TEXT NOT NULL DEFAULT '—',inn TEXT NOT NULL DEFAULT '—',passport TEXT NOT NULL DEFAULT '—',created_at TIMESTAMP DEFAULT NOW());`);
}
async function searchRecords(sql, q) {
  const p = `%${q}%`;
  return await sql`SELECT * FROM records WHERE fio ILIKE ${p} OR phone ILIKE ${p} OR email ILIKE ${p} OR address ILIKE ${p} OR social ILIKE ${p} OR auto ILIKE ${p} OR property ILIKE ${p} OR court ILIKE ${p} OR inn ILIKE ${p} OR passport ILIKE ${p} ORDER BY id ASC LIMIT 10`;
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
  const token = process.env.TELEGRAM_BOT_TOKEN; if(!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:pm||'HTML',disable_web_page_preview:true})});
}
async function getTelegramFile(fileId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok || !data.result.file_path) return null;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${data.result.file_path}`);
  return await fileRes.text();
}
function parseSherlock(text) {
  const r = { fio:'—', phone:'—', email:'—', address:'—', social:'—', auto:'—', property:'—', court:'—', inn:'—', passport:'—' };
  const lines = text.split('\n');
  for (const line of lines) {
    const l = line.trim();
    if (r.fio==='—') { const m = l.match(/^([А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+)/); if (m) r.fio = m[1]; }
    if (/телефон|phone|тел/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.phone=v; }
    if (/email|почта|e-?mail/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.email=v; }
    if (/адрес|address|прожив/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.address=v; }
    if (/соцсети|социальн|social|telegram|vk|t\.me/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.social=r.social==='—'?v:r.social+', '+v; }
    if (/авто|машин|автомобил|car|auto/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.auto=v; }
    if (/недвижим|жиль|property|дом|квартир/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.property=v; }
    if (/суд|court|арбитраж|дело|исполнит/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.court=v; }
    if (/инн/i.test(l)&&!/паспорт/.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(/\d{10,12}/.test(v)) r.inn=v; }
    if (/паспорт|passport/i.test(l)) { const v = l.replace(/.*?[:]\s*/,'').trim(); if(v) r.passport=v; }
    if (r.phone==='—') { const p = l.match(/(\+7|8)\s*[\(]?\d{3}[\)]?\s*\d{3}\s*\d{2}\s*\d{2}/); if(p) r.phone=p[0].trim(); }
  }
  return r;
}
async function saveRecord(sql, data) {
  const v = (x) => (x && x.trim() && x!=='—') ? x.trim() : '—';
  const r = await sql`INSERT INTO records (fio,phone,email,address,social,auto,property,court,inn,passport) VALUES (${v(data.fio)},${v(data.phone)},${v(data.email)},${v(data.address)},${v(data.social)},${v(data.auto)},${v(data.property)},${v(data.court)},${v(data.inn)},${v(data.passport)}) RETURNING id`;
  return r[0].id;
}
module.exports = async (req, res) => {
  if(req.method!=='POST') return res.status(200).end();
  try {
    const update = typeof req.body==='string' ? JSON.parse(req.body) : req.body;
    const msg = update.message; if(!msg) return res.status(200).end();
    const chatId = msg.chat.id;
    if(msg.text) {
      const text = msg.text.trim();
      if(text==='/start') { await sendTelegram(chatId,'🔍 <b>Sherlock DB Bot</b>\n\n📌 <b>Поиск:</b> просто напишите текст\n📌 <b>Сохранить отчёт:</b> перешлите сообщение и ответьте /save\n📌 <b>.txt файл:</b> просто пришлите — распарсится и сохранится'); return res.json({ok:true}); }
      if(text==='/help') { await sendTelegram(chatId,'🔍 <b>Команды:</b>\n\n• /save — ответьте на пересланное сообщение\n• Пришлите .txt — автосохранение\n• Любой текст — поиск'); return res.json({ok:true}); }
      if(text==='/save' && msg.reply_to_message && msg.reply_to_message.text) {
        const parsed = parseSherlock(msg.reply_to_message.text);
        const sql = getDb(); await ensureTable(sql);
        const id = await saveRecord(sql, parsed);
        let reply = `✅ <b>Сохранено!</b> (ID: ${id})\n\n👤 ${parsed.fio}\n`;
        if(parsed.phone!=='—') reply+=`📞 ${parsed.phone}\n`; if(parsed.email!=='—') reply+=`📧 ${parsed.email}\n`;
        if(parsed.address!=='—') reply+=`🏠 ${parsed.address}\n`; if(parsed.inn!=='—') reply+=`🔢 ИНН: ${parsed.inn}\n`;
        await sendTelegram(chatId, reply); return res.json({ok:true});
      }
      const sql = getDb(); await ensureTable(sql);
      const results = await searchRecords(sql, text);
      if(results.length===0) { await sendTelegram(chatId,'❌ Ничего не найдено.'); }
      else {
        let reply = `🔍 <b>Результаты:</b>\n━━━━━━━━━━━\n\n`;
        for(const r of results) reply += formatRecord(r)+'━━━━━━━━━━━\n';
        if(reply.length>4000) reply=reply.substring(0,3900)+'\n...';
        await sendTelegram(chatId, reply);
      }
      return res.json({ok:true});
    }
    if(msg.document) {
      const doc = msg.document;
      if(!doc.file_name || !doc.file_name.toLowerCase().endsWith('.txt')) {
        await sendTelegram(chatId,'❌ Пришлите файл в формате .txt');
        return res.json({ok:true});
      }
      const content = await getTelegramFile(doc.file_id);
      if(!content) { await sendTelegram(chatId,'❌ Не удалось прочитать файл'); return res.json({ok:true}); }
      const parsed = parseSherlock(content);
      const sql = getDb(); await ensureTable(sql);
      const id = await saveRecord(sql, parsed);
      let reply = `✅ <b>Сохранено из файла!</b> (ID: ${id})\n\n👤 ${parsed.fio}\n`;
      if(parsed.phone!=='—') reply+=`📞 ${parsed.phone}\n`; if(parsed.email!=='—') reply+=`📧 ${parsed.email}\n`;
      if(parsed.address!=='—') reply+=`🏠 ${parsed.address}\n`; if(parsed.inn!=='—') reply+=`🔢 ИНН: ${parsed.inn}\n`;
      await sendTelegram(chatId, reply);
      return res.json({ok:true});
    }
    res.status(200).end();
  } catch(err) { console.error(err); res.status(200).end(); }
};
