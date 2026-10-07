function resolveVariable(context, node) {
  for (
    let scope = context.sourceCode.getScope(node);
    scope;
    scope = scope.upper
  ) {
    if (scope.set.has(node.name)) {
      return scope.set.get(node.name);
    }
  }
  return undefined;
}
/** Optional static publication guard; runtime verification remains required. */
function name(node) {
  return node?.name ?? node?.property?.name ?? node?.property?.value;
}
function literal(node) {
  return node?.type === 'Literal' ? node.value : undefined;
}
function publicationCommand(text) {
  return (
    typeof text === 'string' &&
    /\bgh\s+(?:pr|issue|gist|release)\s+(?:create|edit|comment|review)\b/.test(
      text
    ) &&
    /--(?:body|title|notes|comment)(?:-file)?\b|\s-[bt]\b/.test(text)
  );
}
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require sanitization before generated data crosses an outbound boundary.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          sinks: { type: 'array', items: { type: 'string' } },
          sanitizers: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsafe: 'Sanitize generated outbound data before publication.',
    },
  },
  create(context) {
    const settings = context.options[0] ?? {};
    const sinks = new Set(
      settings.sinks ?? [
        'publish',
        'send',
        'captureException',
        'captureMessage',
      ]
    );
    const sanitizers = new Set(
      settings.sanitizers ?? [
        'sanitize',
        'sanitizePayload',
        'sanitizeForPublication',
      ]
    );
    const safeVariables = new Set(),
      arrays = new Map();
    function safeCall(node) {
      return (
        sanitizers.has(name(node.callee)) ||
        (name(node.callee) === 'stringify' && node.arguments.every(safe))
      );
    }
    function safe(node) {
      if (!node) {
        return false;
      }
      if (node.type === 'Literal') {
        return true;
      }
      if (node.type === 'Identifier') {
        const variable = resolveVariable(context, node);
        return safeVariables.has(variable);
      }
      if (['AwaitExpression', 'ChainExpression'].includes(node.type)) {
        return safe(node.argument ?? node.expression);
      }
      if (node.type === 'MemberExpression') {
        return safe(node.object);
      }
      if (node.type === 'CallExpression') {
        return safeCall(node);
      }
      if (node.type === 'TemplateLiteral') {
        return node.expressions.every(safe);
      }
      if (node.type === 'BinaryExpression') {
        return safe(node.left) && safe(node.right);
      }
      if (node.type === 'ArrayExpression') {
        return node.elements.every(safe);
      }
      if (node.type === 'ObjectExpression') {
        return node.properties.every((p) => safe(p.value ?? p.argument));
      }
      return false;
    }
    function checkGh(node) {
      if (literal(node.arguments[0]) !== 'gh') {
        return;
      }
      const expression = node.arguments[1];
      const argv =
        expression?.type === 'ArrayExpression'
          ? expression
          : arrays.get(
              expression?.type === 'Identifier'
                ? resolveVariable(context, expression)
                : undefined
            );
      if (
        !argv ||
        !['pr', 'issue', 'gist', 'release'].includes(
          literal(argv.elements[0])
        ) ||
        !['create', 'edit', 'comment', 'review'].includes(
          literal(argv.elements[1])
        )
      ) {
        return;
      }
      for (let i = 2; i < argv.elements.length - 1; i++) {
        if (
          /^(?:--body(?:-file)?|--title|--notes(?:-file)?|--comment|-b|-t)$/.test(
            literal(argv.elements[i])
          ) &&
          !safe(argv.elements[i + 1])
        ) {
          context.report({ node, messageId: 'unsafe' });
          return;
        }
      }
    }
    return {
      'VariableDeclarator:exit'(node) {
        if (node.id.type !== 'Identifier') {
          return;
        }
        const variable = context.sourceCode.getDeclaredVariables(node)[0];
        if (node.parent.kind === 'const' && safe(node.init)) {
          safeVariables.add(variable);
        }
        if (
          node.parent.kind === 'const' &&
          node.init?.type === 'ArrayExpression'
        ) {
          arrays.set(variable, node.init);
        }
      },
      'CallExpression:exit'(node) {
        checkGh(node);
        if (
          sinks.has(name(node.callee)) &&
          node.arguments.some((arg) => !safe(arg))
        ) {
          context.report({ node, messageId: 'unsafe' });
        }
        const command = node.arguments[0];
        if (
          command?.type === 'TemplateLiteral' &&
          publicationCommand(
            command.quasis.map((q) => q.value.raw).join('${x}')
          ) &&
          !command.expressions.every(safe)
        ) {
          context.report({ node, messageId: 'unsafe' });
        }
      },
      TaggedTemplateExpression(node) {
        if (
          publicationCommand(
            node.quasi.quasis.map((q) => q.value.raw).join('${x}')
          ) &&
          !node.quasi.expressions.every(safe)
        ) {
          context.report({ node, messageId: 'unsafe' });
        }
      },
    };
  },
};
export default { rules: { 'require-sanitized-output': rule } };
