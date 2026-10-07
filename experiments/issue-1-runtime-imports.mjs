// Synthetic upstream probe: expose runtime permissions without private input.
import { lintSource } from '@secretlint/core';
import { rules } from '@secretlint/secretlint-rule-preset-recommend';
import { secretLintProfiler } from '@secretlint/profiler';

secretLintProfiler.setEnabled(false);
const result = await lintSource({
  source: {
    filePath: '/virtual/input.txt',
    content: 'ordinary text',
    contentType: 'text',
  },
  options: {
    noPhysicFilePath: true,
    maskSecrets: true,
    config: {
      rules: rules
        .filter(
          (rule) =>
            rule.meta.id !== '@secretlint/secretlint-rule-filter-comments'
        )
        .map((rule) => ({ id: rule.meta.id, rule })),
    },
  },
});
console.log(JSON.stringify({ messages: result.messages.length }));
