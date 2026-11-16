#!/usr/bin/env node
/**
 * Converte GLB em glTF com tudo embutido, gravado como .gltf.json, para publicar a demonstração
 * estática onde .glb não é aceito (ex.: prévia no claude.ai). Uso: node tools/glb-para-json.mjs pasta/*.glb
 * Apaga o .glb original. Depois troque '.glb' por '.gltf.json' nos endereços do app/jogo3d.js gerado.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const { json, resources } = await io.writeJSON(doc);
  const mime = (u) => u.endsWith('.webp') ? 'image/webp' : u.endsWith('.png') ? 'image/png' : u.endsWith('.jpg')||u.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream';
  for (const arr of [json.buffers || [], json.images || []])
    for (const it of arr) if (it.uri && resources[it.uri]) it.uri = `data:${mime(it.uri)};base64,${Buffer.from(resources[it.uri]).toString('base64')}`;
  const out = f.replace(/\.glb$/, '.gltf.json');
  fs.writeFileSync(out, JSON.stringify(json));
  fs.rmSync(f);
  console.log(out, fs.statSync(out).size);
}
