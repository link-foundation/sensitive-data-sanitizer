// Reproduces each section of issue 130 with the policy given there.
import { createSyncSanitizer } from '../../src/index.js';
import { performance } from 'node:perf_hooks';

const policy = (extra = {}) => ({
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false, credentials: true },
  ...extra,
});
const run = (label, text, options = policy()) => {
  try {
    const s = createSyncSanitizer(options);
    console.log(
      label,
      JSON.stringify(text),
      '->',
      JSON.stringify(s.sanitize(text).text)
    );
  } catch (error) {
    console.log(label, JSON.stringify(text), '-> throws', error.code);
  }
};
const section = process.argv[2] ?? 'all';
const keep = policy({
  transformation: {
    mode: 'placeholder',
    map: false,
    credentials: true,
    existing: 'keep',
  },
});
if (section === 'all' || section === '1') {
  run('1', 'Звонила Анна Смирнова, тел. +7 916 123-45-67');
  run('1', 'ProperName-1 Person-1, тел. Phone-1', keep);
  run(
    '1',
    'ProperName-1 Person-1, тел. Phone-1; перезвонил Пётр Сидоров',
    keep
  );
}
if (section === 'all' || section === '2') {
  const json = policy({ structured: 'json', sensitiveFields: ['notes'] });
  run('2', '{"notes":"любой текст"}', json);
  run('2', '{"age":34,"msg":"ok"}', policy({ structured: 'json' }));
  run('2', 'ему 30 лет');
}
if (section === 'all' || section === '3') {
  for (const text of [
    'Здравствуйте! Я Анна Смирнова, готова выйти',
    'Меня зовут Анна Смирнова',
    'Работал в ООО «Ромашка», живу в Казани',
    'Кандидат Петров Иван Сергеевич, тел. +7 916 123-45-67',
    'Иванов Иван Петрович работал в Лютике, позвонил Иванову',
    'Иванов Иван работал в Лютике, позвонил Иванову',
    'Звонила Анна Смирнова',
  ]) {
    run('3', text);
  }
  run(
    '3',
    '{"url":"Меня зовут Анна Смирнова, тел. +7 916 123-45-67"}',
    policy({ structured: 'json' })
  );
}
if (section === 'all' || section === '4') {
  for (const text of [
    'узбечка по национальности',
    'он узбек',
    'таджик по национальности',
    'чеченец',
    'грузинка по национальности',
    'азербайджанец, 30 лет',
    'цыганка',
    'кореянка по происхождению',
    'he is Uzbek',
    'протестант',
    'перенес инсульт',
    'шизофрения',
    'слабослышащий',
    'передвигается на коляске, колясочник',
    'аутизм',
    'wheelchair user',
    'бисексуал',
    'трансгендер',
    'сидел за кражу',
    'член профсоюза',
    'trade union member',
    'татарка',
    'мусульманка',
    'has HIV',
    'имеет судимость',
  ]) {
    run('4', text);
  }
}
if (section === 'all' || section === '7') {
  const text = 'request completed in 12 ms';
  for (const mode of ['redact', 'placeholder']) {
    const s = createSyncSanitizer(
      policy({
        transformation: {
          mode,
          ...(mode === 'placeholder' ? { map: false, credentials: true } : {}),
        },
      })
    );
    for (let i = 0; i < 50; i++) {
      s.sanitize(text);
    }
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      s.sanitize(text);
    }
    console.log(
      '7',
      mode,
      ((performance.now() - start) / 200).toFixed(3),
      'ms/call'
    );
  }
}
