#!/usr/bin/env node
// Garante que src/sim e src/core continuem DOM-free e determinísticos.
// - Proíbe APIs de navegador, relógio de parede e Math.random.
// - Proíbe trigonometria direta de Math fora de core/dmath.js.
// - sim só importa de core/ e sim/.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src/sim', 'src/core'];

const FORBIDDEN = [
  [/\bwindow\b/, 'window'],
  [/\bdocument\b/, 'document'],
  [/\bperformance\b/, 'performance'],
  [/\bDate\b/, 'Date'],
  [/\brequestAnimationFrame\b/, 'requestAnimationFrame'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bnavigator\b/, 'navigator'],
  [/Math\.random\b/, 'Math.random'],
];
const TRIG = /Math\.(sin|cos|tan|atan2|atan|asin|acos|exp|log|pow|hypot)\b/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

let errors = 0;
for (const d of DIRS) {
  let files = [];
  try {
    files = walk(join(ROOT, d));
  } catch {
    continue;
  }
  for (const f of files) {
    const rel = relative(ROOT, f);
    const src = stripComments(readFileSync(f, 'utf8'));
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      for (const [re, name] of FORBIDDEN) {
        if (re.test(line)) {
          console.error(`${rel}:${i + 1}: uso proibido de ${name} na simulação`);
          errors++;
        }
      }
      if (!rel.endsWith('core/dmath.js') && TRIG.test(line)) {
        console.error(`${rel}:${i + 1}: use core/dmath.js em vez de ${line.match(TRIG)[0]}`);
        errors++;
      }
    });
    if (rel.startsWith('src/sim')) {
      const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
      let m;
      while ((m = re.exec(src))) {
        const spec = m[1] || m[2];
        if (!spec.startsWith('.')) {
          console.error(`${rel}: import externo proibido na simulação: ${spec}`);
          errors++;
          continue;
        }
        const target = relative(ROOT, resolve(dirname(f), spec));
        if (!target.startsWith('src/sim') && !target.startsWith('src/core')) {
          console.error(`${rel}: sim não pode importar ${target}`);
          errors++;
        }
      }
    }
  }
}

if (errors) {
  console.error(`\nlint-sim: ${errors} problema(s).`);
  process.exit(1);
}
console.log('lint-sim: ok');
