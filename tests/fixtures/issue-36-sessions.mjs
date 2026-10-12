// Minimal public reproductions from issue 36. Escaping is intentional.
export const issue36Cases = [
  {
    name: 'null literal',
    records: [
      {
        payload: {
          collaboration_mode: { settings: { developer_instructions: null } },
        },
      },
      { payload: { content: [{ text: 'name:null' }] } },
    ],
  },
  {
    name: 'Rust nom path',
    records: [{ payload: { content: [{ text: 'nom::{\\n' }] } }],
  },
  {
    name: 'rate limit keys',
    records: [
      { payload: { rate_limits: { limit_id: '', limit_name: null } } },
      { payload: { content: [{ text: 'name=name' }, { text: 'id"name:"C' }] } },
    ],
  },
  {
    name: 'Rust codec path',
    records: [
      { payload: { content: [{ text: 'name=codec' }] } },
      { payload: { content: [{ text: 'codec::' }] } },
    ],
  },
  {
    name: 'Rust Coding identifier',
    records: [
      {
        payload: {
          content: [{ text: 'ai"name:"Coding' }, { text: 'a::coding_' }],
        },
      },
    ],
  },
  {
    name: 'Claude tool schemas',
    records: [
      {
        attachment: {
          tools: [
            {
              schema: {
                input_schema: {
                  properties: { capabilities: { description: 'name:Claude' } },
                },
              },
            },
            { schema: { description: 'name:...' } },
          ],
        },
      },
      { rendered: [{ content: 'Claude...' }] },
    ],
  },
  {
    name: 'escaped public figure',
    records: [{ toolUseResult: { stdout: '"Elon Musk' } }],
  },
  {
    name: 'escaped empty cookie',
    records: [{ payload: { content: [{ text: '"cookie:;\\n"' }] } }],
    sensitive: true,
  },
  {
    name: 'empty authorization',
    records: [
      { wireToolInputs: { toolu_01EXAMPLE: { command: 'Authorization:"' } } },
      { toolUseResult: { stderr: '' } },
    ],
  },
  {
    name: 'jq state expression',
    records: [
      {
        text: `gh pr view 1 --json statusCheckRollup --jq '{counts:(.statusCheckRollup|map({state:.[0].status,result:.[0].conclusion,count:length}))}'`,
      },
    ],
  },
  {
    name: 'tel and fax HTML',
    records: [{ text: '<a href="tel:84812345678">Fax: 028 12 345 678</a>' }],
    sensitive: ['84812345678', '028 12 345 678'],
  },
  {
    name: 'national tel HTML',
    records: [{ text: '<a href="tel:0281234567">ĐT</a>' }],
    sensitive: ['0281234567'],
  },
  {
    name: 'Vietnamese phone label',
    records: [{ text: 'ĐT: 028 12 345 678' }],
    sensitive: ['028 12 345 678'],
  },
];

export const jsonl = (records) => `${records.map(JSON.stringify).join('\n')}\n`;
