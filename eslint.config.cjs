// Flat ESLint config delegating to gts (Google TypeScript Style).
// Named .cjs because this package is "type": "module" but gts ships a
// CommonJS flat config.
module.exports = [
  {ignores: ['dist/', 'docs/', 'bin/', 'test/', 'src/pkgVersion.ts', 'src/*.json.ts']},
  ...require('gts'),
];
