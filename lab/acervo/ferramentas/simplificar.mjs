#!/usr/bin/env node
/**
 * Simplifica de novo um GLB já baixado, com uma tolerância de erro maior que a de tools/polyhaven.mjs
 * (que para em 0,02 e por isso não consegue reduzir conjuntos de muitas peças pequenas, como os livros).
 *
 *   node lab/acervo/ferramentas/simplificar.mjs book_encyclopedia_set_01 --tri 5000 [--erro 0.08] [--tex 512] [--saida outro_nome]
 *
 * Lê e grava em public/assets/modelos/<id>.glb (ou <saida>.glb). Não mexe nos créditos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  if (i < 0) return padrao;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const alvo = Number(opcao('tri', 5000));
const erro = Number(opcao('erro', 0.08));
const tex = Number(opcao('tex', 0));
const saida = opcao('saida', null);
const id = args[0];
if (!id) {
  console.error('uso: node lab/acervo/ferramentas/simplificar.mjs <id> --tri 5000 [--erro 0.08] [--tex 512] [--saida nome]');
  process.exit(1);
}
const arquivo = path.join(RAIZ, 'public', 'assets', 'modelos', `${id}.glb`);
const destino = path.join(RAIZ, 'public', 'assets', 'modelos', `${saida ?? id}.glb`);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(arquivo);
const contar = () => {
  let n = 0;
  for (const malha of doc.getRoot().listMeshes())
    for (const prim of malha.listPrimitives()) {
      const idx = prim.getIndices();
      n += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    }
  return Math.round(n);
};
const antes = contar();
await MeshoptSimplifier.ready;
if (antes > alvo) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: alvo / antes, error: erro }), prune());
if (tex > 0) await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 84 }));
await io.write(destino, doc);
console.log(JSON.stringify({ id, arquivo: path.relative(RAIZ, destino), triangulosAntes: antes, triangulos: contar(), kb: Math.round(fs.statSync(destino).size / 1024) }));
