/**
 * Cenário provisório (blocos simples), só para o jogo funcionar enquanto o cenário
 * de verdade não está pronto. Serve também de exemplo mínimo do contrato VillageSet.
 */
import * as THREE from 'three';
import type { BuildVillageSet, Level, Look, VillageAnchors } from '../contracts';

export const buildVillageSet: BuildVillageSet = () => {
  const root = new THREE.Group();
  const look: Look = {
    background: '#17253B',
    fog: { color: '#17253B', near: 26, far: 70 },
    toneMapping: 'aces',
    exposure: 1.05,
    bloom: { strength: 0.5, radius: 0.6, threshold: 0.9 },
    finish: { vignette: 0.6, vignetteColor: '#0a1020', warmth: 0.4, grain: 0.3 },
    camera: { fov: 30, position: [0, 11.5, 21], target: [0, 1.4, -1.5], sway: 0.15 },
  };

  root.add(new THREE.HemisphereLight('#8fa9d9', '#2b3a57', 0.9));
  const moon = new THREE.DirectionalLight('#bcd0ff', 1.5);
  moon.position.set(-9, 16, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -14;
  sc.right = 14;
  sc.top = 16;
  sc.bottom = -12;
  sc.far = 50;
  root.add(moon);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#dfe7f2', roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const house = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 3.6), new THREE.MeshStandardMaterial({ color: '#7b4a30' }));
  house.position.set(0, 1.6, -7.5);
  house.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.2, 4), new THREE.MeshStandardMaterial({ color: '#f7f4ef' }));
  roof.position.set(0, 4.3, -7.5);
  roof.rotation.y = Math.PI / 4;
  const windowLight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(3) }));
  windowLight.position.set(-1.2, 1.7, -5.68);
  root.add(house, roof, windowLight);

  const treeMat = new THREE.MeshStandardMaterial({ color: '#174d3b' });
  for (const [x, z, s] of [[-5.5, -6, 1.5], [5.6, -6.4, 1.7], [-6.4, 1.5, 1.2], [6.5, 3.5, 1.3]] as const) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 3.4 * s, 10), treeMat);
    tree.position.set(x, 1.7 * s, z);
    tree.castShadow = true;
    root.add(tree);
  }

  const lamp = new THREE.PointLight('#ffcf80', 0, 9, 1.6);
  lamp.position.set(-0.6, 2.6, -2.4);
  root.add(lamp);
  let active = 0;
  let activeTarget = 0;

  const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  const delivery = v(-1.2, -2.6);
  const anchors: VillageAnchors = {
    santa: { position: v(1.1, -3.0), yaw: -0.5 },
    delivery: { position: delivery, yaw: 1.0 },
    reveal: new THREE.Vector3(-0.1, 4.3, -2.6),
    queuePath: [v(-9, 8.2), v(-4.2, 7.4), v(0, 7.0), v(3.2, 6.4), v(4.3, 4.6), v(3.2, 3.0), v(0, 2.6), v(-3.0, 2.2), v(-4.2, 0.6), v(-3.4, -1.2), delivery],
    exitPath: [delivery.clone(), v(-0.4, -1.0), v(2.6, -0.4), v(6, -0.6), v(10, -1.2)],
    queueSpacing: 1.35,
    frontGap: 3.4,
  };

  return {
    root,
    look,
    anchors,
    update(dt) {
      active += (activeTarget - active) * Math.min(1, dt * 4);
      lamp.intensity = active * 26;
    },
    setQuality(level: Level) {
      moon.castShadow = level !== 'baixa';
      moon.shadow.mapSize.set(level === 'alta' ? 2048 : 1024, level === 'alta' ? 2048 : 1024);
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
    },
    setDeliveryActive(on: boolean) {
      activeTarget = on ? 1 : 0;
    },
    setAmbient() {
      /* o cenário provisório não tem efeitos ambientais */
    },
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    },
  };
};
