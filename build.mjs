// 构建：把 three.js 与游戏代码打包并内联为单文件 index.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const r = await build({ entryPoints: ['src/game.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
writeFileSync('index.html', readFileSync('src/index.html', 'utf8').replace('/*__JS__*/', () => js));
console.log('index.html', (js.length / 1024 | 0) + ' KB');
