import { describe, expect, it } from 'vitest';
import { apiUrl, avatarSrc, resolveBackend, screenKeyFrom, type PageLocation } from '../src/events/backend';

const page = (href: string): PageLocation => {
  const u = new URL(href);
  return { protocol: u.protocol, host: u.host, origin: u.origin, search: u.search };
};
const cloudflare = page('https://vila-do-noel.pages.dev/');
const localPc = page('http://localhost:3000/painel.html');

describe('config.json do front (endereço do back-end)', () => {
  it('sem config.json usa a própria página (modo local)', () => {
    expect(resolveBackend(null, localPc)).toEqual({ base: '', ws: 'ws://localhost:3000/ws', from: 'pagina' });
    expect(resolveBackend({ backend: '' }, localPc).base).toBe('');
    expect(resolveBackend({ backend: '   ' }, cloudflare)).toMatchObject({ base: '', ws: 'wss://vila-do-noel.pages.dev/ws' });
  });

  it('com o back-end na VM, monta o WebSocket seguro e as rotas /api', () => {
    const info = resolveBackend({ backend: 'https://api.meusite.com.br/' }, cloudflare);
    expect(info).toEqual({ base: 'https://api.meusite.com.br', ws: 'wss://api.meusite.com.br/ws', from: 'config' });
    expect(apiUrl(info, '/api/audio')).toBe('https://api.meusite.com.br/api/audio');
    expect(apiUrl(info, 'api/saude')).toBe('https://api.meusite.com.br/api/saude');
  });

  it('aceita porta, caminho e quem esqueceu o https:// ou colou o /ws no fim', () => {
    expect(resolveBackend({ backend: 'http://192.0.2.10:3000' }, page('http://localhost:8080/'))).toMatchObject({
      base: 'http://192.0.2.10:3000',
      ws: 'ws://192.0.2.10:3000/ws',
    });
    expect(resolveBackend({ backend: 'https://site.com/vila/' }, cloudflare)).toMatchObject({ base: 'https://site.com/vila', ws: 'wss://site.com/vila/ws' });
    expect(resolveBackend({ backend: 'api.meusite.com.br' }, cloudflare).base).toBe('https://api.meusite.com.br');
    expect(resolveBackend({ backend: 'wss://api.meusite.com.br/ws' }, cloudflare)).toMatchObject({ base: '', problem: expect.stringMatching(/https:\/\//) });
    expect(resolveBackend({ backend: 'https://api.meusite.com.br/ws' }, cloudflare).base).toBe('https://api.meusite.com.br');
  });

  it('?servidor= no endereço vale mais que o config.json (para testes)', () => {
    const info = resolveBackend({ backend: 'https://api.meusite.com.br' }, page('https://vila-do-noel.pages.dev/painel?servidor=https://teste.meusite.com.br'));
    expect(info).toMatchObject({ base: 'https://teste.meusite.com.br', from: 'link' });
  });

  it('o mesmo endereço da página vira "mesma origem"', () => {
    expect(resolveBackend({ backend: 'http://localhost:3000' }, localPc)).toMatchObject({ base: '', ws: 'ws://localhost:3000/ws' });
  });

  it('explica os erros comuns em vez de falhar calado', () => {
    expect(resolveBackend({ backend: 'https://api.seu-dominio.com.br' }, cloudflare).problem).toMatch(/exemplo/);
    expect(resolveBackend({ backend: 'http://api.meusite.com.br' }, cloudflare).problem).toMatch(/https/);
    expect(resolveBackend({ backend: 'ht!tp://??' }, cloudflare)).toMatchObject({ base: '', problem: expect.any(String) });
    expect(resolveBackend('texto qualquer', cloudflare)).toMatchObject({ base: '', from: 'pagina' });
    expect(resolveBackend({ backend: 42 }, cloudflare)).toMatchObject({ base: '', from: 'pagina' });
  });

  it('fotos de perfil passam pelo back-end certo', () => {
    const vm = resolveBackend({ backend: 'https://api.meusite.com.br' }, cloudflare);
    expect(avatarSrc(vm, 'https://p16.tiktokcdn.com/a.jpg')).toBe('https://api.meusite.com.br/api/avatar?url=https%3A%2F%2Fp16.tiktokcdn.com%2Fa.jpg');
    expect(avatarSrc(vm, '/api/avatar-sim/sim-1.svg')).toBe('https://api.meusite.com.br/api/avatar-sim/sim-1.svg');
    expect(avatarSrc(vm, 'data:image/svg+xml;utf8,x')).toBe('data:image/svg+xml;utf8,x');
    const local = resolveBackend(null, localPc);
    expect(avatarSrc(local, '/api/avatar-sim/sim-1.svg')).toBe('/api/avatar-sim/sim-1.svg');
  });

  it('a tela do jogo lê a chave da tela do próprio endereço (?tela= ou #tela=)', () => {
    expect(screenKeyFrom('?obs&tela=abc123', '')).toBe('abc123');
    expect(screenKeyFrom('?obs', '#tela=def456')).toBe('def456');
    expect(screenKeyFrom('?tela=%20xyz%20', '')).toBe('xyz');
    expect(screenKeyFrom('?obs', '')).toBeNull();
    expect(screenKeyFrom('?tela=', '#outra=1')).toBeNull();
  });
});
