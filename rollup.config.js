import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import pkg from './package.json' assert { type: "json" };

const banner = '/*! ' + pkg.name + ' v' + pkg.version + ' */';

export default {
    input: 'src/index.js',
    output: [
      {file: pkg.module, format: 'es', name: pkg.name, banner},
    ],
    plugins: [
      json({compact: true, preferConst: true}),
      nodeResolve(),
      commonjs(),
    ],
    external: ['@hebcal/core', 'better-sqlite3', 'pino', 'fs', 'readline', 'events', '@hebcal/cities'],
};
