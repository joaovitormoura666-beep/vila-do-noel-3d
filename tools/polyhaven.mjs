#!/usr/bin/env node
/**
 * Baixa recursos do Poly Haven (polyhaven.com), todos com licença CC0 (uso livre, inclusive comercial),
 * e os prepara para o jogo. Registra cada recurso em public/assets/CREDITOS.md.
 *
 *   node tools/polyhaven.mjs buscar poltrona chair --tipo models     procura no catálogo (ids, nomes, etiquetas, triângulos)
 *   node tools/polyhaven.mjs modelo ArmChair_01 [--res 1k] [--tri 20000] [--tex 1024]
 *        baixa o glTF, simplifica a malha até --tri triângulos (se tiver mais) e grava um GLB com texturas
 *        WebP em public/assets/modelos/<id>.glb
 *   node tools/polyhaven.mjs textura wood_floor [--res 1k] [--mapas diff,nor,arm,rough,ao,disp]
 *        grava JPG em public/assets/texturas/<id>/<mapa>.jpg (padrão: diff, nor e arm; nor = normal no padrão OpenGL;
 *        arm = oclusão no vermelho, rugosidade no verde e metal no azul, em um arquivo só)
 *   node tools/polyhaven.mjs hdri <id> [--res 1k]                    grava public/assets/hdri/<id>.hdr
 *   node tools/polyhaven.mjs info <id>                               mostra os dados do recurso no catálogo
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'public', 'assets');
const UA = 'asset-fetch/1.0';
const API = 'https://api.polyhaven.com';

const args = process.argv.slice(2);
const cmd = args.shift();
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

/** Baixa com o curl do sistema (ele já respeita o proxy e os certificados do ambiente). */
function curl(url, file, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const argsCurl = ['-sS', '-f', '-L', '--max-time', '300', '-A', UA, url];
      if (file) argsCurl.push('-o', file);
      return execFileSync('curl', argsCurl, { maxBuffer: 64 * 1024 * 1024 });
    } catch (err) {
      if (i >= tries - 1) throw new Error(`falha ao baixar ${url}: ${String(err.stderr || err.message).trim()}`);
      execFileSync('sleep', [String(2 * (i + 1))]);
    }
  }
}

async function get(url) {
  const body = curl(url);
  return { json: async () => JSON.parse(body.toString('utf8')) };
}

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  curl(url, `${file}.parte`);
  fs.renameSync(`${file}.parte`, file);
  return file;
}

async function catalog(type) {
  const file = path.join(SRC, 'catalogo', `${type}.json`);
  if (!fs.existsSync(file)) await download(`${API}/assets?t=${type}`, file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function findAsset(id) {
  for (const type of ['models', 'textures', 'hdris']) {
    const cat = await catalog(type);
    if (cat[id]) return { type, data: cat[id] };
  }
  throw new Error(`recurso não encontrado no catálogo: ${id} (use "buscar")`);
}

function credit(id, type, data) {
  const file = path.join(OUT, 'CREDITOS.md');
  const header =
    '# Créditos dos recursos 3D\n\nTodos os recursos abaixo vêm do Poly Haven (https://polyhaven.com) e têm licença CC0 1.0\n(domínio público: uso livre, inclusive comercial, sem exigência de crédito). Listamos os autores por reconhecimento.\n\n| Recurso | Tipo | Autor | Página |\n| --- | --- | --- | --- |\n';
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : header;
  const line = `| ${data.name} (\`${id}\`) | ${type === 'models' ? 'modelo' : type === 'textures' ? 'textura' : 'ambiente'} | ${Object.keys(data.authors || {}).join(', ') || 'Poly Haven'} | https://polyhaven.com/a/${id} |`;
  if (!text.includes(`(\`${id}\`)`)) {
    text = text.replace(/\s*$/, '\n') + line + '\n';
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(file, text);
  }
}

async function buscar() {
  const tipo = opt('tipo', null);
  const words = args.map((w) => w.toLowerCase());
  const types = tipo ? [tipo] : ['models', 'textures', 'hdris'];
  for (const type of types) {
    const cat = await catalog(type);
    for (const [id, a] of Object.entries(cat)) {
      const text = `${id} ${a.name} ${(a.categories || []).join(' ')} ${(a.tags || []).join(' ')}`.toLowerCase();
      if (!words.length || words.some((w) => text.includes(w))) {
        const extra = type === 'models' ? ` | ${a.polycount ?? '?'} triângulos | ${(a.dimensions || []).map((d) => (d / 1000).toFixed(2)).join(' x ')} m` : '';
        console.log(`${type.padEnd(8)} ${id} | ${a.name} | ${(a.categories || []).join(', ')} | ${(a.tags || []).slice(0, 10).join(', ')}${extra}`);
      }
    }
  }
}

async function modelo() {
  const id = args[0];
  const res = opt('res', '1k');
  const targetTri = Number(opt('tri', 20000));
  const texSize = Number(opt('tex', 1024));
  const keep = args.includes('--manter');
  const { type, data } = await findAsset(id);
  if (type !== 'models') throw new Error(`${id} não é um modelo`);
  const files = await (await get(`${API}/files/${id}`)).json();
  const pack = files.gltf?.[res]?.gltf;
  if (!pack) throw new Error(`sem glTF em ${res} para ${id}`);
  const dir = path.join(SRC, 'modelos', id);
  const gltfFile = await download(pack.url, path.join(dir, path.basename(pack.url)));
  for (const [rel, inc] of Object.entries(pack.include || {})) await download(inc.url, path.join(dir, rel));

  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { dedup, prune, weld, simplify, textureCompress, flatten, join, quantize } = await import('@gltf-transform/functions');
  const { MeshoptSimplifier } = await import('meshoptimizer');
  const sharp = (await import('sharp')).default;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(gltfFile);
  const countTris = () => {
    let n = 0;
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        n += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
      }
    return Math.round(n);
  };
  const before = countTris();
  await doc.transform(dedup(), flatten(), join(), weld());
  if (before > targetTri) {
    await MeshoptSimplifier.ready;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: targetTri / before, error: 0.02 }));
  }
  // quantize: posições, normais e UV em inteiros (arquivo perto da metade, sem decodificador extra no navegador)
  await doc.transform(prune(), quantize(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 84 }));
  const out = path.join(OUT, 'modelos', `${id}.glb`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await io.write(out, doc);
  if (!keep) fs.rmSync(dir, { recursive: true, force: true }); // os originais são grandes: guardamos só o GLB pronto
  credit(id, type, data);
  const dims = (data.dimensions || []).map((d) => (d / 1000).toFixed(2)).join(' x ');
  console.log(JSON.stringify({ id, arquivo: path.relative(ROOT, out), url: `/assets/modelos/${id}.glb`, kb: Math.round(fs.statSync(out).size / 1024), triangulosAntes: before, triangulos: countTris(), dimensoesMetros: dims, materiais: doc.getRoot().listMaterials().length }));
}

const MAPS = { diff: 'Diffuse', nor: 'nor_gl', rough: 'Rough', ao: 'AO', disp: 'Displacement', arm: 'arm', metal: 'Metal' };

async function textura() {
  const id = args[0];
  const res = opt('res', '1k');
  const maps = opt('mapas', 'diff,nor,arm').split(',');
  const { type, data } = await findAsset(id);
  if (type !== 'textures') throw new Error(`${id} não é uma textura`);
  const files = await (await get(`${API}/files/${id}`)).json();
  const done = {};
  for (const m of maps) {
    const key = MAPS[m];
    const entry = key && files[key]?.[res]?.jpg;
    if (!entry) {
      done[m] = 'não existe';
      continue;
    }
    const out = path.join(OUT, 'texturas', id, `${m}.jpg`);
    if (!fs.existsSync(out)) {
      // baixa o original e regrava mais leve (mesma resolução, JPEG otimizado): cada mapa cai para perto da metade
      const bruto = path.join(SRC, 'texturas', id, `${m}.jpg`);
      await download(entry.url, bruto);
      const sharp = (await import('sharp')).default;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await sharp(bruto).jpeg({ quality: m === 'diff' ? 84 : 80, mozjpeg: true }).toFile(out);
      fs.rmSync(bruto, { force: true });
    }
    done[m] = `/assets/texturas/${id}/${m}.jpg (${Math.round(fs.statSync(out).size / 1024)} kB)`;
  }
  credit(id, type, data);
  console.log(JSON.stringify({ id, nome: data.name, tamanhoRealMetros: data.dimensions ? data.dimensions.map((d) => d / 1000) : undefined, mapas: done }));
}

async function hdri() {
  const id = args[0];
  const res = opt('res', '1k');
  const { type, data } = await findAsset(id);
  if (type !== 'hdris') throw new Error(`${id} não é um ambiente HDRI`);
  const files = await (await get(`${API}/files/${id}`)).json();
  const entry = files.hdri?.[res]?.hdr;
  if (!entry) throw new Error(`sem .hdr em ${res} para ${id}`);
  const out = path.join(OUT, 'hdri', `${id}.hdr`);
  await download(entry.url, out);
  credit(id, type, data);
  console.log(JSON.stringify({ id, url: `/assets/hdri/${id}.hdr`, kb: Math.round(fs.statSync(out).size / 1024) }));
}

async function info() {
  const { type, data } = await findAsset(args[0]);
  console.log(JSON.stringify({ type, ...data }, null, 1));
}

const table = { buscar, modelo, textura, hdri, info };
if (!table[cmd]) {
  console.log('uso: node tools/polyhaven.mjs buscar|modelo|textura|hdri|info ... (veja o cabeçalho do arquivo)');
  process.exit(1);
}
table[cmd]().catch((err) => {
  console.error(`erro: ${err.message}`);
  process.exit(1);
});
