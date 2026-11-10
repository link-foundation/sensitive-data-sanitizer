import { collectMatches } from './detection.js';
import { compiledVocabulary } from './vocabulary.js';

const attributes =
  /(?<![\p{L}\p{N}_])(?:женщин[аыуеой]{1,2}|мужчин[аыуеой]{1,2}|замужем|женат(?:а|ы)?|(?:один|одна|двое|трое|четверо|пятеро|\d{1,2})[ \t]+(?:детей|реб[её]нок|реб[её]нка)|русск(?:ая|ий|ого|ой|ие)|татар(?:ин|ка|ы)|православн(?:ый|ая|ого|ой)|мусульман(?:ин|ка)|инвалидност[ьи](?:[ \t]+\d[ \t]+группы)?|беременн(?:а|ая|ость)|судимость(?:[ \t]+погашена)?|член[ \t]+партии|woman|women|male|female|married|divorced|pregnant|pregnancy|disability|christian|muslim|jewish|orthodox|hispanic|criminal[ \t]+record|party[ \t]+member|(?:one|two|three|\d{1,2})[ \t]+children)(?![\p{L}\p{N}_])/giu;
const additionalAttributes =
  /(?<![\p{L}\p{N}_])(?:диабет(?:ом|а|у|е)?|ВИЧ(?:-положительн(?:ый|ая|ого|ой))?|болен|больна|больны|католик(?:ом|а|и)?|католичк(?:а|ой|и)|буддист(?:ка|кой|ом|а|ы)?|атеист(?:ка|кой|ом|а|ы)?|украин(?:ец|ка|цы|цем|кой)|белорус(?:ка|кой|ом|а|ы)?|несудим(?:а|ы)?|судим(?:а|ы)?|член[ \t]+политической[ \t]+партии|холост(?:а|ы)?|развед[её]н(?:а|ы)?|в[ \t]+разводе|diabetes|diabetic|HIV(?:[ \t-]+positive)?|cancer|buddhist|catholic|atheist|ukrainian|belarusian|previous[ \t]+conviction|member[ \t]+of[ \t]+(?:a[ \t]+)?(?:political[ \t]+)?party|unmarried|widowed)(?![\p{L}\p{N}_])/giu;

// Bounded suffixes cover Russian cases, plurals and adjectival forms without
// turning a stem into an unbounded substring search. Category cues below cover
// unfamiliar diagnoses, nationalities and religions outside this lexicon.
const categoryForms =
  /(?<![\p{L}\p{N}_])(?:(?:диабет|католик|католич|буддист|атеист|белорус|православн|беременн|судим)[\p{L}]{0,8}|татар(?:ин(?:а|у|ом|е)?|к[аиуе]|кой|ы|ам|ами|ах)?|мусульман(?:ин(?:а|у|ом|е)?|к[аиуе]|кой|е|ам|ами|ах)?|украин(?:ец|ца|цу|цем|це|цы|цев|цам|цами|цах|к[аиуе]|кой)|инвалид(?:а|у|ом|е|ы|ов|ам|ами|ах|к[аиу]|кой)?|армян(?:ин|ина|ину|ином|ине|е|ам|ами|ах|ка|ки|ке|ку|кой)|евре(?:й|я|ю|ем|и|ев|ям|ями|ях|йк[аиуе]|йкой)|казах(?:а|у|ом|е|и|ов|ам|ами|ах|к[аиуе]|кой)?|христиан(?:ин|ина|ину|ином|ине|е|ам|ами|ах|к[аиуе]|кой)|иуде(?:й|я|ю|ем|и|ев|ям|ями|ях|йк[аиуе]|йкой)|ислам[\p{L}]{0,5}|эпилепси[\p{L}]{1,5}|астм[\p{L}]{1,5}|онкологи[\p{L}]{1,5}|туберкул[её]з[\p{L}]{0,5}|психиатр[\p{L}]{0,6}|депресси[\p{L}]{1,5}|гепатит[\p{L}]{0,5}|гомосексуал[\p{L}]{0,7}|лесбиян[\p{L}]{1,5}|ге(?:й|я|ю|ем|и|ев|ям|ями|ях)|нетрадиционн[\p{L}]{2,3}[ \t]+ориентаци[\p{L}]{1,3}|отбыва(?:л[аи]?|ет|ют|вш[\p{L}]{2,3})[ \t]+наказани[\p{L}]{1,3}|ВИЧ-инфицирован[\p{L}]{0,4}|epilepsy|asthma|tuberculosis|hepatitis|depression|gay|lesbian|homosexual|bisexual|armenian)(?![\p{L}\p{N}_])/giu;
// Nationality nouns with their case endings and feminine forms. Exact endings
// keep country and region names (`Узбекистан`, `Чувашия`) out of the match.
const hardNoun = '(?:а|у|ом|е|ы|ов|ам|ами|ах)?';
const softNoun = '(?:а|у|ом|е|и|ей|ам|ами|ах)?';
const ecNoun = '(?:ец|ц(?:а|у|ем|е|ы|ев|ам|ами|ах))';
const femaleNoun = '(?:а|и|е|у|ой)';
const nationalities = [
  `кабардин${ecNoun}|кабардинк${femaleNoun}`,
  `казашк${femaleNoun}`,
  `мордвин${hardNoun}|мордовк${femaleNoun}`,
  `удмурт${hardNoun}|удмуртк${femaleNoun}`,
  `молдаванин(?:а|у|ом|е)?|молдаван${hardNoun}|молдаванк${femaleNoun}`,
  `узбек${softNoun}|узбечк${femaleNoun}`,
  `таджик${softNoun}|таджичк${femaleNoun}`,
  `(?:киргиз|кыргыз)${hardNoun}|(?:киргиз|кыргыз)к${femaleNoun}`,
  `туркмен${hardNoun}|туркменк${femaleNoun}`,
  `чечен${ecNoun}|чеченк${femaleNoun}`,
  `ингуш${softNoun}|ингушк${femaleNoun}`,
  `осетин${hardNoun}|осетинк${femaleNoun}`,
  `грузин${hardNoun}|грузинк${femaleNoun}`,
  `азербайджан${ecNoun}|азербайджанк${femaleNoun}`,
  `цыган${hardNoun}|цыганк${femaleNoun}`,
  `коре(?:ец|йц(?:а|у|ем|е|ы|ев|ам|ами|ах))|кореянк${femaleNoun}`,
  `кита(?:ец|йц(?:а|у|ем|е|ы|ев|ам|ами|ах))|китаянк${femaleNoun}`,
  `башкир${hardNoun}|башкирк${femaleNoun}`,
  `чуваш${softNoun}|чувашк${femaleNoun}`,
  `якут${hardNoun}|якутк${femaleNoun}`,
  `бурят${hardNoun}|бурятк${femaleNoun}`,
  `калмык${softNoun}|калмычк${femaleNoun}`,
  `лезгин${hardNoun}|лезгинк${femaleNoun}`,
  `авар${ecNoun}|аварк${femaleNoun}`,
  `дагестан${ecNoun}|дагестанк${femaleNoun}`,
  `уйгур${hardNoun}|уйгурк${femaleNoun}`,
].join('|');
const believerNoun = `(?:а|у|ом|е|ы|ов|ам|ами|ах|к${femaleNoun}|кой)?`;
// These terms are sensitive even without an adjacent personal cue. Keep
// bounded endings and whole-word boundaries, as for the existing categories.
const followUpVocabulary = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:иудаизм${hardNoun}|старовер${believerNoun}|эпилептик${softNoun}|паралич${softNoun}|наркомани[\\p{L}]{1,4}|профсоюз${hardNoun}|коммунист${believerNoun}|uzbek|tajik|chechen|romani|gypsy|latino|latina|baptist|aids|bipolar|adhd|wheelchair|lgbt|convicted|felony|trade[ \\t]+union)(?![\\p{L}\\p{N}_])`,
  'giu'
);
const specialVocabulary = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${nationalities}|(?:протестант|баптист|адвентист|индуист|кришнаит|иеговист|пятидесятник)${believerNoun}|лютеран(?:ин(?:а|у|ом|е)?|к${femaleNoun}|кой|е|ам|ами|ах)|старообряд${ecNoun}|старообрядк${femaleNoun}|свидетел[\\p{L}]{1,3}[ \\t]+иеговы|инсульт[\\p{L}]{0,3}|инфаркт[\\p{L}]{0,3}|шизофрени[\\p{L}]{1,4}|аутизм[\\p{L}]{0,3}|аутист(?:ка|ки|ке|ку|кой|а|у|ом|ы|ов)?|слабослышащ[\\p{L}]{1,4}|слабовидящ[\\p{L}]{1,4}|незряч[\\p{L}]{1,4}|дцп|колясочни(?:к${hardNoun}|ц${femaleNoun})|(?:передвига[\\p{L}]{1,5}|инвалидн[\\p{L}]{2,4})[ \\t]+(?:на[ \\t]+)?коляск[\\p{L}]{1,3}|болезн[\\p{L}]{1,3}[ \\t]+(?:паркинсона|альцгеймера)|деменци[\\p{L}]{1,3}|алкоголизм[\\p{L}]{0,2}|наркозависим[\\p{L}]{0,4}|биполярн[\\p{L}]{2,4}[ \\t]+расстройств[\\p{L}]{0,3}|(?:би|транс|пан|а)сексуал[\\p{L}]{0,6}|трансгендер[\\p{L}]{0,6}|(?:сидел[аи]?|отсидел[аи]?|осужд[её]н[аы]?|привлекал(?:ся|ась|ись)|отбывал[аи]?[ \\t]+срок)[ \\t]+(?:за|по)[ \\t]+(?:краж|грабе|разбо|убийств|мошенничеств|наркотик|хулиганств|изнасиловани|взятк|стать)[\\p{L}]{0,4}(?:[ \\t]+\\d{1,3}(?:\\.\\d)?)?|(?:сидел[аи]?|отсидел[аи]?)[ \\t]+(?:в[ \\t]+)?(?:тюрьм[\\p{L}]{1,2}|колони[\\p{L}]{1,2}|срок)|бывш[\\p{L}]{2,3}[ \\t]+заключ[её]нн[\\p{L}]{2,3}|член[\\p{L}]{0,3}[ \\t]+профсоюз[\\p{L}]{0,3}|состо(?:ит|ял[аи]?|ю|ят)[ \\t]+в[ \\t]+профсоюзе|профсоюзн(?:ый|ая|ого|ой)[ \\t]+(?:активист|деятел|лидер)[\\p{L}]{0,3}|autism|autistic|schizophreni[ac]|transgender|transsexual|pansexual|asexual|wheelchair[ \\t]+users?|uses[ \\t]+a[ \\t]+wheelchair|in[ \\t]+a[ \\t]+wheelchair|(?:hearing|visually)[ \\t-]+impaired|had[ \\t]+a[ \\t]+(?:stroke|heart[ \\t]+attack)|dementia|alzheimer'?s|parkinson'?s|bipolar[ \\t]+disorder|alcoholism|trade[ \\t]+union[ \\t]+member(?:ship)?|member[ \\t]+of[ \\t]+(?:a|the)[ \\t]+(?:trade|labou?r)[ \\t]+union|convicted[ \\t]+(?:of|for)[ \\t]+[\\p{L}]{3,32}|served[ \\t]+(?:time[ \\t]+(?:in|for)|a[ \\t]+(?:prison[ \\t]+)?sentence)|protestant|lutheran|mormon|hindu|sikh|jehovah'?s[ \\t]+witness)(?![\\p{L}\\p{N}_])`,
  'giu'
);
const categoryCue =
  /(?<![\p{L}\p{N}_])(?:по[ \t]+(?:национальности|происхождению)|национальность|этничность|вероисповедание|религия|диагноз|исповеду(?:ет|ют|ю|ешь)|боле(?:ет|ют|ю|ешь)|страда(?:ет|ют|ю|ешь)[ \t]+от|на[ \t]+уч[её]те[ \t]+у|diagnosed[ \t]+with|suffers[ \t]+from|nationality|ethnicity|religion|diagnosis)(?:["']?[ \t]*[:=][ \t]*|[ \t]+)["']?([\p{L}][\p{L}\p{M}-]{0,63})(?![\p{L}\p{M}\p{N}_])/giu;
// Words that are also languages, scripts or styles need a personal context.
const ambiguous =
  /(?<![\p{L}\p{N}_])(?:disabled|single|man|men|russian|asian|azerbaijani|korean|chinese|georgian|kazakh|kyrgyz|turkmen|uyghur|roma|union[ \t]+member)(?![\p{L}\p{N}_])/giu;

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
  for (const pattern of [
    attributes,
    additionalAttributes,
    categoryForms,
    specialVocabulary,
    followUpVocabulary,
    compiledVocabulary(options.vocabulary)?.attributes,
  ]) {
    if (pattern) {
      collectMatches(text, pattern, report, details);
    }
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
