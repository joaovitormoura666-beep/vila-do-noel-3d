/**
 * Testes da lógica do jogo 3D que não precisa de WebGL: a agenda da entrega, as regras das etiquetas de nome,
 * o plano do elenco (quem monta, quem entra, quem sobra) e o simulador de visitantes da demonstração.
 */
import { describe, expect, it } from 'vitest';
import { Agenda, ROTEIRO, avaliar, novoQuadro, type FaseId } from '../src/jogo3d/agenda';
import { ETIQUETAS, OPCOES, Posicionador, comEtiqueta, contarMaisN, dentro, sobrepoe, type AreaProibida, type PedidoEtiqueta } from '../src/jogo3d/etiquetas';
import { capacidadeDoCaminho, proximoAEntrar, proximoAMontar, sobrando } from '../src/jogo3d/elenco';
import { criarSorteio, hashTexto } from '../src/jogo3d/sorteio';
import { SimuladorDeVisitantes } from '../src/jogo3d/simulador';
import type { Participant } from '../shared/types';

describe('agenda da entrega 3D', () => {
  const ag = new Agenda();

  it('tem as dez fases em ordem e dura perto de 9 s (cerca de 11 s por pessoa com a caminhada)', () => {
    const ids = ag.fases.map((f) => f.id);
    expect(ids).toEqual(['chegada', 'saudacao', 'fala', 'saco', 'caixa', 'suspense', 'abre', 'revelacao', 'entrega', 'festa']);
    expect(ag.total).toBeCloseTo(ROTEIRO.reduce((s, f) => s + f.duracao, 0), 6);
    expect(ag.total).toBeGreaterThan(8);
    expect(ag.total).toBeLessThan(10.5);
    for (let i = 1; i < ag.fases.length; i++) expect(ag.fases[i].inicio).toBeCloseTo(ag.fases[i - 1].fim, 9);
  });

  it('acha a fase de cada instante', () => {
    expect(ag.faseEm(-0.1)).toBeNull();
    expect(ag.faseEm(0)?.id).toBe('chegada');
    expect(ag.faseEm(ag.inicio('fala') + 0.01)?.id).toBe('fala');
    expect(ag.faseEm(ag.total)).toBeNull();
  });

  it('recusa um roteiro sem alguma fase', () => {
    expect(() => new Agenda(ROTEIRO.filter((f) => f.id !== 'abre'))).toThrow();
  });

  it('mantém todos os pesos entre 0 e 1 do começo ao fim', () => {
    const q = novoQuadro();
    for (let t = -0.5; t <= ag.total + 1; t += 0.05) {
      avaliar(ag, t, q);
      for (const v of Object.values(q.noel)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      for (const v of Object.values(q.visitante)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(Number.isFinite(q.caixa.tampa)).toBe(true);
      expect(Number.isFinite(q.presente.giro)).toBe(true);
    }
  });

  it('mostra o balão da fala obrigatória na fase "fala" e acena na saudação', () => {
    const q = novoQuadro();
    avaliar(ag, (ag.inicio('fala') + ag.fim('fala')) / 2, q);
    expect(q.balao).toBe('fala');
    expect(q.noel.talk).toBeGreaterThan(0.5);
    avaliar(ag, (ag.inicio('saudacao') + ag.fim('saudacao')) / 2, q);
    expect(q.balao).toBe('saudacao');
    expect(q.noel.wave).toBeGreaterThan(0.5);
  });

  it('segue a ordem: saco, caixa, abertura, revelação, entrega e festa', () => {
    const q = novoQuadro();
    const meio = (id: FaseId) => (ag.inicio(id) + ag.fim(id)) / 2;
    avaliar(ag, meio('saco'), q);
    expect(q.noel.rummage).toBeGreaterThan(0.5);
    expect(q.presente.visivel).toBe(false);
    avaliar(ag, meio('suspense'), q);
    expect(q.caixa.visivel).toBe(true);
    expect(q.caixa.tampa).toBeLessThan(0.05);
    avaliar(ag, ag.fim('abre') - 0.01, q);
    expect(q.caixa.tampa).toBeGreaterThan(0.5);
    avaliar(ag, meio('revelacao'), q);
    expect(q.presente.visivel).toBe(true);
    expect(q.presente.naMao).toBe(false);
    expect(q.noel.present).toBeGreaterThan(0.5);
    avaliar(ag, ag.inicio('festa') + 0.01, q);
    expect(q.presente.naMao).toBe(true);
    expect(q.caixa.visivel).toBe(false);
    avaliar(ag, meio('festa'), q);
    expect(q.visitante.joy).toBeGreaterThan(0.5);
    expect(q.noel.cheer).toBeGreaterThan(0.3);
    expect(q.balao).toBe('despedida');
  });

  it('o presente só sobe depois que a caixa abre e o brilho fica contido', () => {
    const q = novoQuadro();
    let maxBrilho = 0;
    for (let t = 0; t < ag.total; t += 0.02) {
      avaliar(ag, t, q);
      if (q.presente.visivel && !q.presente.naMao) expect(t).toBeGreaterThanOrEqual(ag.inicio('abre'));
      maxBrilho = Math.max(maxBrilho, q.presente.brilho);
    }
    expect(maxBrilho).toBeLessThanOrEqual(1);
  });

  it('é determinística e não guarda estado entre chamadas', () => {
    const a = novoQuadro();
    const b = novoQuadro();
    avaliar(ag, 8.1, a);
    avaliar(ag, 2, b);
    avaliar(ag, 8.1, b);
    expect(b).toEqual(a);
  });

  it('depois do fim o visitante continua segurando o presente', () => {
    const q = avaliar(ag, ag.total + 2, novoQuadro());
    expect(q.visitante.hold).toBe(1);
    expect(q.presente.naMao).toBe(true);
  });
});

describe('etiquetas de nome', () => {
  const pedido = (id: string, x: number, y: number, w = 200, h = 50): PedidoEtiqueta => ({ id, x, y, pes: y + 300, w, h });
  const area = (nome: string, l: number, t: number, r: number, b: number, ativa = true): AreaProibida => ({ nome, ativa, l, t, r, b });

  it('só os primeiros da fila têm nome; o resto vai para o +N', () => {
    const fila = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(comEtiqueta(fila)).toEqual(fila.slice(0, ETIQUETAS.maxFila));
    expect(ETIQUETAS.maxFila).toBeGreaterThanOrEqual(5);
    expect(ETIQUETAS.maxFila).toBeLessThanOrEqual(6);
    expect(contarMaisN(12, 6)).toBe(6);
    expect(contarMaisN(3, 5)).toBe(0);
  });

  it('as opções começam pelo lugar acima da cabeça e ficam cada vez mais caras', () => {
    expect(OPCOES[0]).toMatchObject({ dx: 0, degrau: 0, abaixo: false });
    for (let i = 1; i < OPCOES.length; i++) expect(OPCOES[i].custo).toBeGreaterThanOrEqual(OPCOES[i - 1].custo);
  });

  it('fica acima da cabeça quando há espaço', () => {
    const p = new Posicionador();
    p.comecar();
    const l = p.colocar(pedido('a', 500, 900), []);
    expect(l).not.toBeNull();
    expect(l!.opcao).toBe(0);
    expect(l!.b).toBeLessThanOrEqual(900);
    expect(l!.l).toBeCloseTo(400);
  });

  it('nunca cobre uma área proibida ativa (rosto do Noel, saco, entrega...)', () => {
    const p = new Posicionador();
    p.comecar();
    const rosto = area('noel', 380, 780, 620, 900);
    const l = p.colocar(pedido('a', 500, 900), [rosto]);
    expect(l).not.toBeNull();
    expect(sobrepoe(l!, rosto)).toBe(false);
    // inativa não atrapalha
    p.comecar();
    const l2 = p.colocar(pedido('b', 500, 900), [area('noel', 380, 780, 620, 900, false)]);
    expect(l2!.opcao).toBe(0);
  });

  it('o atendido pode ficar sobre a área que ele libera', () => {
    const p = new Posicionador();
    p.comecar();
    const ent = area('entrega', 300, 700, 700, 1000);
    const l = p.colocar({ ...pedido('a', 500, 900), libera: 'entrega' }, [ent]);
    expect(l!.opcao).toBe(0);
  });

  it('duas etiquetas nunca se sobrepõem e as duas ficam dentro da área de jogo', () => {
    const p = new Posicionador();
    p.comecar();
    const a = { ...p.colocar(pedido('a', 500, 900), [])! };
    const b = { ...p.colocar(pedido('b', 520, 905), [])! };
    expect(sobrepoe(a, b)).toBe(false);
    expect(dentro(a, ETIQUETAS.area)).toBe(true);
    expect(dentro(b, ETIQUETAS.area)).toBe(true);
  });

  it('sem lugar válido, devolve null (a pessoa passa a contar no +N)', () => {
    const p = new Posicionador();
    p.comecar();
    const tudo = area('balao', 0, 0, 1080, 1920);
    expect(p.colocar(pedido('a', 500, 900), [tudo])).toBeNull();
    // fora da área de jogo (no título) também não vale
    p.comecar();
    expect(p.colocar({ ...pedido('b', 500, 200), pes: 260 }, [])).toBeNull();
  });

  it('prefere continuar no lugar do quadro anterior (não fica pulando)', () => {
    const p = new Posicionador();
    p.comecar();
    // no primeiro quadro um obstáculo empurra a etiqueta para o lado
    const obst = area('saco', 380, 800, 560, 860);
    const l1 = { ...p.colocar(pedido('a', 500, 900), [obst])! };
    expect(l1.opcao).not.toBe(0);
    // no quadro seguinte o obstáculo some, mas um deslocamento pequeno não vence a preferência
    p.comecar();
    const l2 = p.colocar(pedido('a', 500, 900), [])!;
    expect(l2.opcao === l1.opcao || OPCOES[l1.opcao].custo - ETIQUETAS.ficar > 0).toBe(true);
  });
});

describe('plano do elenco (quem monta, quem entra, quem sobra)', () => {
  const fila = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('monta um por vez, em ordem, até o limite mais o pré-aquecimento', () => {
    const montados = new Set<string>();
    const ordem: string[] = [];
    for (let i = 0; i < 10; i++) {
      const id = proximoAMontar(fila, montados, 3, 1);
      if (!id) break;
      montados.add(id);
      ordem.push(id);
    }
    expect(ordem).toEqual(['a', 'b', 'c', 'd']);
  });

  it('entra em cena na ordem da fila e só com a entrada livre', () => {
    const pronto = new Set(['a', 'b', 'c']);
    expect(proximoAEntrar(fila, new Set(), pronto, 4, true)).toBe('a');
    expect(proximoAEntrar(fila, new Set(), pronto, 4, false)).toBeNull();
    expect(proximoAEntrar(fila, new Set(['a']), pronto, 4, true)).toBe('b');
    // "c" não passa na frente de "b" se "b" ainda não estiver montado
    expect(proximoAEntrar(fila, new Set(['a']), new Set(['a', 'c']), 4, true)).toBeNull();
    // respeita o limite de gente na tela
    expect(proximoAEntrar(fila, new Set(['a', 'b']), pronto, 2, true)).toBeNull();
  });

  it('descarta quem foi montado e saiu da fila (pular, limpar), menos quem está ocupado', () => {
    expect(sobrando(['a', 'x', 'y'], fila, new Set(['y']))).toEqual(['x']);
  });

  it('calcula quantos cabem esperando no caminho', () => {
    expect(capacidadeDoCaminho(20, 1.15, 1.05, 2.4)).toBe(Math.floor((20 - 1.15 - 2.4) / 1.05) + 1);
    expect(capacidadeDoCaminho(2, 1.15, 1.05, 2.4)).toBe(0);
  });
});

describe('sorteio com semente e simulador de visitantes', () => {
  it('o sorteio é determinístico e fica entre 0 e 1', () => {
    const a = criarSorteio('vila');
    const b = criarSorteio('vila');
    const c = criarSorteio('outra');
    const va = Array.from({ length: 20 }, a);
    expect(Array.from({ length: 20 }, b)).toEqual(va);
    expect(Array.from({ length: 20 }, c)).not.toEqual(va);
    for (const v of va) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(hashTexto('Luna')).toBe(hashTexto('Luna'));
  });

  it('o simulador cria participantes únicos e repetíveis com a mesma semente', () => {
    const s1 = new SimuladorDeVisitantes('teste');
    const s2 = new SimuladorDeVisitantes('teste');
    const p1 = Array.from({ length: 8 }, () => s1.participante());
    const p2 = Array.from({ length: 8 }, () => s2.participante());
    expect(p2).toEqual(p1);
    expect(new Set(p1.map((p) => p.userId)).size).toBe(8);
    for (const p of p1) expect(p.nickname.length).toBeGreaterThan(0);
  });

  it('"Entrar 10" põe dez pessoas na fila aos poucos (não todas no mesmo quadro)', () => {
    const s = new SimuladorDeVisitantes('dez');
    const entraram: Participant[] = [];
    s.pedir(10);
    let maxPorQuadro = 0;
    for (let i = 0; i < 120; i++) {
      const antes = entraram.length;
      s.update(1 / 30, entraram.length, (p) => entraram.push(p));
      maxPorQuadro = Math.max(maxPorQuadro, entraram.length - antes);
    }
    expect(entraram.length).toBe(10);
    expect(maxPorQuadro).toBe(1);
  });
});
