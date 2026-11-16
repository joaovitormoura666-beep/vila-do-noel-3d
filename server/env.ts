import { existsSync, readFileSync } from 'node:fs';

/**
 * Leitura do arquivo .env (uma configuração por linha, no formato NOME=valor).
 * Linhas começando com # são comentários. Valores podem vir entre aspas.
 * Feito à mão para o servidor não depender de nenhum pacote extra.
 */
export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      // comentário no fim da linha: "PORT=3000   # porta"
      value = value.replace(/\s+#.*$/, '').trim();
    }
    out[m[1]] = value;
  }
  return out;
}

/**
 * Carrega o .env para `process.env`, sem sobrescrever o que já veio do sistema
 * (ex.: variáveis definidas no serviço do systemd ou no Docker valem mais).
 * Devolve true se o arquivo existia.
 */
export function loadDotEnv(file: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!existsSync(file)) return false;
  const values = parseDotEnv(readFileSync(file, 'utf8'));
  for (const [k, v] of Object.entries(values)) if (env[k] === undefined) env[k] = v;
  return true;
}
