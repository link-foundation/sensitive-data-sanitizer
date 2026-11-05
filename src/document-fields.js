// One explicit field vocabulary; camelCase, snake_case and kebab-case normalize alike.
const groups = {
  PERSON: ['firstname', 'lastname', 'middlename', 'patronymic'],
  DATE_OF_BIRTH: ['birthday', 'birthdate'],
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
  return types.get(field.replace(/[_-]/g, '').toLowerCase());
}
