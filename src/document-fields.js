// One explicit field vocabulary; camelCase, snake_case and kebab-case normalize alike.
const groups = {
  PERSON: [
    'firstname',
    'lastname',
    'middlename',
    'patronymic',
    'candidatename',
    'displayname',
    'fullname',
    'originalfilename',
  ],
  AGE: ['age'],
  DATE_OF_BIRTH: ['birthday', 'birthdate', 'birthyear'],
  GENDER: ['sex'],
  PERSONAL_ATTRIBUTE: ['citizenship', 'nationality'],
  ORGANIZATION: ['company', 'companyname', 'employer'],
  EDUCATION: ['university', 'school'],
  PHONE: ['contact'],
  URL: ['resumeurl', 'alternateurl', 'profileurl', 'companyurl'],
};
const types = new Map(
  Object.entries(groups).flatMap(([type, fields]) =>
    fields.map((field) => [field, type])
  )
);
export function documentFieldType(field) {
  const type = types.get(normalizeFieldName(field));
  if (type) {
    return type;
  }
  // Compound person keys (`recruiterDisplayName`, `author_full_name`) end in
  // a listed person field. Only PERSON entries extend this way, so generic
  // suffixes such as `maxAge` or `homeSchool` keep their exact-match meaning,
  // and a bare `name` is never listed.
  return fieldSuffixes(field).some((suffix) => types.get(suffix) === 'PERSON')
    ? 'PERSON'
    : undefined;
}
// Word-boundary suffixes of a key, normalized; the whole key comes first.
export function fieldSuffixes(field) {
  const words = field
    .split(/[\s_.-]+|(?<=[\p{Ll}\p{N}])(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})/u)
    .filter(Boolean);
  return words.map((_, i) => words.slice(i).join('').toLowerCase());
}
export const normalizeFieldName = (field) =>
  field.replace(/[_-]/g, '').toLowerCase();
