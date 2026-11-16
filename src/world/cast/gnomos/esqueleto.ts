/**
 * Esqueleto dos gnomos: índices dos ossos, pais e nomes. As posições de ligação (pose em T, braços
 * abertos ao longo de X, pés em y = 0, de frente para +Z) saem da modelagem de cada corpo.
 * "E" é o lado +X (esquerda do personagem), "D" o lado -X.
 */
export const O = {
  RAIZ: 0,
  QUADRIL: 1,
  BARRIGA: 2,
  PEITO: 3,
  CABECA: 4,
  G0: 5,
  G1: 6,
  G2: 7,
  G3: 8,
  BARBA0: 9,
  BARBA1: 10,
  BRACO_E: 11,
  ANTE_E: 12,
  MAO_E: 13,
  BRACO_D: 14,
  ANTE_D: 15,
  MAO_D: 16,
  COXA_E: 17,
  CANELA_E: 18,
  PE_E: 19,
  COXA_D: 20,
  CANELA_D: 21,
  PE_D: 22,
  PALP_E: 23,
  PALP_D: 24,
  PINF_E: 25,
  PINF_D: 26,
  OLHO_E: 27,
  OLHO_D: 28,
  SOBR_E: 29,
  SOBR_D: 30,
  BIGODE: 31,
  TRANCA_E: 32,
  TRANCA_D: 33,
  CACHECOL: 34,
  /** Dois ossos a mais no gorro (a corrente fica G0 a G5, para o pano dobrar em vários pontos). */
  G4: 35,
  G5: 36,
  /** Boca (abre na alegria) e dedos (fecham em volta do presente, abrem na alegria). */
  BOCA: 37,
  DEDOS_E: 38,
  DEDOS_D: 39,
} as const;

export const TOTAL_OSSOS = 40;

/** Pai de cada osso (-1 = raiz). */
export const PAIS: readonly number[] = [
  -1, // RAIZ
  O.RAIZ, // QUADRIL
  O.QUADRIL, // BARRIGA
  O.BARRIGA, // PEITO
  O.PEITO, // CABECA
  O.CABECA, // G0
  O.G0, // G1
  O.G1, // G2
  O.G2, // G3
  O.CABECA, // BARBA0
  O.BARBA0, // BARBA1
  O.PEITO, // BRACO_E
  O.BRACO_E, // ANTE_E
  O.ANTE_E, // MAO_E
  O.PEITO, // BRACO_D
  O.BRACO_D, // ANTE_D
  O.ANTE_D, // MAO_D
  O.QUADRIL, // COXA_E
  O.COXA_E, // CANELA_E
  O.CANELA_E, // PE_E
  O.QUADRIL, // COXA_D
  O.COXA_D, // CANELA_D
  O.CANELA_D, // PE_D
  O.CABECA, // PALP_E
  O.CABECA, // PALP_D
  O.CABECA, // PINF_E
  O.CABECA, // PINF_D
  O.CABECA, // OLHO_E
  O.CABECA, // OLHO_D
  O.CABECA, // SOBR_E
  O.CABECA, // SOBR_D
  O.CABECA, // BIGODE
  O.CABECA, // TRANCA_E
  O.CABECA, // TRANCA_D
  O.PEITO, // CACHECOL
  O.G3, // G4
  O.G4, // G5
  O.CABECA, // BOCA
  O.MAO_E, // DEDOS_E
  O.MAO_D, // DEDOS_D
];
