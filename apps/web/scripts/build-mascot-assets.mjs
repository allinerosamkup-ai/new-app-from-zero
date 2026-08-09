#!/usr/bin/env node
/**
 * Gera os assets do mascote a partir dos PNGs-mestres.
 *
 * Os originais têm 1254×1254 e ~1,4 MB cada — 11,7 MB para as oito fases, num
 * PWA que faz precache. Na tela o mascote ocupa 96 a 160 px, então o arquivo
 * grande não entrega nada além de espera.
 *
 * Duas coisas acontecem aqui, e a segunda importa tanto quanto a primeira:
 *
 * 1. **WebP em 320 e 640 px.** 640 cobre retina no maior uso.
 * 2. **Máscara radial com borda esfumada.** O PNG-mestre é RGB sem alfa, com
 *    fundo creme chapado: colado como está, vira um quadrado creme no card
 *    branco e um bloco claro no modo escuro (`--warm-bg` é `#FFFFFF` no claro e
 *    `#101716` no escuro). A máscara dissolve o creme na borda, então o mesmo
 *    arquivo funciona nos dois temas.
 *
 * Os mestres não entram no repositório principal — ficam na branch
 * `codex/airia-orbital-mascot`. Rodar isto de novo só é necessário se a arte
 * mudar:
 *
 *   node apps/web/scripts/build-mascot-assets.mjs <pasta-com-os-png>
 */
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2]
  ?? path.resolve(webRoot, '../../.worktrees/airia-orbital-mascot/apps/web/public/mascot/phases');
const outDir = path.join(webRoot, 'public/mascot/phases');

const SIZES = [320, 640];
/**
 * Opaco até aqui, some no raio total.
 *
 * Alto de propósito. Começar a queda cedo dissolveria melhor o creme num fundo
 * escuro, mas come a borda das pétalas — e o tema escuro do CSS não é
 * alcançável hoje (nenhum código escreve `data-theme`). Entre proteger a arte
 * no fundo real e proteger um tema que ninguém vê, a arte ganha. Se o escuro
 * voltar a existir, este é o número a revisar.
 */
const SOLID_STOP = 0.86;
/**
 * Recorte central antes de reduzir.
 *
 * O mestre tem margem larga de fundo — a criatura ocupa pouco mais da metade do
 * quadro. Reduzir sem cortar entrega um mascote pequeno cercado de creme; o
 * corte deixa o sujeito grande e o halo curto. Os valores vêm dos limites reais
 * da arte (pétalas em ~170–1060 px, sombra até ~1100) num quadro de 1254.
 */
const CROP = { left: 135, top: 140, size: 960 };

function maskSvg(size) {
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="fade" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="${SOLID_STOP * 100}%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#fade)"/>
</svg>`);
}

mkdirSync(outDir, { recursive: true });

const files = readdirSync(source).filter((name) => name.endsWith('.png'));
if (files.length === 0) {
  console.error(`Nenhum PNG em ${source}`);
  process.exit(1);
}

let totalBefore = 0;
let totalAfter = 0;

for (const file of files.sort()) {
  const input = path.join(source, file);
  totalBefore += statSync(input).size;

  for (const size of SIZES) {
    const suffix = size === SIZES[0] ? '' : `@${size}`;
    const output = path.join(outDir, `${path.basename(file, '.png')}${suffix}.webp`);

    const resized = await sharp(input)
      .extract({ left: CROP.left, top: CROP.top, width: CROP.size, height: CROP.size })
      .resize(size, size, { fit: 'cover' })
      .toBuffer();
    await sharp(resized)
      .composite([{ input: maskSvg(size), blend: 'dest-in' }])
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(output);

    totalAfter += statSync(output).size;
    console.log(`${path.basename(output).padEnd(42)} ${(statSync(output).size / 1024).toFixed(1)} KB`);
  }
}

const kb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`\nmestres: ${kb(totalBefore)} → publicados: ${kb(totalAfter)}`);
