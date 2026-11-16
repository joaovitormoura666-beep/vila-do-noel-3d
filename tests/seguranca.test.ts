import { describe, expect, it } from 'vitest';
import { readConfig } from '../server/config';
import { parseDotEnv } from '../server/env';
import { checkAvatarUrl, hostAllowed, safeLookup } from '../server/avatars';
import {
  FailureLimiter,
  TokenBucket,
  checkOrigin,
  ipKey,
  isLoopbackHostHeader,
  isPrivateIp,
  normalizeOrigin,
  parseOriginList,
  tokensMatch,
  weakSecret,
} from '../server/security';

/** Uma senha aleatória de verdade (formato do "openssl rand -hex 24"). */
const FORTE = '9f2c4e7a1b8d3f60a5c2e9b7d4f1a8c3e6b0d2f5a7c9e1b3';

const internet = { allowed: ['https://vila-do-noel.pages.dev', 'https://*.vila-do-noel.pages.dev', 'https://meusite.com.br'], local: false };
const local = { allowed: [], local: true };

describe('checagem de origem (ORIGENS_PERMITIDAS)', () => {
  it('aceita só as origens da lista quando o servidor está na internet', () => {
    expect(checkOrigin('https://vila-do-noel.pages.dev', 'api.meusite.com.br', internet)).toBe('permitida');
    expect(checkOrigin('https://meusite.com.br/', 'api.meusite.com.br', internet)).toBe('permitida');
    expect(checkOrigin('https://site-malicioso.com', 'api.meusite.com.br', internet)).toBe('recusada');
    expect(checkOrigin('http://vila-do-noel.pages.dev', 'api.meusite.com.br', internet)).toBe('recusada'); // http ≠ https
    expect(checkOrigin('https://vila-do-noel.pages.dev.golpe.com', 'api.meusite.com.br', internet)).toBe('recusada');
    expect(checkOrigin('null', 'api.meusite.com.br', internet)).toBe('recusada');
  });

  it('entende o curinga para os endereços de teste da Cloudflare', () => {
    expect(checkOrigin('https://abc123.vila-do-noel.pages.dev', 'api.x.com', internet)).toBe('permitida');
    expect(checkOrigin('https://a.b.vila-do-noel.pages.dev', 'api.x.com', internet)).toBe('permitida');
    expect(checkOrigin('https://outra-vila-do-noel.pages.dev', 'api.x.com', internet)).toBe('recusada');
  });

  it('aceita a mesma origem sem configurar nada (o servidor servindo as páginas)', () => {
    expect(checkOrigin('http://localhost:3000', 'localhost:3000', local)).toBe('mesma');
    // na VM, só quando o próprio servidor também serve as páginas (SERVIR_FRONT=1)
    expect(checkOrigin('https://api.meusite.com.br', 'api.meusite.com.br:443', { ...internet, sameHost: true })).toBe('mesma');
    expect(checkOrigin('https://api.meusite.com.br', 'api.meusite.com.br:443', internet)).toBe('recusada');
  });

  it('no modo local, "mesma origem" só vale para o próprio computador (DNS rebinding)', () => {
    expect(checkOrigin('http://evil.example:3000', 'evil.example:3000', local)).toBe('recusada');
    expect(checkOrigin('http://[::1]:3000', '[::1]:3000', local)).toBe('mesma');
    expect(isLoopbackHostHeader('localhost:3000')).toBe(true);
    expect(isLoopbackHostHeader('127.0.0.1')).toBe(true);
    expect(isLoopbackHostHeader('[::1]:3000')).toBe(true);
    expect(isLoopbackHostHeader('evil.example:3000')).toBe(false);
    expect(isLoopbackHostHeader('127.0.0.1.evil.example')).toBe(false);
    expect(isLoopbackHostHeader(undefined)).toBe(false);
  });

  it('no modo local aceita páginas do próprio computador e recusa sites de fora', () => {
    expect(checkOrigin('http://127.0.0.1:5173', '127.0.0.1:5173', local)).toBe('mesma');
    expect(checkOrigin('http://localhost:5173', '127.0.0.1:3000', local)).toBe('permitida');
    expect(checkOrigin('https://site-qualquer.com', 'localhost:3000', local)).toBe('recusada');
    expect(checkOrigin(undefined, 'localhost:3000', local)).toBe('ausente');
  });

  it('na internet não trata localhost como permitido', () => {
    expect(checkOrigin('http://localhost:5173', 'api.x.com', internet)).toBe('recusada');
  });

  it('normaliza e valida a lista', () => {
    expect(normalizeOrigin('HTTPS://Site.com:443/')).toBe('https://site.com');
    expect(normalizeOrigin('http://localhost:80')).toBe('http://localhost');
    expect(normalizeOrigin('https://site.com/caminho')).toBeNull();
    expect(normalizeOrigin('site.com')).toBeNull();
    const r = parseOriginList('https://a.pages.dev, https://b.com\nhttps://a.pages.dev  lixo');
    expect(r.origins).toEqual(['https://a.pages.dev', 'https://b.com']);
    expect(r.invalid).toEqual(['lixo']);
  });
});

describe('senha do painel', () => {
  it('compara em tempo constante e recusa vazio ou tipo errado', () => {
    expect(tokensMatch('senha-certa-123456', 'senha-certa-123456')).toBe(true);
    expect(tokensMatch('senha-errada', 'senha-certa-123456')).toBe(false);
    expect(tokensMatch('', 'x')).toBe(false);
    expect(tokensMatch(undefined, 'x')).toBe(false);
    expect(tokensMatch(12345, '12345')).toBe(false);
  });

  it('recusa senhas fracas no servidor da internet', () => {
    expect(weakSecret('a'.repeat(32))).toMatch(/poucos caracteres/);
    expect(weakSecret('abcdabcdabcdabcdabcd')).not.toBeNull();
    expect(weakSecret('curta')).toMatch(/curto demais/);
    expect(weakSecret('0123456789abcdef0123')).not.toBeNull();
    expect(weakSecret('9f2c4e7a1b8d3f60a5c2e9b7d4f1a8c3e6b0d2f5a7c9e1b3')).toBeNull();
  });

  it('agrupa endereços IPv6 por /64 nos limites por endereço', () => {
    expect(ipKey('2804:14c:1:2:aaaa:bbbb:cccc:dddd')).toBe('2804:14c:1:2::/64');
    expect(ipKey('2804:14c:1:2::99')).toBe('2804:14c:1:2::/64');
    expect(ipKey('2804:14c::1')).toBe('2804:14c:0:0::/64');
    expect(ipKey('203.0.113.5')).toBe('203.0.113.5');
    expect(ipKey('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  it('bloqueia depois de muitas tentativas erradas', () => {
    const lim = new FailureLimiter(3, 60_000, 60_000);
    lim.fail('1.2.3.4', 0);
    lim.fail('1.2.3.4', 10);
    expect(lim.blockedFor('1.2.3.4', 20)).toBe(0);
    lim.fail('1.2.3.4', 30);
    expect(lim.blockedFor('1.2.3.4', 40)).toBeGreaterThan(0);
    expect(lim.blockedFor('5.6.7.8', 40)).toBe(0);
    expect(lim.blockedFor('1.2.3.4', 70_000)).toBe(0);
  });

  it('limita mensagens por segundo', () => {
    const b = new TokenBucket(2, 3, 0);
    expect([b.take(0), b.take(0), b.take(0), b.take(0)]).toEqual([true, true, true, false]);
    expect(b.take(600)).toBe(true); // repôs uma ficha
  });
});

describe('configuração do servidor', () => {
  it('sem nada configurado continua no modo local de sempre', () => {
    const { config, errors } = readConfig({}, '/tmp/vila', false);
    expect(errors).toEqual([]);
    expect(config).toMatchObject({ host: '127.0.0.1', port: 3000, exposed: false, adminToken: null, serveFront: true, avatarHosts: '*' });
  });

  it('recusa subir na internet sem TOKEN_ADMIN', () => {
    const { errors, config } = readConfig({ HOST: '0.0.0.0' }, '/tmp/vila', false);
    expect(config.exposed).toBe(true);
    expect(errors.join(' ')).toMatch(/TOKEN_ADMIN não está definido/);
  });

  it('considera exposto quem libera uma origem de fora, mesmo ouvindo em 127.0.0.1', () => {
    const { errors, config } = readConfig({ ORIGENS_PERMITIDAS: 'https://vila.pages.dev' }, '/tmp/vila', false);
    expect(config.exposed).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('o servidor empacotado (VM) sempre exige senha, com tamanho mínimo', () => {
    expect(readConfig({}, '/tmp/vila', true).errors.length).toBeGreaterThan(0);
    expect(readConfig({ TOKEN_ADMIN: 'curta' }, '/tmp/vila', true).errors.join(' ')).toMatch(/curto demais/);
    expect(readConfig({ TOKEN_ADMIN: 'troque-por-uma-senha-longa-gerada-com-openssl' }, '/tmp/vila', true).errors.join(' ')).toMatch(/exemplo/);
    expect(readConfig({ TOKEN_ADMIN: 'a'.repeat(32) }, '/tmp/vila', true).errors.join(' ')).toMatch(/poucos caracteres/);
    const ok = readConfig({ TOKEN_ADMIN: FORTE, ORIGENS_PERMITIDAS: 'https://vila.pages.dev', DATA_DIR: '/var/vila' }, '/tmp/vila', true);
    expect(ok.errors).toEqual([]);
    expect(ok.config).toMatchObject({ serveFront: false, dataDir: '/var/vila', settingsFile: '/var/vila/configuracoes.json' });
    expect(ok.config.avatarHosts).toContain('tiktokcdn.com');
  });

  it('a chave da tela vem do TOKEN_TELA ou é calculada da senha do painel', () => {
    const a = readConfig({ TOKEN_ADMIN: FORTE }, '/tmp/vila', true).config;
    expect(a.screenKey).toMatch(/^[0-9a-f]{32}$/);
    expect(a.screenKey).not.toContain(FORTE);
    expect(readConfig({ TOKEN_ADMIN: FORTE }, '/tmp/vila', true).config.screenKey).toBe(a.screenKey); // sempre a mesma
    const b = readConfig({ TOKEN_ADMIN: FORTE, TOKEN_TELA: 'c4f1e8a2b7d3906e5f1a' }, '/tmp/vila', true).config;
    expect(b.screenKey).toBe('c4f1e8a2b7d3906e5f1a');
    expect(readConfig({ TOKEN_ADMIN: FORTE, TOKEN_TELA: FORTE }, '/tmp/vila', true).errors.join(' ')).toMatch(/não pode ser igual/);
    expect(readConfig({}, '/tmp/vila', false).config.screenKey).toBeNull(); // modo local: sem chave
  });

  it('aponta endereços inválidos em ORIGENS_PERMITIDAS', () => {
    const r = readConfig({ ORIGENS_PERMITIDAS: 'vila.pages.dev', TOKEN_ADMIN: FORTE }, '/tmp/vila', false);
    expect(r.errors.join(' ')).toMatch(/vila\.pages\.dev/);
  });

  it('lê o arquivo .env', () => {
    expect(parseDotEnv('# comentário\nPORT=3100\nTOKEN_ADMIN="abc def"\nHOST = 0.0.0.0   # na VM\nexport X=1\n')).toEqual({
      PORT: '3100',
      TOKEN_ADMIN: 'abc def',
      HOST: '0.0.0.0',
      X: '1',
    });
  });
});

describe('proxy de fotos de perfil', () => {
  it('só aceita os hosts da lista e seus subdomínios', () => {
    expect(hostAllowed('p16-sign-va.tiktokcdn.com', ['tiktokcdn.com'])).toBe(true);
    expect(hostAllowed('tiktokcdn.com.golpe.net', ['tiktokcdn.com'])).toBe(false);
    expect(hostAllowed('qualquer.com', '*')).toBe(true);
  });

  it('recusa http, portas estranhas, rede interna e hosts fora da lista', () => {
    expect(() => checkAvatarUrl('http://p16.tiktokcdn.com/a.jpg', ['tiktokcdn.com'])).toThrow();
    expect(() => checkAvatarUrl('https://p16.tiktokcdn.com:8443/a.jpg', ['tiktokcdn.com'])).toThrow();
    expect(() => checkAvatarUrl('https://127.0.0.1/a.jpg', '*')).toThrow();
    expect(() => checkAvatarUrl('https://[::1]/a.jpg', '*')).toThrow();
    expect(() => checkAvatarUrl('https://localhost/a.jpg', '*')).toThrow();
    expect(() => checkAvatarUrl('https://site-qualquer.com/a.jpg', ['tiktokcdn.com'])).toThrow(/host não permitido/);
    expect(() => checkAvatarUrl('https://user:senha@p16.tiktokcdn.com/a.jpg', ['tiktokcdn.com'])).toThrow();
    // IPv4 escrito dentro de um IPv6 (o analisador de URL troca para a forma hexadecimal)
    expect(() => checkAvatarUrl('https://[::ffff:127.0.0.1]/a.png', '*')).toThrow();
    expect(() => checkAvatarUrl('https://[::ffff:169.254.169.254]/latest/meta-data/', '*')).toThrow();
    expect(() => checkAvatarUrl('https://[::ffff:192.168.0.1]/', '*')).toThrow();
    expect(checkAvatarUrl('https://p16-sign.tiktokcdn.com/a.jpg', ['tiktokcdn.com']).hostname).toBe('p16-sign.tiktokcdn.com');
  });

  it('o IP de um nome é conferido na hora de conectar', async () => {
    const resolveWith = (host: string) =>
      new Promise<string>((resolve) => safeLookup(host, {}, (err, address) => resolve(err ? `erro:${err.message}` : String(address))));
    expect(await resolveWith('localhost')).toMatch(/rede interna/);
  });

  it('reconhece endereços de rede interna, inclusive IPv4 escondido em IPv6', () => {
    for (const ip of [
      '10.0.0.1',
      '192.168.1.10',
      '172.16.0.1',
      '169.254.169.254',
      '127.0.0.1',
      '0.0.0.0',
      '255.255.255.255',
      '::',
      '::1',
      'fd00::1',
      'fe80::1',
      'fec0::1',
      '::ffff:10.0.0.1',
      '::ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '::7f00:1',
      '::127.0.0.1',
      '2002:7f00:1::',
      '100::1',
      '2001:db8::1',
      '64:ff9b::a00:1',
      '100.64.0.1',
      'nao-e-ip',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('2606:4700::1111')).toBe(false);
    expect(isPrivateIp('2804:14c:65::1')).toBe(false);
  });
});
