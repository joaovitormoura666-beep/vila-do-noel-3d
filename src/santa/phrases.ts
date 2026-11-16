/**
 * Biblioteca de frases do Papai Noel.
 * `{nome}` é trocado pelo nome do participante e `{presente}` pelo presente sorteado.
 * Cada frase tem um `id` para permitir, no futuro, arquivos de voz pré-gravados
 * em public/audio/voz/<id>.mp3 (veja docs/AUDIO.md).
 */
export interface Phrase {
  id: string;
  text: string;
}

export const GREETINGS: Phrase[] = [
  { id: 'ola-1', text: 'Ho, ho, ho! Olá, {nome}!' },
  { id: 'ola-2', text: 'Que alegria te ver, {nome}!' },
  { id: 'ola-3', text: 'Seja bem-vindo à vila, {nome}!' },
  { id: 'ola-4', text: '{nome}, você chegou na hora certa!' },
  { id: 'ola-5', text: 'Ho, ho, ho! Olha quem apareceu: {nome}!' },
  { id: 'ola-6', text: 'Feliz Natal, {nome}! Chegue mais perto!' },
  { id: 'ola-7', text: 'Eu estava esperando por você, {nome}!' },
  { id: 'ola-8', text: '{nome}! Que bom que você veio!' },
];

/** Frase obrigatória da mecânica principal. */
export const MAIN_LINE: Phrase = { id: 'principal', text: 'Vamos ver qual é o seu presente!' };

export const REVEALS: Phrase[] = [
  { id: 'revela-1', text: 'Olha só: {presente}!' },
  { id: 'revela-2', text: 'É {presente}, só para você!' },
  { id: 'revela-3', text: 'Ho, ho, ho! Saiu {presente}!' },
  { id: 'revela-4', text: 'Que beleza! {presente}!' },
  { id: 'revela-5', text: 'Para você, {nome}: {presente}!' },
  { id: 'revela-6', text: 'Eu sabia! {presente}!' },
];

export const FAREWELLS: Phrase[] = [
  { id: 'tchau-1', text: 'Feliz Natal, {nome}!' },
  { id: 'tchau-2', text: 'Volte sempre à vila!' },
  { id: 'tchau-3', text: 'Cuide bem do seu presente!' },
  { id: 'tchau-4', text: 'Obrigado pela visita, {nome}!' },
  { id: 'tchau-5', text: 'Até a próxima, {nome}!' },
];

export const IDLE_LINES: Phrase[] = [
  { id: 'espera-1', text: 'Quem será o próximo a ganhar um presente?' },
  { id: 'espera-2', text: 'Ho, ho, ho! A vila está aberta!' },
  { id: 'espera-3', text: 'Tem presente para todo mundo!' },
  { id: 'espera-4', text: 'Entre na fila e venha me visitar!' },
];

export const REACTIONS = ['Uau!', 'Amei!', 'Que lindo!', 'Obrigado, Noel!', 'Eba!', 'Adorei!', 'Que fofo!', 'Demais!'];

/** Sorteia sem repetir a última escolha de cada lista. */
export class PhrasePicker {
  private last = new Map<unknown[], number>();

  constructor(private readonly random: () => number = Math.random) {}

  pick<T>(list: T[]): T {
    if (list.length <= 1) return list[0];
    const prev = this.last.get(list);
    let i = Math.floor(this.random() * list.length);
    if (i === prev) i = (i + 1) % list.length;
    this.last.set(list, i);
    return list[i];
  }
}

export function fill(text: string, vars: { nome?: string; presente?: string }): string {
  return text.replace(/\{nome\}/g, vars.nome ?? 'amigo').replace(/\{presente\}/g, vars.presente ?? 'um presente');
}

/**
 * Deixa um nome de usuário "falável": tira emojis, símbolos e números soltos,
 * para a voz não soletrar coisas como "underline 2 0 2 6".
 */
export function speakableName(nick: string): string {
  const cleaned = nick
    .normalize('NFKC')
    .replace(/[_.\-]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter((w) => w.length > 1);
  return words.slice(0, 2).join(' ');
}
