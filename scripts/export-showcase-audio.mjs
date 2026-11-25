import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const source = new URL('../src/audio/sound.ts', import.meta.url);
const output = new URL('../showcase/assets/game-sound.js', import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(source, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});

writeFileSync(output, '// Generated from src/audio/sound.ts by npm run export:showcase-audio.\n' + outputText);
