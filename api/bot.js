const { neon } = require('@neondatabase/serverless');
const ALLOWED_FIELDS = ['fio','phone','email','address','social','auto','property','court','inn','passport'];
const FIELD_NAMES = {'fio':'ФИО','phone':'Телефон','email':'Email','address':'Адрес','social':'Соцсети','auto':'Авто','property':'Недвижимость','court':'Суды','inn':'ИНН','passport':'Паспорт'};
const ACCESS_CODE = process.env.BOT_ACCESS_CODE || 'sherlock2024';
function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
async function ensureTables(sql) {
  await sql(`CREATE TABLE IF NOT EXISTS records (id SERIAL PRIMARY KEY,fio TEXT NOT NULL DEFAULT '—',phone TEXT NOT NULL DEFAULT '—',email TEXT NOT NULL DEFAULT '—',address TEXT NOT NULL DEFAULT '—',social TEXT NOT NULL DEFAULT '—',auto TEXT NOT NULL DEFAULT '—',property TEXT NOT NULL DEFAULT '—',court TEXT NOT NULL DEFAULT '—',inn TEXT NOT NULL DEFAULT '—',passport TEXT NOT NULL DEFAULT '—',raw TEXT NOT NULL DEFAULT '—',created_at TIMESTAMP DEFAULT NOW());`);
  await sql(`ALTER TABLE records ADD COLUMN IF NOT EXISTS raw TEXT NOT NULL DEFAULT '—';`);
  await sql(`CREATE TABLE IF NOT EXISTS bot_users (chat_id BIGINT PRIMARY KEY,created_at TIMESTAMP DEFAULT NOW());`);
}
async function isAuthorized(sql, chatId) {
  const r = await sql`SELECT 1 FROM bot_users WHERE chat_id = ${chatId}`;
  return r.length > 0;
}
async function authorizeUser(sql, chatId) {
  await sql`INSERT INTO bot_users (chat_id) VALUES (${chatId}) ON CONFLICT DO NOTHING`;
}
async function searchRecords(sql, q, field) {
  const p = `%${q}%`;
  if(field) return await sql`SELECT * FROM records WHERE ${sql(field)} ILIKE ${p} ORDER BY id ASC LIMIT 10`;
  return await sql`SELECT * FROM records WHERE fio ILIKE ${p} OR phone ILIKE ${p} OR email ILIKE ${p} OR address ILIKE ${p} OR social ILIKE ${p} OR auto ILIKE ${p} OR property ILIKE ${p} OR court ILIKE ${p} OR inn ILIKE ${p} OR passport ILIKE ${p} OR raw ILIKE ${p} ORDER BY id ASC LIMIT 10`;
}
function formatRecord(r) {
  let m = `👤 <b>${r.fio}</b>\n`;
  if(r.phone!=='—') m+=`📞 ${r.phone}\n`; if(r.email!=='—') m+=`📧 ${r.email}\n`;
  if(r.address!=='—') m+=`🏠 ${r.address}\n`; if(r.social!=='—') m+=`🌐 ${r.social}\n`;
  if(r.auto!=='—') m+=`🚗 ${r.auto}\n`; if(r.property!=='—') m+=`🏘 ${r.property}\n`;
  if(r.court!=='—') m+=`⚖️ ${r.court}\n`; if(r.inn!=='—') m+=`🔢 ИНН: ${r.inn}\n`;
  if(r.passport!=='—') m+=`🆔 Паспорт: ${r.passport}\n`;
  if(r.raw && r.raw!=='—') m+=`📄 <b>Полный текст:</b>\n${r.raw.substring(0,500)}\n`;
  return m;
}
function validateInn(inn) {
  inn = inn.replace(/\D/g,'');
  if(![10,12].includes(inn.length)) return 'Некорректная длина ИНН (10 или 12 цифр)';
  if(inn.length===10) {
    const w=[2,4,10,3,5,9,4,6,8]; let s=0;
    for(let i=0;i<9;i++) s+=parseInt(inn[i])*w[i];
    return parseInt(inn[9])===s%11%10 ? '✅ ИНН корректен' : '❌ ИНН недействителен';
  } else {
    const w1=[7,2,4,10,3,5,9,4,6,8]; let s1=0,s2=0;
    const w2=[3,7,2,4,10,3,5,9,4,6,8];
    for(let i=0;i<10;i++) s1+=parseInt(inn[i])*w1[i];
    for(let i=0;i<11;i++) s2+=parseInt(inn[i])*w2[i];
    return parseInt(inn[10])===s1%11%10 && parseInt(inn[11])===s2%11%10 ? '✅ ИНН корректен' : '❌ ИНН недействителен';
  }
}
async function sendTelegram(chatId, text, pm) {
  const token = process.env.TELEGRAM_BOT_TOKEN; if(!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:pm||'HTML',disable_web_page_preview:true})});
}
async function sendTelegramFile(chatId, content, filename) {
  const token = process.env.TELEGRAM_BOT_TOKEN; if(!token) return;
  const boundary = 'boundary_'+Date.now();
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--\r\n`;
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`,{method:'POST',headers:{'Content-Type':`multipart/form-data; boundary=${boundary}`},body});
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
  for (const line of text.split('\n')) {
    const l = line.trim(); if(!l) continue;
    const m = l.match(/^([\wА-ЯЁа-яё\s\-]+)\s*[:—]\s*(.+)$/);
    if(m) {
      const key = m[1].trim().toLowerCase(), val = m[2].trim();
      if(/фио|ф\.и\.о|имя|фамилия|фам|person|name/.test(key)||(/^[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+/.test(l)&&!/[:—]/.test(l))) r.fio=r.fio==='—'?val:r.fio;
      if(/телефон|телефоны|phone|тел|моб|номер|контакт/.test(key)) r.phone=r.phone==='—'?val:r.phone+', '+val;
      if(/email|почта|e-?mail|эл/.test(key)) r.email=r.email==='—'?val:r.email+', '+val;
      if(/адрес|адреса|address|прожив|регистрац|место/.test(key)) r.address=r.address==='—'?val:r.address+', '+val;
      if(/соцсети|соц\.сети|social|telegram|инстаграм|вконтакте|vkontakte/.test(key)) r.social=r.social==='—'?val:r.social+', '+val;
      if(/авто|машин|автомобил|car|transport|транспорт/.test(key)) r.auto=r.auto==='—'?val:r.auto+', '+val;
      if(/недвижим|жиль|property|квартир|дом|участок/.test(key)) r.property=r.property==='—'?val:r.property+', '+val;
      if(/суд|court|арбитраж|дело|исполнит|банкрот/.test(key)) r.court=r.court==='—'?val:r.court+', '+val;
      if(/инн|inn|ип/.test(key)&&!/паспорт|passport/.test(key)) r.inn=r.inn==='—'?val:r.inn;
      if(/паспорт|passport|пасп.*№|удост/.test(key)) r.passport=r.passport==='—'?val:r.passport;
    } else {
      // без ключа — пытаемся угадать
      if(r.phone==='—') { const p=l.match(/(\+7|8)\s*[\(]?\d{3}[\)]?\s*\d{3}\s*\d{2}\s*\d{2}/); if(p) r.phone=p[0].trim(); }
      if(r.email==='—'&&/[\w.\-]+@[\w.\-]+/.test(l)) r.email=l.match(/[\w.\-]+@[\w.\-]+/)[0];
      if(r.inn==='—') { const d=l.match(/\b\d{10,12}\b/); if(d) r.inn=d[0]; }
      if(r.fio==='—') { const f=l.match(/^([А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+)/); if(f) r.fio=f[1]; }
    }
  }
  return r;
}
async function saveRecord(sql, data, rawText) {
  const v = (x) => (x && x.trim() && x!=='—') ? x.trim() : '—';
  const r = await sql`INSERT INTO records (fio,phone,email,address,social,auto,property,court,inn,passport,raw) VALUES (${v(data.fio)},${v(data.phone)},${v(data.email)},${v(data.address)},${v(data.social)},${v(data.auto)},${v(data.property)},${v(data.court)},${v(data.inn)},${v(data.passport)},${rawText||'—'}) RETURNING id`;
  return r[0].id;
}
module.exports = async (req, res) => {
  if(req.method!=='POST') return res.status(200).end();
  try {
    const update = typeof req.body==='string' ? JSON.parse(req.body) : req.body;
    const msg = update.message; if(!msg) return res.status(200).end();
    const chatId = msg.chat.id;
    const sql = getDb(); await ensureTables(sql);
    const authorized = await isAuthorized(sql, chatId);
    if(msg.text) {
      const text = msg.text.trim();
      if(!authorized) {
        if(text===ACCESS_CODE) { await authorizeUser(sql, chatId); await sendTelegram(chatId,'✅ <b>Доступ разрешён!</b>\n\nНапишите /start чтобы начать.'); }
        else { await sendTelegram(chatId,'🔒 <b>Доступ запрещён.</b> Введите секретный код.'); }
        return res.json({ok:true});
      }
      if(text==='/start') {
        await sendTelegram(chatId,'🔍 <b>Sherlock DB Bot</b>\n━━━━━━━━━━━━━━━━\n📌 <b>Поиск:</b> просто напишите текст\n📌 <b>Сохранить:</b> /save как ответ на сообщение, ИЛИ .txt файл\n📌 <b>/phone</b> <code>+7 916</code> — по телефону\n📌 <b>/inn</b> <code>7712</code> — по ИНН\n📌 <b>/fio</b> <code>Иванов</code> — по ФИО\n━━━━━━━━━━━━━━━━\n📋 /all /last /stats /count\n✏️ /edit /delete\n📤 /export\n🔍 /check ИНН\nПолный список: /help');
        return res.json({ok:true});
      }
      if(text==='/help') {
        await sendTelegram(chatId,'🔍 <b>Команды:</b>\n━━━━━━━━━━━━━━━━\n<b>Поиск</b>\n/fio Иванов — по ФИО\n/phone +7 916 — по телефону\n/inn 7712 — по ИНН\n/email @mail — по email\n/car — по авто\n/address Москва — по адресу\n━━━━━━━━━━━━━━━━\n<b>Управление</b>\n/all — все записи\n/get 5 — запись #5\n/last — последние 5\n/count — сколько\n/random — случайная\n/dupes — дубликаты\n/delete 5 — удалить\n/edit 5 phone=+7... — изменить\n━━━━━━━━━━━━━━━━\n<b>Экспорт</b>\n/export — скачать базу .txt\n/share 5 — показать запись\n/check 771234567890 — проверить ИНН');
        return res.json({ok:true});
      }
      const fieldCmd = text.match(/^\/(fio|phone|inn|email|car|auto|address|court|social)\s(.+)/i);
      if(fieldCmd) {
        const fieldMap = {fio:'fio',phone:'phone',inn:'inn',email:'email',car:'auto',auto:'auto',address:'address',court:'court',social:'social'};
        const f = fieldMap[fieldCmd[1].toLowerCase()];
        const q = fieldCmd[2].trim();
        const results = await searchRecords(sql, q, f);
        if(!results.length) { await sendTelegram(chatId,`❌ Ничего не найдено по ${FIELD_NAMES[f]||f}: ${q}`); }
        else {
          let reply = `🔍 <b>Поиск по ${FIELD_NAMES[f]||f}:</b> ${q}\n━━━━━━━━━━━\n\n`;
          for(const r of results) reply += formatRecord(r)+'━━━━━━━━━━━\n';
          if(reply.length>4000) reply=reply.substring(0,3900)+'\n...';
          await sendTelegram(chatId, reply);
        }
        return res.json({ok:true});
      }
      if(text.match(/^\/check\s+(\d{10,12})/)) {
        const inn = text.match(/\d{10,12}/)[0];
        await sendTelegram(chatId, `🔢 <b>Проверка ИНН:</b> <code>${inn}</code>\n${validateInn(inn)}`);
        return res.json({ok:true});
      }
      if(text==='/stats') {
        const cnt = await sql`SELECT COUNT(*) as c FROM records`;
        const users = await sql`SELECT COUNT(*) as c FROM bot_users`;
        await sendTelegram(chatId,`📊 <b>Статистика</b>\n━━━━━━━━━━━━━━━━\n📝 Записей: ${cnt[0].c}\n👥 Пользователей: ${users[0].c}`);
        return res.json({ok:true});
      }
      if(text==='/count') {
        const cnt = await sql`SELECT COUNT(*) as c FROM records`;
        await sendTelegram(chatId,`📝 <b>Всего записей:</b> ${cnt[0].c}`);
        return res.json({ok:true});
      }
      if(text.startsWith('/get ')) {
        const id = parseInt(text.replace('/get ',''));
        const r = await sql`SELECT * FROM records WHERE id = ${id}`;
        if(!r.length) { await sendTelegram(chatId,'❌ Запись не найдена.'); }
        else { await sendTelegram(chatId,`📋 <b>Запись #${id}</b>\n━━━━━━━━━━━\n${formatRecord(r[0])}`); }
        return res.json({ok:true});
      }
      if(text.startsWith('/delete ')) {
        const id = parseInt(text.replace('/delete ',''));
        const r = await sql`DELETE FROM records WHERE id = ${id} RETURNING id`;
        if(!r.length) { await sendTelegram(chatId,'❌ Запись не найдена.'); }
        else { await sendTelegram(chatId,`🗑 <b>Удалено</b> (ID: ${id})`); }
        return res.json({ok:true});
      }
      if(text.startsWith('/edit ')) {
        const m = text.match(/^\/edit\s+(\d+)\s+(\w+)\s*=\s*(.+)/i);
        if(m) {
          const id = parseInt(m[1]), field = m[2].toLowerCase(), value = m[3].trim();
          if(!ALLOWED_FIELDS.includes(field)) { await sendTelegram(chatId,`❌ Поле ${field} не существует. Доступны: ${ALLOWED_FIELDS.join(', ')}`); return res.json({ok:true}); }
          const r = await sql`UPDATE records SET ${sql(field)} = ${value} WHERE id = ${id} RETURNING id`;
          if(!r.length) { await sendTelegram(chatId,'❌ Запись не найдена.'); }
          else { await sendTelegram(chatId,`✅ <b>Обновлено</b> (ID: ${id}, поле: ${field})`); }
        } else { await sendTelegram(chatId,'❌ Формат: /edit 5 phone=+7 999 123-45-67'); }
        return res.json({ok:true});
      }
      if(text.startsWith('/share ')) {
        const id = parseInt(text.replace('/share ',''));
        const r = await sql`SELECT * FROM records WHERE id = ${id}`;
        if(!r.length) { await sendTelegram(chatId,'❌ Запись не найдена.'); }
        else { await sendTelegram(chatId,`📤 <b>Запись #${id}</b>\n━━━━━━━━━━━\n${formatRecord(r[0])}`); }
        return res.json({ok:true});
      }
      if(text==='/all') {
        const rows = await sql`SELECT * FROM records ORDER BY id ASC LIMIT 20`;
        if(!rows.length) { await sendTelegram(chatId,'❌ База пуста.'); }
        else {
          let reply = `📋 <b>Все записи:</b>\n━━━━━━━━━━━\n\n`;
          for(const r of rows) reply += `#${r.id} 👤 ${r.fio}\n📞 ${r.phone!=='—'?r.phone:'—'}\n━━━━━━━━━━━\n`;
          if(reply.length>4000) reply=reply.substring(0,3900)+'\n...';
          await sendTelegram(chatId, reply);
        }
        return res.json({ok:true});
      }
      if(text==='/last') {
        const rows = await sql`SELECT * FROM records ORDER BY id DESC LIMIT 5`;
        if(!rows.length) { await sendTelegram(chatId,'❌ База пуста.'); }
        else {
          let reply = `🆕 <b>Последние записи:</b>\n━━━━━━━━━━━\n\n`;
          for(const r of rows) reply += `#${r.id} 👤 ${r.fio}\n📞 ${r.phone!=='—'?r.phone:'—'}\n━━━━━━━━━━━\n`;
          await sendTelegram(chatId, reply);
        }
        return res.json({ok:true});
      }
      if(text==='/random') {
        const r = await sql`SELECT * FROM records ORDER BY RANDOM() LIMIT 1`;
        if(!r.length) { await sendTelegram(chatId,'❌ База пуста.'); }
        else { await sendTelegram(chatId,`🎲 <b>Случайная запись</b>\n━━━━━━━━━━━\n${formatRecord(r[0])}`); }
        return res.json({ok:true});
      }
      if(text==='/dupes') {
        const rows = await sql`SELECT fio,phone,COUNT(*) as cnt FROM records WHERE fio!='—' GROUP BY fio,phone HAVING COUNT(*)>1 ORDER BY cnt DESC LIMIT 10`;
        if(!rows.length) { await sendTelegram(chatId,'✅ Дубликатов не найдено.'); }
        else {
          let reply = `⚠️ <b>Возможные дубликаты:</b>\n━━━━━━━━━━━\n\n`;
          for(const r of rows) reply += `👤 ${r.fio} | 📞 ${r.phone} — <b>${r.cnt} шт</b>\n━━━━━━━━━━━\n`;
          await sendTelegram(chatId, reply);
        }
        return res.json({ok:true});
      }
      if(text==='/export') {
        const rows = await sql`SELECT * FROM records ORDER BY id ASC`;
        if(!rows.length) { await sendTelegram(chatId,'❌ База пуста.'); return res.json({ok:true}); }
        let txt = '';
        for(const r of rows) {
          txt += `ID: ${r.id}\nФИО: ${r.fio}\nТелефон: ${r.phone}\nEmail: ${r.email}\nАдрес: ${r.address}\nСоцсети: ${r.social}\nАвто: ${r.auto}\nНедвижимость: ${r.property}\nСуды: ${r.court}\nИНН: ${r.inn}\nПаспорт: ${r.passport}\n${'─'.repeat(30)}\n`;
        }
        await sendTelegramFile(chatId, txt, 'sherlock-db-export.txt');
        await sendTelegram(chatId,`📤 <b>Экспорт готов!</b> (${rows.length} записей)`);
        return res.json({ok:true});
      }
      if(text==='/save' && msg.reply_to_message && msg.reply_to_message.text) {
        const forwarded = msg.reply_to_message.text;
        const parsed = parseSherlock(forwarded);
        const id = await saveRecord(sql, parsed, forwarded);
        let reply = `✅ <b>Сохранено!</b> (ID: ${id})\n\n👤 ${parsed.fio}\n`;
        if(parsed.phone!=='—') reply+=`📞 ${parsed.phone}\n`; if(parsed.email!=='—') reply+=`📧 ${parsed.email}\n`;
        if(parsed.address!=='—') reply+=`🏠 ${parsed.address}\n`; if(parsed.inn!=='—') reply+=`🔢 ИНН: ${parsed.inn}\n`;
        reply += `\n📄 Полный текст тоже сохранён.`;
        await sendTelegram(chatId, reply); return res.json({ok:true});
      }
      const results = await searchRecords(sql, text, null);
      if(!results.length) { await sendTelegram(chatId,'❌ Ничего не найдено.'); }
      else {
        let reply = `🔍 <b>Результаты:</b>\n━━━━━━━━━━━\n\n`;
        for(const r of results) reply += formatRecord(r)+'━━━━━━━━━━━\n';
        if(reply.length>4000) reply=reply.substring(0,3900)+'\n...';
        await sendTelegram(chatId, reply);
      }
      return res.json({ok:true});
    }
    if(!authorized) {
      await sendTelegram(chatId,'🔒 <b>Доступ запрещён.</b> Введите секретный код.');
      return res.json({ok:true});
    }
    if(msg.document) {
      const doc = msg.document;
      if(!doc.file_name || !doc.file_name.toLowerCase().endsWith('.txt')) {
        await sendTelegram(chatId,'❌ Пришлите файл .txt');
        return res.json({ok:true});
      }
      const content = await getTelegramFile(doc.file_id);
      if(!content) { await sendTelegram(chatId,'❌ Не удалось прочитать файл'); return res.json({ok:true}); }
      const parsed = parseSherlock(content);
      const id = await saveRecord(sql, parsed, content);
      let reply = `✅ <b>Сохранено из файла!</b> (ID: ${id})\n\n👤 ${parsed.fio}\n`;
      if(parsed.phone!=='—') reply+=`📞 ${parsed.phone}\n`; if(parsed.email!=='—') reply+=`📧 ${parsed.email}\n`;
      if(parsed.address!=='—') reply+=`🏠 ${parsed.address}\n`; if(parsed.inn!=='—') reply+=`🔢 ИНН: ${parsed.inn}\n`;
      reply += `\n📄 Полный текст тоже сохранён.`;
      await sendTelegram(chatId, reply);
      return res.json({ok:true});
    }
    res.status(200).end();
  } catch(err) { console.error(err); res.status(200).end(); }
};
