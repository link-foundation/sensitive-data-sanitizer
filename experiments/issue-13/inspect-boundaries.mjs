import { inspect, sanitize } from '../../src/index.js';
import { specimen, mrzData } from '../../tests/fixtures/identity.js';

for (const value of [
  'passport: 583920471',
  'e-visa registration code E260512ABCDEF',
]) {
  console.log(
    JSON.stringify(
      { value, findings: inspect(value), output: sanitize(value).text },
      null,
      2
    )
  );
}

for (const value of [specimen, `${specimen.split('\n')[0]}\n${mrzData}`]) {
  console.log(
    JSON.stringify(
      inspect(value, { fakeIdentity: 'specimen-and-synthetic' }).map((f) => ({
        ...f,
        fixtureValue: value.slice(f.start, f.end),
      })),
      null,
      2
    )
  );
}
