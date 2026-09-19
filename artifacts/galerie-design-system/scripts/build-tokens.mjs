import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function buildTokens(source) {
  const values = (node) => {
    if ('$value' in node) return node.$value;
    return Object.fromEntries(Object.entries(node).filter(([key]) => !key.startsWith('$')).map(([key, value]) => [key, values(value)]));
  };
  const tokens = { color: values(source.color), fontFamily: values(source.typography.fontFamily), radius: source.radius.base.$value, spacing: source.spacing.base.$value };
  if (Object.keys(tokens.color.light).sort().join() !== Object.keys(tokens.color.dark).sort().join()) throw new Error('Light and dark token keys differ');
  return '/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */\nexport const tokens = ' + JSON.stringify(tokens, null, 2) + ' as const;\n';
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(await readFile(new URL('../tokens.json', import.meta.url), 'utf8'));
  await writeFile(new URL('../src/generated/tokens.tsx', import.meta.url), buildTokens(source));
  console.log('Generated src/generated/tokens.tsx from tokens.json');
}
