# Issues 77–84: document forms and structured value boundaries

[PR #85](https://github.com/link-foundation/sensitive-data-sanitizer/pull/85)
implements the seven native sub-issues of the repository-wide parent #84 in one
branch. All issue bodies, all comments (none at investigation time), the parent
sub-issue API and the three PR feedback endpoints were inspected. No further
required issues or images were present. Existing PRs #76, #72 and #66 establish
the finite-rule, offline and known-value behavior to preserve.

## Requirements and solution decisions

| Issue | Every requested behavior                                                                                                                                                                                                            | Alternatives and selected plan                                                                                                                                                                                                                  | Verification                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| #77   | Text, object, array, JSONL, JSON-inside-string and both multiline placements must redact; output parseable; safe values byte-identical; inspect other anchored rules                                                                | Changing only CV anchors would leave other rules broken. Use standalone decoded leaf views beside labelled batches, map through escapes, recurse through two embedded containers. Share views with async/external engines.                      | Native and async/engine anchor tests, JSON/JSONL table tests, escaped offsets and reversible restoration |
| #78   | Unlabelled street/house/flat forms, contextual school acronyms and personal URLs must redact or be listed limits; public-place prose and provider roots stay                                                                        | Broad address/URL/name inference risks public prose. Use structural street forms at line start/residence context, school label grammar, provider personal paths. Document public/personal account ambiguity.                                    | All 11 source rows plus explicit public address/root negatives                                           |
| #79   | Preserve relative operational url and ISO time; all 40-hex framings consistent; URL credentials/token/personal paths still redact; document policy                                                                                  | Could redact every hex token, but that destroys commit IDs. Exclude context-free 40-hex from quoted entropy; leave credential/known/provider rules intact. Exempt safe relative URL and timestamp shapes in shared personal-label validation.   | All expression rows reproduced explicitly in text/JSON/JSONL; unsafe URL and token positives             |
| #80   | All five partial-redaction examples must lose every identifying digit; preserve series/version/level ordinary text                                                                                                                  | Replacing the neighbouring word is insufficient. Recognize the full series/number, ОГРНИП and numbered-school structures at source offsets.                                                                                                     | Every #80 table row asserts no remaining digits; ordinary prose negatives                                |
| #81   | All seven phone, four obfuscated email, nine messenger and ten identity/payment examples must redact or be documented; preserve four ordinary phrases                                                                               | Reuse finite native recognizer style; libphonenumber metadata alone does not cover obfuscated email or invalid-but-sensitive identifiers. Add contextual/structural forms without network calls.                                                | Every source row in text/JSON/JSONL, plus ordinary phrases and sensitive-substring assertions            |
| #82   | Nine initial forms, six inflected/lowercase/title forms, three bare-name examples, six birth-year forms, ten age/gender forms and nine labelled attributes redact or documented; settle salary scope; preserve six ordinary phrases | Statistical NER could broaden recall but adds a model pipeline. Use existing name dictionary/case helper plus finite surname/initial shapes, labels and year/age grammars. Document the three bare-name examples and salary as explicit limits. | All rows in inventory and suite; bare-name/salary negative tests; ordinary prose preservation            |
| #83   | Nine employer, four school-acronym, four numbered-school and six place examples redact or documented; preserve four ordinary phrases                                                                                                | Add synonymous labels and structural dated lines. Leave `Лютик, менеджер` as an explicit ambiguous limit rather than redacting arbitrary noun/comma prose.                                                                                      | All rows in inventory and suite; ordinary prose and limit negatives                                      |
| #84   | Read every issue/comment; single PR; retain one positive closing reference for each #77–#84; explicitly report already-resolved cases                                                                                               | No listed issue was wholly resolved at baseline. Preserve comparison evidence and update existing PR title/body with complete closing block.                                                                                                    | Issue snapshots, baseline comparison, this inventory, PR body and CI checks                              |

## Root causes and code paths

`structuredBatches` prefixes each escaped value with its field. A value is no
longer at the start of a line, which prevents `^` rules from firing. Decoding
used to require a backslash, explaining the newline-dependent behavior. Native
inspection and `createSanitizer` have separate structured paths, so both now
consume the same value views. Views map findings through original JSON escapes
and each containing string; they respect key preservation and structural-field
policies. Plain values need no per-character offset arrays. Existing labelled
batches remain necessary for labels and credential context.

The catalog treats URL and TIME as explicit personal labels; shared value
validation now exempts operational shapes. Quoted entropy inferred a secret
from JSON quoting alone; the SHA-1-shaped exception makes the text and JSON
policy agree. The remaining misses come from finite vocabularies/grammars, not
missing network services. `document-patterns.js` extends the existing opt-in
entity detector, preserving default profiles, public/known policy, confidence
filtering, fake/placeholder handling and credential priority. Detection counts
are available through the existing default-off debug callback.

## Existing components and primary sources

- [Presidio Analyzer](https://microsoft.github.io/presidio/analyzer/) supports
  custom patterns, context and validation. The existing Presidio bridge remains
  useful for caller-configured NLP. Inference: adding its Python/model pipeline
  to the default native package would be a larger deployment change than these
  bounded formats require.
- [Natasha](https://github.com/natasha/natasha/blob/master/README.md) supplies
  Russian name and address extraction with morphological analysis. It is an
  alternative for broader Russian prose, not a drop-in JavaScript recognizer.
- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js)
  already exists in this repository and supplies country-based phone matching.
  Its metadata validation is useful, but these document fixtures also need
  protection for artificial identifiers and specific ambiguous formats; finite
  mobile patterns supplement the existing international phone path.
- [Git's hash transition design](https://git-scm.com/docs/hash-function-transition)
  identifies 40-hex SHA-1 object names. This supports treating an unlabelled
  SHA-1 shape as ambiguous operational data; it does not establish whether a
  particular string is a credential.
- [RFC 3339](https://www.rfc-editor.org/info/rfc3339/) defines Internet
  timestamps. The operational TIME exception is a bounded syntactic shape,
  while explicit birth context remains sensitive.

No new dependency or runtime model download was introduced.

## Reproduction and verification

`node experiments/issue-84/compare.mjs [absolute-path-to-other-src/index.js]`
prints one JSON result per original text-table row. The snapshots preserve the
complete source issue and empty comment lists. `rows.mjs` extracts 128 text
rows, including previously working comparison rows; four are explicit limits.
#77/#79's JavaScript expressions and acceptance negatives are tested separately.
`tests/sanitizer-issue-84.test.js` tests the source rows, unsafe/safe contrasts,
JSON/JSONL, escaping/restoration and asynchronous engine anchors. Run with
`node --test --test-timeout=30000 tests/sanitizer-issue-84.test.js`.

The detailed row inventory below records the implementation decision and test
for each table input. Generic limitations and salary scope are documented in
[COVERAGE.md](../../COVERAGE.md#document-forms-reviewed-in-issues-7783).

| Issue | Original input                                           | Decision / regression                        |
| ----- | -------------------------------------------------------- | -------------------------------------------- |
| #78   | `Адрес: г. Казань, ул. Ленина, д. 5, кв. 12`             | Detect; text and JSON/JSONL regressions      |
| #78   | `ул. Ленина, д. 5, кв. 12`                               | Detect; text and JSON/JSONL regressions      |
| #78   | `проживает по адресу ул. Ленина, 10`                     | Detect; text and JSON/JSONL regressions      |
| #78   | `улица Ленина, дом 10`                                   | Detect; text and JSON/JSONL regressions      |
| #78   | `Московский государственный университет, 2012`           | Detect; text and JSON/JSONL regressions      |
| #78   | `Образование: МГТУ им. Баумана`                          | Detect; text and JSON/JSONL regressions      |
| #78   | `окончил МГТУ им. Баумана в 2012`                        | Detect; text and JSON/JSONL regressions      |
| #78   | `окончил МГУ в 2012 году`                                | Detect; text and JSON/JSONL regressions      |
| #78   | `профиль: https://www.linkedin.com/in/ivan-petrov-12345` | Detect; text and JSON/JSONL regressions      |
| #78   | `https://github.com/ivan-petrov91`                       | Detect; text and JSON/JSONL regressions      |
| #78   | `https://vk.com/ivan.petrov91`                           | Detect; text and JSON/JSONL regressions      |
| #80   | `паспорт серия 4510 № 123456`                            | Detect; text and JSON/JSONL regressions      |
| #80   | `Паспорт: серия 4510 номер 123456`                       | Detect; text and JSON/JSONL regressions      |
| #80   | `Passport series 4510 number 123456`                     | Detect; text and JSON/JSONL regressions      |
| #80   | `ОГРНИП 300000000000001`                                 | Detect; text and JSON/JSONL regressions      |
| #80   | `школа № 5`                                              | Detect; text and JSON/JSONL regressions      |
| #80   | `паспорт 4510 123456`                                    | Detect; text and JSON/JSONL regressions      |
| #80   | `паспорт РФ 45 10 123456`                                | Detect; text and JSON/JSONL regressions      |
| #81   | `тел.: 8-916-123-45-67`                                  | Detect; text and JSON/JSONL regressions      |
| #81   | `тел 8(916)1234567`                                      | Detect; text and JSON/JSONL regressions      |
| #81   | `8.916.123.45.67`                                        | Detect; text and JSON/JSONL regressions      |
| #81   | `916-123-45-67`                                          | Detect; text and JSON/JSONL regressions      |
| #81   | `моб.: 916 123 45 67`                                    | Detect; text and JSON/JSONL regressions      |
| #81   | `WhatsApp: 916 123 45 67`                                | Detect; text and JSON/JSONL regressions      |
| #81   | `wa.me/79161234567`                                      | Detect; text and JSON/JSONL regressions      |
| #81   | `звоните 8 916 123-45-67`                                | Detect; text and JSON/JSONL regressions      |
| #81   | `тел. 8 (916) 123-45-67`                                 | Detect; text and JSON/JSONL regressions      |
| #81   | `телефон: 9161234567`                                    | Detect; text and JSON/JSONL regressions      |
| #81   | `(916) 123-45-67`                                        | Detect; text and JSON/JSONL regressions      |
| #81   | `anna.smirnova(at)example.org`                           | Detect; text and JSON/JSONL regressions      |
| #81   | `anna.smirnova [at] example.org`                         | Detect; text and JSON/JSONL regressions      |
| #81   | `anna.smirnova собака example.org`                       | Detect; text and JSON/JSONL regressions      |
| #81   | `anna dot smirnova at example dot org`                   | Detect; text and JSON/JSONL regressions      |
| #81   | `t.me/anna_smirnova`                                     | Detect; text and JSON/JSONL regressions      |
| #81   | `https://t.me/anna_smirnova`                             | Detect; text and JSON/JSONL regressions      |
| #81   | `Telegram anna_smirnova`                                 | Detect; text and JSON/JSONL regressions      |
| #81   | `телеграм: anna_smirnova`                                | Detect; text and JSON/JSONL regressions      |
| #81   | `tg: anna_smirnova`                                      | Detect; text and JSON/JSONL regressions      |
| #81   | `skype: anna.smirnova91`                                 | Detect; text and JSON/JSONL regressions      |
| #81   | `ник: anna_smirnova`                                     | Detect; text and JSON/JSONL regressions      |
| #81   | `vk.com/id12345`                                         | Detect; text and JSON/JSONL regressions      |
| #81   | `instagram.com/anna_smirnova`                            | Detect; text and JSON/JSONL regressions      |
| #81   | `серия 4510 номер 123456`                                | Detect; text and JSON/JSONL regressions      |
| #81   | `код подразделения 770-001`                              | Detect; text and JSON/JSONL regressions      |
| #81   | `выдан ОВД Тверской 12.03.2010`                          | Detect; text and JSON/JSONL regressions      |
| #81   | `водительское удостоверение 77 12 345678`                | Detect; text and JSON/JSONL regressions      |
| #81   | `в/у 77 12 345678`                                       | Detect; text and JSON/JSONL regressions      |
| #81   | `Driver's license 77 12 345678`                          | Detect; text and JSON/JSONL regressions      |
| #81   | `ОМС 1234567890123456`                                   | Detect; text and JSON/JSONL regressions      |
| #81   | `полис 1234567890123456`                                 | Detect; text and JSON/JSONL regressions      |
| #81   | `счёт 40817810000000000001`                              | Detect; text and JSON/JSONL regressions      |
| #81   | `диплом № 123456`                                        | Detect; text and JSON/JSONL regressions      |
| #82   | `Смирнова А. В.`                                         | Detect; text and JSON/JSONL regressions      |
| #82   | `Смирнова А.В., менеджер`                                | Detect; text and JSON/JSONL regressions      |
| #82   | `А. В. Смирнова`                                         | Detect; text and JSON/JSONL regressions      |
| #82   | `Иванов И.И. написал`                                    | Detect; text and JSON/JSONL regressions      |
| #82   | `Иванов И. написал`                                      | Detect; text and JSON/JSONL regressions      |
| #82   | `Анна С.`                                                | Detect; text and JSON/JSONL regressions      |
| #82   | `Smirnova A.V.`                                          | Detect; text and JSON/JSONL regressions      |
| #82   | `A. V. Smirnova`                                         | Detect; text and JSON/JSONL regressions      |
| #82   | `Anna S.`                                                | Detect; text and JSON/JSONL regressions      |
| #82   | `Смирновой Анной`                                        | Detect; text and JSON/JSONL regressions      |
| #82   | `Анной Смирновой`                                        | Detect; text and JSON/JSONL regressions      |
| #82   | `Смирновой А.В.`                                         | Detect; text and JSON/JSONL regressions      |
| #82   | `смирнова анна`                                          | Detect; text and JSON/JSONL regressions      |
| #82   | `г-жа Смирнова`                                          | Detect; text and JSON/JSONL regressions      |
| #82   | `господин Смирнов`                                       | Detect; text and JSON/JSONL regressions      |
| #82   | `Смирнова Анна`                                          | Detect; text and JSON/JSONL regressions      |
| #82   | `Анна Викторовна`                                        | Detect; text and JSON/JSONL regressions      |
| #82   | `Спасибо, Анна!`                                         | Documented ambiguous limit; assert unchanged |
| #82   | `Анна, добрый день!`                                     | Documented ambiguous limit; assert unchanged |
| #82   | `Менеджер Анна`                                          | Documented ambiguous limit; assert unchanged |
| #82   | `д.р. 1991`                                              | Detect; text and JSON/JSONL regressions      |
| #82   | `1991 г.р.`                                              | Detect; text and JSON/JSONL regressions      |
| #82   | `год рождения: 1991`                                     | Detect; text and JSON/JSONL regressions      |
| #82   | `родился в 1991 году`                                    | Detect; text and JSON/JSONL regressions      |
| #82   | `родилась в 1991`                                        | Detect; text and JSON/JSONL regressions      |
| #82   | `Born in 1991`                                           | Detect; text and JSON/JSONL regressions      |
| #82   | `возраст: 34`                                            | Detect; text and JSON/JSONL regressions      |
| #82   | `34 года`                                                | Detect; text and JSON/JSONL regressions      |
| #82   | `мне 34 года`                                            | Detect; text and JSON/JSONL regressions      |
| #82   | `Мне 34`                                                 | Detect; text and JSON/JSONL regressions      |
| #82   | `исполнилось 34`                                         | Detect; text and JSON/JSONL regressions      |
| #82   | `Женщина, 34 года`                                       | Detect; text and JSON/JSONL regressions      |
| #82   | `Мужчина, 41 год`                                        | Detect; text and JSON/JSONL regressions      |
| #82   | `Пол: женский`                                           | Detect; text and JSON/JSONL regressions      |
| #82   | `Пол: мужской`                                           | Detect; text and JSON/JSONL regressions      |
| #82   | `Sex: male`                                              | Detect; text and JSON/JSONL regressions      |
| #82   | `Age: 34`                                                | Detect; text and JSON/JSONL regressions      |
| #82   | `Gender: female`                                         | Detect; text and JSON/JSONL regressions      |
| #82   | `Гражданство: Россия`                                    | Detect; text and JSON/JSONL regressions      |
| #82   | `Citizenship: Russia`                                    | Detect; text and JSON/JSONL regressions      |
| #82   | `Семейное положение: замужем, двое детей`                | Detect; text and JSON/JSONL regressions      |
| #82   | `Marital status: married`                                | Detect; text and JSON/JSONL regressions      |
| #82   | `Дети: двое`                                             | Detect; text and JSON/JSONL regressions      |
| #82   | `национальность: русская`                                | Detect; text and JSON/JSONL regressions      |
| #82   | `Вероисповедание: православие`                           | Detect; text and JSON/JSONL regressions      |
| #82   | `инвалидность: нет`                                      | Detect; text and JSON/JSONL regressions      |
| #82   | `судимость: нет`                                         | Detect; text and JSON/JSONL regressions      |
| #83   | `Компания: Лютик`                                        | Detect; text and JSON/JSONL regressions      |
| #83   | `Работодатель: Лютик`                                    | Detect; text and JSON/JSONL regressions      |
| #83   | `Место работы: Лютик`                                    | Detect; text and JSON/JSONL regressions      |
| #83   | `компания Лютик, менеджер`                               | Detect; text and JSON/JSONL regressions      |
| #83   | `работала в Лютике`                                      | Detect; text and JSON/JSONL regressions      |
| #83   | `Лютик, менеджер`                                        | Documented ambiguous limit; assert unchanged |
| #83   | `2019-2021 Лютик`                                        | Detect; text and JSON/JSONL regressions      |
| #83   | `Банк «Лютик»`                                           | Detect; text and JSON/JSONL regressions      |
| #83   | `холдинг Лютик`                                          | Detect; text and JSON/JSONL regressions      |
| #83   | `Организация: Лютик`                                     | Detect; text and JSON/JSONL regressions      |
| #83   | `в компании Лютик`                                       | Detect; text and JSON/JSONL regressions      |
| #83   | `ООО «Ромашка»`                                          | Detect; text and JSON/JSONL regressions      |
| #83   | `ВУЗ: КФУ`                                               | Detect; text and JSON/JSONL regressions      |
| #83   | `Университет: КФУ`                                       | Detect; text and JSON/JSONL regressions      |
| #83   | `Образование: КФУ`                                       | Detect; text and JSON/JSONL regressions      |
| #83   | `окончила КФУ`                                           | Detect; text and JSON/JSONL regressions      |
| #83   | `гимназия № 12`                                          | Detect; text and JSON/JSONL regressions      |
| #83   | `лицей № 7`                                              | Detect; text and JSON/JSONL regressions      |
| #83   | `колледж № 3`                                            | Detect; text and JSON/JSONL regressions      |
| #83   | `Школа: 5`                                               | Detect; text and JSON/JSONL regressions      |
| #83   | `живу в Казани`                                          | Detect; text and JSON/JSONL regressions      |
| #83   | `из Казани`                                              | Detect; text and JSON/JSONL regressions      |
| #83   | `м. Сокол`                                               | Detect; text and JSON/JSONL regressions      |
| #83   | `метро Сокол`                                            | Detect; text and JSON/JSONL regressions      |
| #83   | `район Сокол`                                            | Detect; text and JSON/JSONL regressions      |
| #83   | `индекс 420111`                                          | Detect; text and JSON/JSONL regressions      |
| #83   | `Проживаю: Москва`                                       | Detect; text and JSON/JSONL regressions      |
| #83   | `г. Казань`                                              | Detect; text and JSON/JSONL regressions      |
| #83   | `Татарстан`                                              | Detect; text and JSON/JSONL regressions      |
