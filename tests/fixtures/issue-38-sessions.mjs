// Minimal public reproductions from issue 38. Escaping is intentional.
export const issue38Cases = [
  {
    name: 'sig label before JSON keys',
    records: [
      { payload: { content: [{ text: "sig:' " }, { type: '', text: '' }] } },
    ],
  },
  {
    name: 'token for prose across a newline',
    records: [{ toolUseResult: { stdout: 'token for ES.\nes u' } }],
  },
  {
    name: 'SIG for prose before sig is',
    records: [{ toolUseResult: { stdout: 'SIG for\n:sig is d' } }],
  },
  {
    name: 'token for prose with escaped backslashes',
    records: [
      {
        payload: {
          content: [
            {
              text: 'token for\\ery record. The enclosing request-log write lock serio\\n/// this c',
            },
          ],
        },
      },
    ],
  },
  {
    name: 'nested escaped key assignment',
    records: [
      { payload: { content: [{ text: 'APIkey="\\"private_key:9"' }] } },
    ],
    sensitive: ['private_key:9'],
  },
];

export const jsonl = (records) => `${records.map(JSON.stringify).join('\n')}\n`;
