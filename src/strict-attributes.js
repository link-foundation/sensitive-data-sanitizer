import { collectMatches } from './detection.js';

const attributes =
  /(?<![\p{L}\p{N}_])(?:женщин[аыуеой]{1,2}|мужчин[аыуеой]{1,2}|замужем|женат(?:а|ы)?|(?:один|одна|двое|трое|четверо|пятеро|\d{1,2})[ \t]+(?:детей|реб[её]нок|реб[её]нка)|русск(?:ая|ий|ого|ой|ие)|татар(?:ин|ка|ы)|православн(?:ый|ая|ого|ой)|мусульман(?:ин|ка)|инвалидност[ьи](?:[ \t]+\d[ \t]+группы)?|беременн(?:а|ая|ость)|судимость(?:[ \t]+погашена)?|член[ \t]+партии|woman|women|male|female|married|divorced|pregnant|pregnancy|disability|christian|muslim|jewish|orthodox|hispanic|criminal[ \t]+record|party[ \t]+member|(?:one|two|three|\d{1,2})[ \t]+children)(?![\p{L}\p{N}_])/giu;
const additionalAttributes =
  /(?<![\p{L}\p{N}_])(?:диабет(?:ом|а|у|е)?|ВИЧ(?:-положительн(?:ый|ая|ого|ой))?|болен|больна|больны|католик(?:ом|а|и)?|католичк(?:а|ой|и)|буддист(?:ка|кой|ом|а|ы)?|атеист(?:ка|кой|ом|а|ы)?|украин(?:ец|ка|цы|цем|кой)|белорус(?:ка|кой|ом|а|ы)?|несудим(?:а|ы)?|судим(?:а|ы)?|член[ \t]+политической[ \t]+партии|холост(?:а|ы)?|развед[её]н(?:а|ы)?|в[ \t]+разводе|diabetes|diabetic|HIV(?:[ \t-]+positive)?|cancer|buddhist|catholic|atheist|ukrainian|belarusian|previous[ \t]+conviction|member[ \t]+of[ \t]+(?:a[ \t]+)?(?:political[ \t]+)?party|unmarried|widowed)(?![\p{L}\p{N}_])/giu;

// Bounded suffixes cover Russian cases, plurals and adjectival forms without
// turning a stem into an unbounded substring search. Category cues below cover
// unfamiliar diagnoses, nationalities and religions outside this lexicon.
const categoryForms =
  /(?<![\p{L}\p{N}_])(?:(?:диабет|католик|католич|буддист|атеист|белорус|православн|беременн|судим)[\p{L}]{0,8}|татар(?:ин(?:а|у|ом|е)?|к[аиуе]|кой|ы|ам|ами|ах)?|мусульман(?:ин(?:а|у|ом|е)?|к[аиуе]|кой|е|ам|ами|ах)?|украин(?:ец|ца|цу|цем|це|цы|цев|цам|цами|цах|к[аиуе]|кой)|инвалид(?:а|у|ом|е|ы|ов|ам|ами|ах|к[аиу]|кой)?|армян(?:ин|ина|ину|ином|ине|е|ам|ами|ах|ка|ки|ке|ку|кой)|евре(?:й|я|ю|ем|и|ев|ям|ями|ях|йк[аиуе]|йкой)|казах(?:а|у|ом|е|и|ов|ам|ами|ах|к[аиуе]|кой)?|христиан(?:ин|ина|ину|ином|ине|е|ам|ами|ах|к[аиуе]|кой)|иуде(?:й|я|ю|ем|и|ев|ям|ями|ях|йк[аиуе]|йкой)|ислам[\p{L}]{0,5}|эпилепси[\p{L}]{1,5}|астм[\p{L}]{1,5}|онкологи[\p{L}]{1,5}|туберкул[её]з[\p{L}]{0,5}|психиатр[\p{L}]{0,6}|депресси[\p{L}]{1,5}|гепатит[\p{L}]{0,5}|гомосексуал[\p{L}]{0,7}|лесбиян[\p{L}]{1,5}|ге(?:й|я|ю|ем|и|ев|ям|ями|ях)|нетрадиционн[\p{L}]{2,3}[ \t]+ориентаци[\p{L}]{1,3}|отбыва(?:л[аи]?|ет|ют|вш[\p{L}]{2,3})[ \t]+наказани[\p{L}]{1,3}|ВИЧ-инфицирован[\p{L}]{0,4}|epilepsy|asthma|tuberculosis|hepatitis|depression|gay|lesbian|homosexual|bisexual|armenian)(?![\p{L}\p{N}_])/giu;
const categoryCue =
  /(?<![\p{L}\p{N}_])(?:по[ \t]+национальности|национальность|этничность|вероисповедание|религия|диагноз|исповеду(?:ет|ют|ю|ешь)|боле(?:ет|ют|ю|ешь)|страда(?:ет|ют|ю|ешь)[ \t]+от|на[ \t]+уч[её]те[ \t]+у|diagnosed[ \t]+with|suffers[ \t]+from|nationality|ethnicity|religion|diagnosis)(?:["']?[ \t]*[:=][ \t]*|[ \t]+)["']?([\p{L}][\p{L}\p{M}-]{0,63})(?![\p{L}\p{M}\p{N}_])/giu;
const ambiguous =
  /(?<![\p{L}\p{N}_])(?:disabled|single|man|men|russian|asian)(?![\p{L}\p{N}_])/giu;

function personalContext(text, match) {
  const prefix = text.slice(Math.max(0, match.index - 128), match.index);
  const suffix = text.slice(
    match.index + match[0].length,
    match.index + match[0].length + 64
  );
  // These continuations remain technical even after a pronoun ("it is a
  // single-flight lock"). No document-wide cue can authorize another clause.
  if (
    /^(?:-flight\b|[ \t]+(?:page|pages|run|worker|thread|lock|region|endpoint|locale|module|feature|flag)\b)/iu.test(
      suffix
    )
  ) {
    return false;
  }
  return (
    /(?<![\p{L}\p{N}_])(?:i|he|she|we|they|candidate|applicant|patient|person|employee)(?:[ \t]+(?:am|is|are|was|were|identifies[ \t]+as))?(?:[ \t]+(?:a|an))?[ \t]+$/iu.test(
      prefix
    ) ||
    /(?<![\p{L}\p{N}_])(?:gender|sex|nationality|ethnicity|marital[ \t_-]*status|disability)(?:["'][ \t]*)?[ \t]*[:=][ \t]*["']?$/iu.test(
      prefix
    ) ||
    /^[ \t]+(?:candidate|applicant|patient|person|people|employee)(?![\p{L}\p{N}_])/iu.test(
      suffix
    )
  );
}

export function detectStrictAttributes(text, emit, options) {
  let detected = 0,
    suppressed = 0;
  const details = {
    type: 'PERSONAL_ATTRIBUTE',
    rule: 'strict-attribute',
    category: 'personal',
    confidence: 0.9,
  };
  const report = (finding) => {
    detected++;
    emit(finding);
  };
  for (const pattern of [attributes, additionalAttributes, categoryForms]) {
    collectMatches(text, pattern, report, details);
  }
  collectMatches(text, categoryCue, report, details, 1);
  collectMatches(text, ambiguous, report, details, 0, (_value, match) => {
    const accepted = personalContext(text, match);
    if (!accepted) {
      suppressed++;
    }
    return accepted;
  });
  options.debug?.({ event: 'strict-attributes', detected, suppressed });
}
