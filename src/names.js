// A small offline gazetteer plus script-specific name grammar. This is a
// transparent baseline, not a statistical NER model. Applications can union
// their own model with it through the required detector interface.
export const firstNames = {
  en: 'John James Robert Michael William David Joseph Thomas Charles Mary Patricia Jennifer Linda Elizabeth Barbara Susan Jessica Sarah Alice Jane Peter Paul Mark Daniel George Emma Olivia Noah Liam Jack Henry Benjamin Anthony Andrew Steven Edward Richard Helen Margaret Nancy Carol Anna Martin Albert Bill Elon',
  es: 'José Juan Carlos Luis Jorge Pedro Miguel Antonio Francisco Jesús Manuel María Carmen Ana Laura Isabel Elena Marta Lucía Sofía Javier Alejandro Diego Raúl Pablo Teresa Rosa',
  fr: 'Jean Pierre Michel André Philippe Jacques François Louis Nicolas Antoine Julien Gabriel Étienne Marie Jeanne Françoise Catherine Isabelle Monique Sylvie Nathalie Sophie Camille Émilie Chloé Zoë',
  de: 'Hans Klaus Wolfgang Jürgen Günter Dieter Karl Heinrich Wilhelm Friedrich Johann Alexander Lukas Leon Julia Hannah Emilia Lena Mia Sabine Ursula Ingrid Petra Monika Helga',
  pt: 'João José Antônio Francisco Paulo Pedro Lucas Gabriel Rafael Bruno Carlos Maria Ana Beatriz Camila Larissa Mariana Fernanda Juliana Aline Bruna',
  ruLatn:
    'Ivan Petr Pyotr Sergey Sergei Aleksandr Alexander Alexey Aleksey Dmitry Dmitri Mikhail Nikolai Andrey Vladimir Pavel Viktor Oleg Boris Evgeny Vasily Yuri Marina Anna Mariya Elena Olga Natalya Irina Svetlana Tatyana Ekaterina Anastasia Yulia',
  jaLatn: 'Yamada Sato Suzuki Takahashi Tanaka Ito Watanabe Nakamura Kobayashi',
  zhLatn:
    'Zhang Wang Li Zhao Liu Chen Yang Huang Zhou Wu Xu Sun Hu Zhu Gao Lin',
  ru: 'Иван Пётр Петр Сергей Александр Алексей Дмитрий Михаил Николай Андрей Владимир Павел Виктор Олег Борис Евгений Василий Юрий Марина Анна Мария Елена Ольга Наталья Ирина Светлана Татьяна Екатерина Анастасия Юлия Ивану Ивана Иваном Сергея Сергею Александра Александру Анне Анну Елены',
  ja: '山田 佐藤 鈴木 高橋 田中 伊藤 渡辺 渡邊 中村 小林 加藤 吉田 松本 山本 井上 木村 林 清水 斎藤 斉藤',
  zh: '张 王 李 赵 刘 陈 杨 黄 周 吴 徐 孙 胡 朱 高 林 何 郭 马 罗 張 趙 劉 陳 楊 黃 吳 孫 馬 羅',
  ko: '김 이 박 최 정 강 조 윤 장 임 한 오 서 신 권 황 안 송 전 홍 유 고 문 양 손 배 백',
  ar: 'محمد أحمد احمد علي حسن حسين عمر خالد يوسف إبراهيم ابراهيم عبدالله عبد الرحمن محمود مصطفى سامي سعيد فاطمة مريم عائشة زينب نور ليلى سارة',
  he: 'דוד משה יוסף אברהם יצחק יעקב דניאל חיים שלמה אהרון ישראל שרה רחל לאה מרים חנה רבקה נועה תמר יעל',
  hi: 'आरव विवान आदित्य अर्जुन कृष्ण राहुल रोहित अमित विजय सुरेश रमेश राजेश संजय अनिल सुनील प्रिया पूजा नेहा अंजली आशा मीरा आरती लक्ष्मी सीता',
  tr: 'Mehmet Mustafa Ahmet Ali Hüseyin Hasan İbrahim Murat Yusuf Emre Ömer Ayşe Fatma Emine Hatice Zeynep Elif Merve Esra Selin',
  id: 'Budi Ahmad Muhammad Agus Bambang Dedi Eko Hadi Joko Rudi Siti Sri Dewi Putri Ayu Wati Lestari Ratna Indah',
  vi: 'Nguyễn Trần Lê Phạm Hoàng Huỳnh Phan Vũ Võ Đặng Bùi Đỗ Hồ Ngô Dương Lý',
  th: 'สมชาย สมศักดิ์ สุชาติ วิชัย ประเสริฐ สมพร สุรชัย อนุชา กิตติ วัฒนา สมหญิง สุภา จันทร์เพ็ญ มาลี สุดา อรทัย',
};

export const nameExamples = [
  ['en', 'John Smith'],
  ['es', 'Juan García'],
  ['fr', 'Jean Dupont'],
  ['de', 'Hans Müller'],
  ['pt', 'João Silva'],
  ['ru', 'Иван Петров'],
  ['ja', '山田太郎'],
  ['zh', '张三'],
  ['zh-Hant', '張三'],
  ['ko', '김민수'],
  ['ar', 'محمد علي'],
  ['he', 'דוד כהן'],
  ['hi', 'आरव शर्मा'],
  ['tr', 'Mehmet Yılmaz'],
  ['id', 'Budi Santoso'],
  ['vi', 'Nguyễn Văn An'],
  ['th', 'สมชาย ใจดี'],
];
