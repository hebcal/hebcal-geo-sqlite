import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import pkg from './package.json';
import json from '@rollup/plugin-json';

export default [
  {
    input: 'src/index.js',
    output: [
      {file: pkg.main, format: 'cjs', name: pkg.name},
    ],
    plugins: [
      json({compact: true}),
      babel({
        babelHelpers: 'bundled',
        exclude: ['node_modules/**'],
      }),
      resolve(),
      commonjs(),
    ],
    external: ['@hebcal/core', 'better-sqlite3'],
  },
];
