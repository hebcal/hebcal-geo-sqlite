const {nodeResolve} = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const pkg = require('./package.json');

const banner = '/*! ' + pkg.name + ' v' + pkg.version + ' */';

module.exports = [
  {
    input: 'src/index.js',
    output: [
      {file: pkg.main, format: 'cjs', name: pkg.name, banner},
      {file: pkg.module, format: 'es', name: pkg.name, banner},
    ],
    plugins: [
      json({compact: true, preferConst: true}),
      nodeResolve(),
      commonjs(),
    ],
    external: ['@hebcal/core', 'better-sqlite3', 'pino', 'fs', 'readline', 'events', '@hebcal/cities'],
  },
];
