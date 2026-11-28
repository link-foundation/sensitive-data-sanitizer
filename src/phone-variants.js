// Russian mobiles have a ten-digit national number beginning with 9.
// The same number is written with the +7 country code or the 8 trunk prefix.
const gap = '[ \\t\\u00a0.-]*';
const separated = (digits) => digits.join(gap);

export function russianMobileSource(value) {
  if (!/^\+?[\d ().\t\u00a0-]+$/u.test(value)) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  if (
    !/^(?:[78])?9\d{9}$/.test(digits) ||
    (value.startsWith('+') && !/^79\d{9}$/.test(digits))
  ) {
    return undefined;
  }
  const national = [...digits.slice(-10)];
  const area = separated(national.slice(0, 3));
  const subscriber = separated(national.slice(3));
  return `(?:(?:\\+?7|8)${gap})?(?:\\(${area}\\)|${area})${gap}${subscriber}`;
}
