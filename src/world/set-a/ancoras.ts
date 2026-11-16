/**
 * Âncoras do jogo na sala A: onde o Noel fica (SENTADO na poltrona grande), onde o visitante para,
 * onde o presente aparece, por onde a fila chega e por onde quem foi atendido sai.
 *
 * O Noel recebe os visitantes sentado no trono (ArmChair_01 em escala 1,5) no meio do tapete, diante
 * da janela. `santa` é o ponto do piso no centro da poltrona, com o giro dela (de frente para a câmera e
 * um pouco virado para a direita, de onde o visitante chega). `delivery` fica à frente e à direita da
 * poltrona (o visitante de perfil para a câmera, de frente para o Noel, sem tapá-lo). A fila entra pela esquerda,
 * desce em direção à câmera, atravessa a frente da sala e sobe pela direita até a entrega (FILA.caminho); quem sai
 * vai para a direita, por trás do primeiro da fila, e some pela borda direita.
 */
import * as THREE from 'three';
import type { VillageAnchors } from '../contracts';
import { FILA, LUGAR } from './ajustes';

/**
 * O assento do trono, para encaixar o modelo do Noel sentado (medido no GLB da ArmChair_01, vezes a escala).
 * Coordenadas do MUNDO, metros. O modelo do Noel sentado vai com a raiz em `santa.position`, girado de
 * `santa.yaw`, e o quadril dele em `quadril`.
 */
export const ASSENTO_DO_NOEL = (() => {
  const e = LUGAR.poltrona.escala;
  const giro = LUGAR.poltrona.giro;
  // medidas da poltrona na escala 1 (eixo Z local = para a frente)
  const ALTURA_ASSENTO = 0.5; // tampo da almofada, no meio
  const FRENTE = 0.33; // borda da frente do assento
  const ENCOSTO = -0.32; // onde a almofada encontra o encosto
  const QUADRIL_Z = -0.12; // quadril de quem senta encostado: um terço do assento a partir do encosto
  const LARGURA_ENTRE_BRACOS = 0.62;
  const ALTURA_BRACO = 0.66;
  const ALTURA_ENCOSTO = 1.065;
  const local = new THREE.Vector3(0, ALTURA_ASSENTO * e + 0.03, QUADRIL_Z * e);
  const quadril = local.applyAxisAngle(new THREE.Vector3(0, 1, 0), giro).add(new THREE.Vector3(LUGAR.poltrona.x, 0, LUGAR.poltrona.z));
  return {
    /** Altura do tampo do assento ao piso (m). */
    alturaAssento: ALTURA_ASSENTO * e,
    /** Profundidade útil do assento, da borda da frente ao encosto (m). */
    profundidadeAssento: (FRENTE - ENCOSTO) * e,
    /** Largura livre entre os braços (m). */
    larguraEntreBracos: LARGURA_ENTRE_BRACOS * e,
    /** Altura do topo dos braços (m). */
    alturaBraco: ALTURA_BRACO * e,
    /** Altura do topo do encosto (m). */
    alturaEncosto: ALTURA_ENCOSTO * e,
    /** Ponto do quadril do Noel sentado (mundo). */
    quadril,
    /** Giro da poltrona e do Noel (rad; 0 = de frente para +Z). */
    yaw: giro,
  };
})();

export function criarAncoras(): VillageAnchors {
  const noel = new THREE.Vector3(LUGAR.noel.x, 0, LUGAR.noel.z);
  const naDirecao = (dir: number, dist: number) => noel.clone().add(new THREE.Vector3(Math.sin(dir) * dist, 0, Math.cos(dir) * dist));
  const entrega = naDirecao(LUGAR.direcaoDaEntrega, LUGAR.distanciaDaEntrega);
  // o visitante atendido olha para o Noel
  const yawEntrega = Math.atan2(noel.x - entrega.x, noel.z - entrega.z);

  // Fila: entra pela esquerda (fora da tela), desce pela esquerda em direção à câmera, atravessa a frente da sala e
  // sobe pela direita até a entrega (FILA.caminho; desenhada para a câmera do jogo). O primeiro da fila espera à
  // direita do visitante atendido, diante da árvore, sem tapá-lo nem tapar o Noel ou o saco.
  const queuePath = [...FILA.caminho.map(([x, z]) => new THREE.Vector3(x, 0, z)), entrega.clone()];
  // Saída: da entrega para a direita, por TRÁS do primeiro da fila (mais fundo que a subida, sem cruzá-la), passando
  // à frente da árvore, e para fora pela borda direita.
  const exitPath = [entrega.clone(), ...FILA.saida.map(([x, z]) => new THREE.Vector3(x, 0, z))];

  return {
    santa: { position: noel, yaw: LUGAR.noelYaw },
    delivery: { position: entrega, yaw: yawEntrega },
    // acima e entre os dois, mais perto do visitante, contra o vão azul da janela e longe do rosto do Noel
    reveal: noel.clone().lerp(entrega, FILA.revelacao.fracao).setY(FILA.revelacao.altura),
    queuePath,
    exitPath,
    queueSpacing: FILA.espaco,
    frontGap: FILA.folgaDaFrente,
  };
}
