const { getDb, ensureTable } = require('./db');

const SEED_DATA = [
  {fio:"Иванов Сергей Дмитриевич",phone:"+7 (916) 555-34-12",email:"ivanov.sd@gmail.com",address:"г. Москва, ул. Тверская, д. 15, кв. 42",social:"vk.com/ivanov_sd, t.me/ivanov_sd",auto:"Hyundai Solaris, X123AB777",property:"кв. 42 м² г. Москва, уч. 6 сот. МО",court:"АСГМ № А40-12345/2024 (долг)",inn:"771234567890",passport:"4512 345678"},
  {fio:"Петрова Анна Викторовна",phone:"+7 (925) 111-22-33",email:"anna.petr@yandex.ru",address:"г. Санкт-Петербург, Невский пр., д. 50, кв. 10",social:"instagram.com/anna_petr, vk.com/id12345",auto:"Toyota Camry, Y456BC78",property:"кв. 65 м² СПб",court:"—",inn:"781234567890",passport:"4015 987654"},
  {fio:"Сидоров Алексей Игоревич",phone:"+7 (903) 777-88-99",email:"asidorov@mail.ru",address:"г. Казань, ул. Баумана, д. 22",social:"t.me/sidorov_ai, vk.com/sidorov",auto:"Lada Vesta, K789MN16",property:"дом 120 м² Казань",court:"Арбитраж РТ № А65-7890/2023",inn:"161234567800",passport:"9203 456712"},
  {fio:"Козлова Елена Андреевна",phone:"+7 (968) 444-56-78",email:"elenakoz@bk.ru",address:"г. Екатеринбург, ул. Ленина, д. 8, кв. 5",social:"vk.com/koz_elena, ok.ru/elena.kozlova",auto:"Kia Rio, A321BC96",property:"кв. 33 м² ЕКБ",court:"—",inn:"661234567800",passport:"6512 345678"},
  {fio:"Михайлов Денис Олегович",phone:"+7 (926) 333-44-55",email:"mikhaylov.do@inbox.ru",address:"г. Новосибирск, ул. Советская, д. 100, кв. 201",social:"t.me/mikh_do, instagram.com/mikh_do",auto:"BMW X5, M555NN54",property:"кв. 90 м² НСК, дом 150 м² НСО",court:"АС НСО № А45-23456/2024",inn:"541234567800",passport:"5214 987123"},
  {fio:"Григорьев Павел Сергеевич",phone:"+7 (916) 111-22-44",email:"grigoriev.ps@gmail.com",address:"г. Краснодар, ул. Красная, д. 55",social:"vk.com/grigps",auto:"Mitsubishi Outlander, E777AA93",property:"кв. 55 м² КРД",court:"АС КК № А32-34567/2024",inn:"231234567800",passport:"0314 567890"},
  {fio:"Николаев Артём Владимирович",phone:"+7 (912) 888-99-00",email:"nikolaev.av@list.ru",address:"г. Пермь, ул. Сибирская, д. 12, кв. 8",social:"t.me/nikol_art",auto:"Skoda Octavia, T888AB59",property:"дом 85 м² ПЕРМЬ",court:"—",inn:"591234567800",passport:"5712 345012"},
  {fio:"Соколова Ольга Игоревна",phone:"+7 (915) 666-77-88",email:"sokolova.oi@yandex.ru",address:"г. Красноярск, ул. Ленина, д. 30, кв. 15",social:"vk.com/olga_sokolova",auto:"Nissan Qashqai, H444KK24",property:"кв. 48 м² КРС",court:"АС КК № А33-45678/2024",inn:"241234567800",passport:"0405 123789"},
  {fio:"Зайцев Владимир Петрович",phone:"+7 (917) 222-33-44",email:"zaytsev.vp@gmail.com",address:"г. Воронеж, ул. Плехановская, д. 5, кв. 30",social:"t.me/zaytsev_vp",auto:"Volkswagen Polo, P111AA36",property:"кв. 40 м² ВРН",court:"—",inn:"361234567800",passport:"2008 456789"},
  {fio:"Тимофеева Мария Александровна",phone:"+7 (926) 555-66-77",email:"timofeeva.ma@bk.ru",address:"г. Уфа, ул. Октября, д. 77, кв. 56",social:"instagram.com/maria_timo, vk.com/maria_t",auto:"Renault Logan, M333MP02",property:"кв. 52 м² УФА",court:"АС РБ № А07-56789/2023",inn:"021234567800",passport:"8018 234567"},
  {fio:"Морозов Дмитрий Андреевич",phone:"+7 (903) 444-55-66",email:"morozov.da@inbox.ru",address:"г. Ростов-на-Дону, ул. Б. Садовая, д. 45",social:"vk.com/morozov_da",auto:"Kia Sportage, C666BT61",property:"кв. 60 м² РНД",court:"—",inn:"611234567800",passport:"6003 890123"},
  {fio:"Белова Наталья Сергеевна",phone:"+7 (965) 777-88-99",email:"belova.ns@yandex.ru",address:"г. Нижний Новгород, ул. Горького, д. 18",social:"t.me/belova_ns, vk.com/belova_ns",auto:"Chevrolet Cruze, B888MM52",property:"кв. 58 м² НН",court:"АС НО № А43-67890/2024",inn:"521234567800",passport:"2205 456890"},
  {fio:"Кузнецов Иван Алексеевич",phone:"+7 (915) 111-22-55",email:"kuznetsov.ia@mail.ru",address:"г. Волгоград, ул. Советская, д. 10, кв. 12",social:"vk.com/kuznetsov.ia",auto:"N/A",property:"кв. 35 м² ВЛГ",court:"—",inn:"341234567800",passport:"1809 123456"},
  {fio:"Андреева Екатерина Павловна",phone:"+7 (968) 333-44-11",email:"andreeva.ep@gmail.com",address:"г. Самара, ул. Куйбышева, д. 88, кв. 7",social:"t.me/andreeva_ep",auto:"Mazda CX-5, A777XA63",property:"кв. 72 м² СМР",court:"—",inn:"631234567800",passport:"3604 234567"},
  {fio:"Фёдоров Максим Романович",phone:"+7 (916) 999-88-77",email:"fedorov.mr@bk.ru",address:"г. Челябинск, ул. Кирова, д. 25, кв. 33",social:"vk.com/fed_mr, t.me/fed_mr",auto:"Toyota RAV4, O444OO74",property:"дом 95 м² ЧЛБ",court:"АС ЧО № А76-78901/2024",inn:"741234567800",passport:"7512 567890"},
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    await ensureTable(sql);

    await sql`DELETE FROM records`;

    let count = 0;
    for (const row of SEED_DATA) {
      await sql`
        INSERT INTO records (fio, phone, email, address, social, auto, property, court, inn, passport)
        VALUES (${row.fio}, ${row.phone}, ${row.email}, ${row.address}, ${row.social},
                ${row.auto}, ${row.property}, ${row.court}, ${row.inn}, ${row.passport})
      `;
      count++;
    }

    res.json({ message: 'База заполнена демо-данными', count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};