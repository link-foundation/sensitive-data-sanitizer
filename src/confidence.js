// A valid check digit is common in arbitrary log numbers. Context decides
// whether that evidence merits a replacement; inspect retains low scores.
export function threshold(options) {
  return options.minConfidence ?? options.threshold ?? 0.5;
}
export function actionable(finding, options) {
  return (
    finding.kept !== 'fake' &&
    (finding.category === 'credential' ||
      finding.confidence >= threshold(options))
  );
}
export function numericNoise(text, start) {
  const before = text
    .slice(Math.max(0, start - 80), start)
    .split(/[\r\n|;]/)
    .at(-1);
  return /(?:timestamp|ts|time|created_at|updated_at|elapsed|duration|ms|epoch|order|run|size|bytes|port|pid|line|col)["']?[ :=_-]*$/i.test(
    before
  );
}
export function epochNumber(value) {
  const digits = value.replace(/\D/g, '');
  const seconds = digits.length === 13 ? Number(digits) / 1000 : Number(digits);
  return (
    [10, 13].includes(digits.length) &&
    seconds >= 946684800 &&
    seconds < 4102444800
  );
}
export function cardNetwork(value) {
  const d = value.replace(/\D/g, ''),
    n = d.length;
  return primaryCard(d, n) || otherCard(d, n);
}
function primaryCard(d, n) {
  return (
    (/^4/.test(d) && [13, 16, 19].includes(n)) ||
    ((/^5[1-5]/.test(d) ||
      (Number(d.slice(0, 4)) >= 2221 && Number(d.slice(0, 4)) <= 2720)) &&
      n === 16) ||
    (/^3[47]/.test(d) && n === 15) ||
    ((/^6011|^65|^64[4-9]/.test(d) ||
      (Number(d.slice(0, 6)) >= 622126 && Number(d.slice(0, 6)) <= 622925)) &&
      [16, 19].includes(n))
  );
}
function otherCard(d, n) {
  return (
    (Number(d.slice(0, 4)) >= 3528 &&
      Number(d.slice(0, 4)) <= 3589 &&
      n >= 16 &&
      n <= 19) ||
    (/^62/.test(d) && n >= 16 && n <= 19) ||
    (/^220[0-4]/.test(d) && n >= 16 && n <= 19) ||
    (/^3(?:0[0-5]|[68])/.test(d) && n === 14)
  );
}
