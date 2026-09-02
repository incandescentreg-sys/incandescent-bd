const { neon } = require('@neondatabase/serverless');
const ALLOWED_FIELDS = ['fio','phone','email','address','social','auto','property','court','inn','passport'];
const FIELD_NAMES = {'fio':'ФИО','phone':'Телефон','email':'Email','address':'Адрес','social':'Соцсети','auto':'Авто','property':'Недвижимость','court':'Суды','inn':'ИНН','passport':'Паспорт'};
function getDb() { return neon(process.env.POSTGRES_URL || process.env.DATABASE_URL); }
async function ensureTable(sql) {
  await sql(`CREATE TABLE IF NOT EXISTS records (id SERIAL PRIMARY KEY,fio TEXT NOT NULL DEFAULT '—',phone TEXT NOT NULL DEFAULT '—',email TEXT NOT NULL DEFAULT '—',address TEXT NOT NULL DEFAULT '—',social TEXT NOT NULL DEFAULT '—',auto TEXT NOT NULL DEFAULT '—',property TEXT NOT NULL DEFAULT '—',court TEXT NOT NULL DEFAULT '—',inn TEXT NOT NULL DEFAULT '—',passport TEXT NOT NULL DEFAULT '—',raw TEXT NOT NULL DEFAULT '—',created_at TIMESTAMP DEFAULT NOW());`);
  await sql(`ALTER TABLE records ADD COLUMN IF NOT EXISTS raw TEXT NOT NULL DEFAULT '—';`);
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
  if(r.raw && r.raw!=='—') m+=`\n📄 <b>Полный текст сохранён</b>\n`;
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
    const m = l.match(/^([\wА-ЯЁа-яё\s\-]+):\s*(.+)$/);
    if(m) {
      const key = m[1].trim().toLowerCase(), val = m[2].trim();
      if(/фио|ф\.и\.о|имя|фамилия|фам|person|name/.test(key)) r.fio=r.fio==='—'?val:r.fio;
      if(/телефон|телефоны|phone|тел|моб|номер|контакт/.test(key)) r.phone=r.phone==='—'?val:r.phone+', '+val;
      if(/email|почта|e-?mail|эл/.test(key)) r.email=r.email==='—'?val:r.email+', '+val;
      if(/адрес|адреса|address|прожив|регистрац|место|справочный адрес/.test(key)) r.address=r.address==='—'?val:r.address+', '+val;
      if(/соцсети|соц\.сети|social|telegram|инстаграм|вконтакте|vkontakte/.test(key)) r.social=r.social==='—'?val:r.social+', '+val;
      if(/авто|машин|автомобил|car|transport|транспорт/.test(key)) r.auto=r.auto==='—'?val:r.auto+', '+val;
      if(/недвижим|жиль|property|квартир|дом|участок/.test(key)) r.property=r.property==='—'?val:r.property+', '+val;
      if(/суд|court|арбитраж|дело|исполнит|банкрот/.test(key)) r.court=r.court==='—'?val:r.court+', '+val;
      if(/инн|inn|ип/.test(key)&&!/паспорт|passport/.test(key)) r.inn=r.inn==='—'?val:r.inn;
      if(/паспорт|passport|пасп.*№|удост/.test(key)) r.passport=r.passport==='—'?val:r.passport;
    } else {
      if(r.phone==='—') { const p=l.match(/(\+7|8)\s*[\(]?\d{3}[\)]?\s*\d{3}\s*\d{2}\s*\d{2}/); if(p) r.phone=p[0].trim(); }
      if(r.email==='—'&&/[\w.\-]+@[\w.\-]+/.test(l)) r.email=l.match(/[\w.\-]+@[\w.\-]+/)[0];
      if(r.inn==='—') { const d=l.match(/\b\d{10,12}\b/); if(d) r.inn=d[0]; }
      if(r.fio==='—') { const f=l.match(/^([А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+)/); if(f) r.fio=f[1]; }
    }
  }
  return r;
}
function parseSherlockTxt(text) {
  const sections = text.split(/\n=== /);
  let allData = [];
  for (const section of sections) {
    const person = { fio:'—', phone:'—', email:'—', address:'—', social:'—', auto:'—', property:'—', court:'—', inn:'—', passport:'—' };
    const lines = section.split('\n');
    for (const line of lines) {
      const l = line.trim();
      const m = l.match(/^([\wА-ЯЁа-яё\s\-]+):\s*(.+)$/);
      if(m) {
        const key = m[1].trim().toLowerCase(), val = m[2].trim();
        if(!val || val==='') continue;
        if(/фио|ф\.и\.о|имя|фамилия|full name|полное имя/i.test(key)) person.fio=person.fio==='—'?val:person.fio;
        if(/телефон/i.test(key)&&!/телефонные/i.test(key)) person.phone=person.phone==='—'?val:person.phone+', '+val;
        if(/email|почта|e-?mail/i.test(key)) person.email=person.email==='—'?val:person.email+', '+val;
        if(/адрес|address|место жительства|справочный адрес/i.test(key)) person.address=person.address==='—'?val:person.address+', '+val;
        if
