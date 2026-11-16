import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/types';
import { GiftPicker, GIFTS } from '../src/gifts/giftCatalog';
import { PathTrack } from '../src/queue/PathTrack';
import { fill, GREETINGS, MAIN_LINE, PhrasePicker, speakableName } from '../src/santa/phrases';
import { computeSpeed } from '../src/settingsState';

describe('PathTrack (caminho da fila)', () => {
  const track = new PathTrack([
    [0, 0],
    [100, 0],
    [100, 100],
  ]);

  it('começa e termina nos pontos definidos', () => {
    expect(track.at(0)).toMatchObject({ x: 0, y: 0 });
    const end = track.at(track.length);
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(100);
    expect(track.at(-50)).toMatchObject({ x: 0, y: 0 });
    expect(track.at(99999).y).toBeCloseTo(100);
  });

  it('tem comprimento coerente e avança de forma contínua', () => {
    expect(track.length).toBeGreaterThan(170);
    expect(track.length).toBeLessThan(230);
    let prev = track.at(0);
    for (let s = 5; s <= track.length; s += 5) {
      const cur = track.at(s);
      const step = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      expect(step).toBeGreaterThan(3);
      expect(step).toBeLessThan(6);
      prev = { ...cur };
    }
  });
});

describe('presentes', () => {
  it('são apenas decorativos e têm nomes para tela e para a fala', () => {
    expect(GIFTS.length).toBeGreaterThanOrEqual(10);
    for (const g of GIFTS) {
      expect(g.name.length).toBeGreaterThan(2);
      expect(g.spoken).toMatch(/^(um|uma) /);
    }
    expect(new Set(GIFTS.map((g) => g.id)).size).toBe(GIFTS.length);
  });

  it('não repete o mesmo presente em sequência', () => {
    const picker = new GiftPicker();
    let last = '';
    for (let i = 0; i < 300; i++) {
      const g = picker.pick();
      expect(g.id).not.toBe(last);
      last = g.id;
    }
  });
});

describe('falas do Papai Noel', () => {
  it('inclui a frase principal exigida', () => {
    expect(MAIN_LINE.text).toBe('Vamos ver qual é o seu presente!');
  });

  it('personaliza com o nome e o presente', () => {
    expect(fill('Olá, {nome}! Saiu {presente}!', { nome: 'Bia', presente: 'uma estrela' })).toBe('Olá, Bia! Saiu uma estrela!');
    for (const g of GREETINGS) expect(g.text).toContain('{nome}');
  });

  it('não repete a mesma frase duas vezes seguidas', () => {
    const picker = new PhrasePicker();
    let last = '';
    for (let i = 0; i < 100; i++) {
      const ph = picker.pick(GREETINGS);
      expect(ph.id).not.toBe(last);
      last = ph.id;
    }
  });

  it('deixa nomes de usuário pronunciáveis', () => {
    expect(speakableName('juju_2026')).toBe('juju');
    expect(speakableName('✨Maria.Clara✨')).toBe('Maria Clara');
    expect(speakableName('x_x')).toBe('');
    expect(speakableName('João Pedro da Silva')).toBe('João Pedro');
  });
});

describe('velocidade automática', () => {
  it('mantém o ritmo normal com fila pequena e acelera com fila grande', () => {
    expect(computeSpeed(DEFAULT_SETTINGS, 0)).toBe(1);
    expect(computeSpeed(DEFAULT_SETTINGS, 6)).toBe(1);
    expect(computeSpeed(DEFAULT_SETTINGS, 23)).toBeCloseTo(1.5);
    expect(computeSpeed(DEFAULT_SETTINGS, 100)).toBe(2);
    expect(computeSpeed({ ...DEFAULT_SETTINGS, autoSpeed: false }, 100)).toBe(1);
    expect(computeSpeed({ ...DEFAULT_SETTINGS, speed: 3 }, 100)).toBe(4);
  });
});
