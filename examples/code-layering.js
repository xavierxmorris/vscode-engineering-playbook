// eslint-plugin-local/code-layering.js
// Custom ESLint rule that enforces architectural layer boundaries.
// Adapted from microsoft/vscode's .eslint-plugin-local/code-layering.ts
//
// Layer hierarchy (lower cannot import from higher):
//   core/common  →  core/services  →  platform  →  features  →  app

'use strict';

const path = require('path');

const LAYERS = {
  'core/common': 0,
  'core/services': 1,
  'platform': 2,
  'features': 3,
  'app': 4,
};

function getLayer(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const [layer, _rank] of Object.entries(LAYERS).sort((a, b) => b[0].length - a[0].length)) {
    if (normalized.includes(`/src/${layer}/`) || normalized.includes(`src/${layer}/`)) {
      return layer;
    }
  }
  return null;
}

module.exports = {
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
    const currentFile = context.getFilename();
    const sourceLayer = getLayer(currentFile);

    if (!sourceLayer) return {};

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) return;

        const resolvedPath = path.resolve(path.dirname(currentFile), importPath);
        const targetLayer = getLayer(resolvedPath);

        if (!targetLayer) return;

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
      },
    };
  },
};
