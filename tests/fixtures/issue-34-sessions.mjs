import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { issue36Cases } from './issue-36-sessions.mjs';

// Public Codex policy excerpt from issue 34; finite policy tails approximate
// real vendor prompt sizes. No private user sessions are embedded here.
const codexPrompt = `# Security Policy\n## Environment Profile\n- Organization: default generic organization / personal user.\n${Array.from({ length: 400 }, (_, i) => `- Rule ${i}: apply this policy to the current planned action (${i}).`).join('\n')}`;
const claudePrompt = `You are Claude Code, Anthropic's official CLI for Claude.\nYou are an interactive CLI tool that helps users with software engineering tasks.\n${Array.from({ length: 150 }, (_, i) => `- Guidance ${i}: inspect the source and verify changes with the test suite.`).join('\n')}`;
const code = `function parse(line, found, number) {\n  if (relation) {\n    found.emergencyRelationship ??= relation;\n  } else {\n    found.phone = number;\n  }\n${Array.from({ length: 937 }, (_, i) => `  const value${i} = compute(${i});`).join('\n')}\n}`;

export async function sessionCorpus() {
  const vendorPrompt = await readFile(
    new URL('./codex-vendor/prompt.txt', import.meta.url),
    'utf8'
  );
  const guardianPolicy = await readFile(
    new URL('./codex-vendor/guardian-policy.txt', import.meta.url),
    'utf8'
  );
  const ci = JSON.parse(
    await readFile(new URL('./issue-34-ci.json', import.meta.url), 'utf8')
  );
  return [
    {
      name: 'codex',
      records: [
        {
          type: 'session_meta',
          payload: {
            root_turn_id: 'root',
            other_turn_id: 'other',
            turn_id: 'current',
            instructions: `${vendorPrompt}\n\n# Security Policy\n${guardianPolicy}\n\n${codexPrompt}`,
          },
        },
        {
          type: 'event_msg',
          payload: { message: 'saved qazvela.pdf before confirmation' },
        },
        { type: 'function_call_output', payload: { output: code } },
        ci,
        {
          type: 'event_msg',
          payload: {
            message: 'Applicant: Qazvela Zorveta\nemail: zoe@private.invalid',
          },
        },
        {
          type: 'function_call_output',
          payload: {
            output: 'emoji 😀 lone \ud83d and \udc00; quoted "text"\ncomplete',
          },
        },
        {
          type: 'turn_context',
          payload: {
            collaboration_mode: { settings: { developer_instructions: null } },
          },
        },
        {
          type: 'event_msg',
          payload: { rate_limits: { limit_id: '', limit_name: null } },
        },
        ...issue36Cases
          .filter(
            (fixture) =>
              !['Claude tool schemas', 'empty authorization'].includes(
                fixture.name
              )
          )
          .flatMap((fixture) => fixture.records),
      ],
    },
    {
      name: 'claude',
      records: [
        { type: 'system', content: claudePrompt },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'saved zorveta.pdf before confirmation' },
            ],
          },
        },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'read-code', content: code },
            ],
          },
        },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'run-tests',
                content: ci.payload.item.aggregated_output,
              },
            ],
          },
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Applicant: Qazvela Zorveta\nemail: zoe@private.invalid',
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', content: '\ud83d 😀 \udc00\nfinished' },
            ],
          },
        },
        ...issue36Cases
          .filter((fixture) =>
            [
              'Claude tool schemas',
              'empty authorization',
              'escaped public figure',
              'jq state expression',
              'tel and fax HTML',
            ].includes(fixture.name)
          )
          .flatMap((fixture) => fixture.records),
        {
          wireToolInputs: {
            toolu_01PRIVATE: {
              command: 'curl -H "Cookie: sid=fixture-private" done',
            },
          },
        },
      ],
    },
  ];
}
