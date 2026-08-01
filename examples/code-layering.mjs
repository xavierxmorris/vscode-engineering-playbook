// eslint-plugin-local/code-layering.mjs
// Custom ESLint rule that enforces architectural layer boundaries.
// Adapted from microsoft/vscode's .eslint-plugin-local/code-layering.ts
//
// Layer hierarchy (lower cannot import from higher):
//   core/common  →  core/services  →  platform  →  features  →  app
//
// ESM on purpose: the flat `eslint.config.js` in this playbook uses `import`,
// which requires `"type": "module"` in package.json. A CommonJS `.js` rule file
// would fail to load under that setting. Use `.cjs` instead if your project is CJS.

import path from 'node:path';

const LAYERS = {
  'core/common': 0,
  'core/services': 1,
  'platform': 2,
  'features': 3,
  'app': 4,
};

// Longest match first, so `core/services` wins over a hypothetical `core`.
const LAYER_NAMES = Object.keys(LAYERS).sort((a, b) => b.length - a.length);

function getLayer(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const layer of LAYER_NAMES) {
    if (normalized.includes(`/src/${layer}/`) || normalized.startsWith(`src/${layer}/`)) {
      return layer;
    }
  }
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce architectural layer boundaries',
      category: 'Architecture',
    },
    messages: {
      badLayering:
        'Layer violation: "{{sourceLayer}}" (rank {{sourceRank}}) cannot import from "{{targetLayer}}" (rank {{targetRank}}). Lower layers must not depend on higher layers.',
    },
    schema: [],
  },

  create(context) {
    const currentFile = context.filename; // context.getFilename() is deprecated in ESLint 9
    const sourceLayer = getLayer(currentFile);

    if (!sourceLayer) {
      return {};
    }

    function check(node, rawSpecifier) {
      if (typeof rawSpecifier !== 'string') {
        return;
      }
      if (!rawSpecifier.startsWith('.') && !rawSpecifier.startsWith('/')) {
        return;
      }

      const resolvedPath = path.resolve(path.dirname(currentFile), rawSpecifier);
      const targetLayer = getLayer(resolvedPath);

      if (!targetLayer) {
        return;
      }

      const sourceRank = LAYERS[sourceLayer];
      const targetRank = LAYERS[targetLayer];

      if (sourceRank < targetRank) {
        context.report({
          node,
          messageId: 'badLayering',
          data: {
            sourceLayer,
            sourceRank: String(sourceRank),
            targetLayer,
            targetRank: String(targetRank),
          },
        });
      }
    }

    return {
      // import x from '...'
      ImportDeclaration: (node) => check(node, node.source?.value),
      // export { x } from '...'  /  export * from '...'
      ExportNamedDeclaration: (node) => check(node, node.source?.value),
      ExportAllDeclaration: (node) => check(node, node.source?.value),
      // await import('...') — the modern node type; the old
      // CallExpression[callee.type="Import"] selector no longer matches.
      ImportExpression: (node) => check(node, node.source?.value),
    };
  },
};
