import { collectMatches } from './detection.js';
import { credentialPlaceholder } from './credentials.js';

// Phrase-level evidence collected from competitor test suites (#128):
// self-introductions, letter salutations and sign-offs, mail display names,
// spelled-out e-mail addresses, post-office boxes, labelled messenger
// handles, username/password pairs and labelled card numbers.
const personal = (type, rule, confidence = 0.85) => ({
  type,
  rule,
  category: 'personal',
  confidence,
});
const word = "\\p{Lu}[\\p{Ll}\\p{M}'’]+(?:\\p{Lu}[\\p{Ll}\\p{M}]+)?";
const nameWords = `${word}(?:-${word})?(?:[ \\t]+(?:${word}(?:-${word})?|\\p{Lu}\\.)){0,2}`;
// Addressees and senders that are roles, not people.
const roleWord =
  /^(?:Sir|Madam|Madame|Sirs|All|Everyone|Everybody|Team|Folks|Friends?|Colleagues?|Customer|Client|User|Users|Members?|Support|Admin|Team[ \t].*|Hiring[ \t]+Manager|Recruiter|There|Guys|Again|You|Me|Us|Them|God|Mom|Dad|Sorry|Thanks|Yes|No|Not|Here|Also|Just|Back|Done|OK|Okay|The|Our|Your|My|This|World)$/iu;
const person = (value) =>
  !roleWord.test(value) && !roleWord.test(value.split(/[ \t]+/)[0]);

const dash = '(?:-{1,2}|—|–|\\.{2,3}|~)';
function detectNames(text, emit) {
  // "My name is Bond", "I'm called Jane Doe"
  collectMatches(
    text,
    new RegExp(
      `(?<![\\p{L}\\p{N}_])(?:[Mm]y[ \\t]+name[ \\t]+is|[Nn]ame's|I[ \\t]+am[ \\t]+called|[Cc]all[ \\t]+me)[ \\t]+(${nameWords})(?![\\p{L}\\p{M}])`,
      'gu'
    ),
    emit,
    personal('PERSON', 'self-introduction', 0.9),
    1,
    person
  );
  // "Dear Clifford," and "Hi Jane Doe," at the start of a line.
  collectMatches(
    text,
    new RegExp(
      `(?:^|(?<=[\\r\\n]))[ \\t]*(?:Dear|Hi|Hello|Hey|Greetings)[ \\t]+(${nameWords})[ \\t]*[,!:]`,
      'gmu'
    ),
    emit,
    personal('PERSON', 'salutation', 0.85),
    1,
    person
  );
  // "Thanks -Jon", "All the best,\n\n--Meg C.", "Thank you ..Risemamy McCrubben"
  collectMatches(
    text,
    new RegExp(
      `(?<![\\p{L}\\p{N}_])(?:Thanks|Thank[ \\t]+you|Many[ \\t]+thanks|Regards|Best[ \\t]+regards|Kind[ \\t]+regards|Warm[ \\t]+regards|Best[ \\t]+wishes|All[ \\t]+the[ \\t]+best|Cheers|Sincerely|Yours[ \\t]+(?:truly|sincerely)|Best)(?:[ \\t]*[,!.]?[ \\t]*(?:\\r?\\n[ \\t]*){1,3}${dash}?|[ \\t]*[,!.][ \\t]*${dash}?|[ \\t]*${dash})[ \\t]*(${nameWords})[ \\t]*\\.?[ \\t]*(?=\\r?\\n|$)`,
      'gu'
    ),
    emit,
    personal('PERSON', 'sign-off', 0.85),
    1,
    person
  );
  // Mail display names: `Bob Stone <bob.stone@example.com>`.
  collectMatches(
    text,
    new RegExp(
      `(?<![\\p{L}\\p{N}_])"?(${word}(?:[ \\t]+(?:${word}|\\p{Lu}\\.)){1,3})"?[ \\t]*<[^\\s<>@]+@[^\\s<>@]+>`,
      'gu'
    ),
    emit,
    personal('PERSON', 'mail-display-name', 0.9),
    1,
    person
  );
}

const freemail =
  'gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|yandex|zoho|fastmail|hey|tutanota|qq|163|126|naver|web';
const at =
  '(?:[ \\t]*[[({<][ \\t]*at[ \\t]*[\\])}>][ \\t]*|[ \\t]+at[ \\t]+|@)';
const dot =
  '(?:[ \\t]*[[({<][ \\t]*dot[ \\t]*[\\])}>][ \\t]*|[ \\t]+dot[ \\t]+|\\.)';
const obfuscatedEmail = new RegExp(
  `(?<![\\p{L}\\p{N}_.+-])[\\p{L}\\p{N}_+-]+(?:${dot}[\\p{L}\\p{N}_+-]+)*${at}[\\p{L}\\p{N}-]+(?:${dot}[\\p{L}\\p{N}-]+)*${dot}\\p{L}{2,24}(?![\\p{L}\\p{N}_-])`,
  'giu'
);
// Spelled-out separators are evidence; a plain " at " needs a well-known
// mailbox provider so that "meet at example.com" stays prose.
function spelledEmail(value) {
  const bracketed = /[[({<][ \t]*(?:at|dot)[ \t]*[\])}>]/i.test(value);
  const spelled = /[ \t]dot[ \t]/i.test(value);
  const plainAt = new RegExp(
    `[ \\t]at[ \\t]+(?:${freemail})\\.[a-z]{2,6}(?:\\.[a-z]{2})?$`,
    'i'
  ).test(value);
  return (
    !/^[^@]+@[^@\s[({<]+$/.test(value) && (bracketed || spelled || plainAt)
  );
}

function detectContactForms(text, emit) {
  collectMatches(
    text,
    obfuscatedEmail,
    emit,
    personal('EMAIL', 'obfuscated-email', 0.85),
    0,
    spelledEmail
  );
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_])(?:P\.?[ \t]?O\.?[ \t]?Box|Post[ \t]+Office[ \t]+Box|Postfach|Apartado(?:[ \t]+de[ \t]+correos)?|Caixa[ \t]+Postal|Boîte[ \t]+postale|а\/я|абонентский[ \t]+ящик)[ \t]*#?[ \t]*\d{1,10}(?!\p{N})/giu,
    emit,
    personal('ADDRESS', 'po-box')
  );
  // `skype: dean.malmgren`, `contact me on skype (dean.malmgren)`.
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_])(?:skype|discord|telegram|signal|wechat|whatsapp|keybase|matrix|mastodon|twitter|github|gitlab|instagram|tiktok)(?:[ \t]+(?:id|name|handle|username|user))?[ \t]*(?:[:=][ \t]*|\([ \t]*)(@?[\p{L}\p{N}_][\p{L}\p{N}_.:-]{1,63}[\p{L}\p{N}_])(?=[ \t]*\)|[\s,;!?]|\.(?:\s|$)|$)/giu,
    emit,
    personal('USERNAME', 'messenger-label', 0.85),
    1
  );
}

// "login snoop pw biggreenhat", "u: snoop\np: biggreenhat",
// "user: thislibrary\npass: …": a username label followed by a password
// label marks both values; a lone `user:` is a chat role, not an account.
// Labels with a colon may be short (`u:`/`p:`); bare labels must be the
// unambiguous `login`/`username` and `pw`/`pwd`/`password` words.
const pairSeparator = '[ \\t]*[,;]?[ \\t]*(?:\\r?\\n[ \\t]*)?';
const credentialPair = new RegExp(
  [
    `(?:login|user(?:name)?|u)[ \\t]*[:=][ \\t]*([^\\s:=,;]{2,64})${pairSeparator}(?:pass(?:word)?|passwd|pwd|pw|p)[ \\t]*[:=][ \\t]*(\\S{4,128})`,
    `(?:login|username)[ \\t]+([^\\s:=,;]{2,64})${pairSeparator}(?:password|passwd|pwd|pw)[ \\t]+(\\S{4,128})`,
  ]
    .map((form) => `(?<![\\p{L}\\p{N}_])${form}`)
    .join('|'),
  'giu'
);
const placeholder = /^\[[\p{L}\p{N}_ -]+\]$/u;
function detectCredentialPairs(text, emit) {
  for (const match of text.matchAll(credentialPair)) {
    const user = match[1] ?? match[3];
    const secret = match[2] ?? match[4];
    if (
      placeholder.test(user) ||
      placeholder.test(secret) ||
      credentialPlaceholder(secret)
    ) {
      continue;
    }
    const userStart = match.index + match[0].indexOf(user);
    const secretStart = match.index + match[0].lastIndexOf(secret);
    emit({
      start: userStart,
      end: userStart + user.length,
      ...personal('USERNAME', 'credential-pair', 0.9),
    });
    emit({
      start: secretStart,
      end: secretStart + secret.length,
      type: 'SECRET',
      category: 'credential',
      rule: 'credential-pair',
      confidence: 0.9,
    });
  }
}

// "my AMEX card: 1234 567890 12345": a labelled card keeps its label even when
// the number is a documentation placeholder that fails Luhn.
function detectLabelledCards(text, emit) {
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_])(?:card|visa|mastercard|amex|discover|diners|jcb|unionpay|maestro|карта)(?:[ \t]+(?:no\.?|number|num|#))?[ \t]*[:#]?[ \t]*((?:\d[ -]?){12,18}\d)(?![\p{N}]|[ -]\d)/giu,
    emit,
    personal('CREDIT_CARD', 'card-context', 0.9),
    1
  );
}

const states =
  'AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR';
function detectPostalCodes(text, emit) {
  // "ZIP 94105", "ZIPs 10001 and 30301", "zip code: 94105-1234".
  for (const label of text.matchAll(
    /(?<![\p{L}\p{N}_])(?:ZIP(?:[ \t]?codes?)?s?|postal[ \t]+codes?|PLZ|CEP)[ \t]*[:#]?[ \t]*/giu
  )) {
    const start = label.index + label[0].length;
    const list =
      /^\d{5}(?:-\d{4})?(?:(?:[ \t]*,[ \t]*|[ \t]+(?:and|or|&)[ \t]+)\d{5}(?:-\d{4})?)*(?![\p{L}\p{N}_-])/u.exec(
        text.slice(start, start + 200)
      );
    for (const code of list?.[0].matchAll(/\d{5}(?:-\d{4})?/g) ?? []) {
      emit({
        start: start + code.index,
        end: start + code.index + code[0].length,
        ...personal('POSTAL_CODE', 'postal-label', 0.9),
      });
    }
  }
  // "New York City, NY 10002": a state abbreviation anchors the ZIP code.
  collectMatches(
    text,
    new RegExp(
      `(?<=[\\p{L}.],[ \\t]*)(?:${states})[ \\t]+(\\d{5}(?:-\\d{4})?)(?![\\p{L}\\p{N}_-])`,
      'gu'
    ),
    emit,
    personal('POSTAL_CODE', 'state-zip', 0.85),
    1
  );
}

export function detectPersonalEvidence(text, emit) {
  detectNames(text, emit);
  detectContactForms(text, emit);
  detectCredentialPairs(text, emit);
  detectLabelledCards(text, emit);
  detectPostalCodes(text, emit);
}
