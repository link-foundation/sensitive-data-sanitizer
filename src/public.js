// Exact public knowledge and narrowly scoped role-mail heuristics. A role name
// alone is never an exemption on an unknown/personal domain. Credentials and
// caller-specified private values always outrank these automatic exceptions.
export const publicKnowledge = {
  PERSON: [
    ['Albert Einstein', 'Q937'],
    ['Marie Curie', 'Q7186'],
    ['Isaac Newton', 'Q935'],
    ['Charles Darwin', 'Q1035'],
    ['Alan Turing', 'Q7251'],
    ['Ada Lovelace', 'Q7259'],
    ['Bill Gates', 'Q5284'],
    ['Elon Musk', 'Q317521'],
    ['Linus Torvalds', 'Q34253'],
    ['Satya Nadella', 'Q7426870'],
    ['Tim Cook', 'Q265852'],
    ['Grace Hopper', 'Q11641'],
    ['Sergey Brin', 'Q92764'],
    ['Pavel Durov', 'Q149067'],
    ['Vladimir Putin', 'Q7747'],
    ['Barack Obama', 'Q76'],
    ['Nelson Mandela', 'Q8023'],
    ['Mahatma Gandhi', 'Q1001'],
    ['Martin Luther King', 'Q8027'],
    ['Альберт Эйнштейн', 'Q937'],
    ['Мария Кюри', 'Q7186'],
    ['Исаак Ньютон', 'Q935'],
    ['李白', 'Q7071'],
    ['夏目漱石', 'Q48443'],
  ].map(([value, id]) => ({
    value,
    source: `https://www.wikidata.org/wiki/${id}`,
  })),
  ORGANIZATION: [
    ['Microsoft', 'Q2283'],
    ['Google', 'Q95'],
    ['Apple', 'Q312'],
    ['GitHub', 'Q364'],
    ['Wikimedia Foundation', 'Q180'],
    ['United Nations', 'Q1065'],
    ['NASA', 'Q23548'],
    ['UNESCO', 'Q7809'],
  ].map(([value, id]) => ({
    value,
    source: `https://www.wikidata.org/wiki/${id}`,
  })),
  IP_ADDRESS: [
    ...[
      '8.8.8.8',
      '8.8.4.4',
      '2001:4860:4860::8888',
      '2001:4860:4860::8844',
    ].map((value) => ({
      value,
      source: 'https://developers.google.com/speed/public-dns/docs/using',
    })),
    ...[
      '1.1.1.1',
      '1.0.0.1',
      '2606:4700:4700::1111',
      '2606:4700:4700::1001',
    ].map((value) => ({
      value,
      source: 'https://developers.cloudflare.com/1.1.1.1/ip-addresses/',
    })),
  ],
};
export const organizationDomains = new Set([
  'microsoft.com',
  'google.com',
  'apple.com',
  'github.com',
  'wikimedia.org',
  'wikipedia.org',
  'mozilla.org',
  'cloudflare.com',
]);
const roles =
  /^(?:press|media|support|info|contact|security|abuse|privacy|sales|noreply|no-reply)$/i;

export function isPublic(text, finding, options) {
  if (
    options.publicKnowledge === false ||
    finding.category === 'credential' ||
    finding.rule === 'known-personal'
  ) {
    return false;
  }
  const value = text.slice(finding.start, finding.end).normalize('NFC');
  // Sensitive relationship context wins over a common public/private namesake.
  if (
    finding.type === 'PERSON' &&
    /(?:patient|customer|employee|my name|пациент|клиент)\s*[:=]?\s*$/iu.test(
      text.slice(Math.max(0, finding.start - 64), finding.start)
    )
  ) {
    return false;
  }
  if (
    (publicKnowledge[finding.type] ?? []).some((entry) => entry.value === value)
  ) {
    return true;
  }
  if (finding.type === 'EMAIL') {
    const [local, domain] = value.toLowerCase().split('@');
    return roles.test(local) && organizationDomains.has(domain);
  }
  if (finding.type === 'IP_ADDRESS') {
    return (
      /^(?:192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)\d{1,3}$/.test(value) ||
      /^2001:db8:/i.test(value)
    );
  }
  return false;
}
