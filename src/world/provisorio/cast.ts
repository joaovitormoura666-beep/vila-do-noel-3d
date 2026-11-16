/**
 * Elenco provisório (bonecos de blocos), só para o jogo funcionar enquanto os
 * personagens de verdade não estão prontos. Serve também de exemplo mínimo do contrato Cast.
 */
import * as THREE from 'three';
import type { BuildCast, Cast, GiftBox, SantaPose, SantaRig, VisitorPose, VisitorRig } from '../contracts';

const COATS = ['#b62835', '#174d3b', '#2f7fb5', '#7a4b9a', '#d9773b', '#2e8c8c', '#c24e7b', '#e8bc65'];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const buildCast: BuildCast = () => {
  const skin = new THREE.MeshStandardMaterial({ color: '#f0c6a0', roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: '#f7f4ef', roughness: 0.9 });
  const red = new THREE.MeshStandardMaterial({ color: '#b62835', roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e8bc65', roughness: 0.5, metalness: 0.3 });
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.34, 6, 14);
  const headGeo = new THREE.SphereGeometry(0.27, 18, 14);
  const armGeo = new THREE.CapsuleGeometry(0.075, 0.26, 4, 8);
  armGeo.translate(0, -0.2, 0);

  function createVisitor(seed: string): VisitorRig {
    const h = hash(seed);
    const coat = new THREE.MeshStandardMaterial({ color: COATS[h % COATS.length], roughness: 0.85 });
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const torso = new THREE.Mesh(bodyGeo, coat);
    torso.position.y = 0.47;
    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = 0.98;
    const armL = new THREE.Mesh(armGeo, coat);
    armL.position.set(-0.34, 0.72, 0);
    const armR = new THREE.Mesh(armGeo, coat);
    armR.position.set(0.34, 0.72, 0);
    body.add(torso, head, armL, armR);
    body.traverse((o) => (o.castShadow = true));
    const labelAnchor = new THREE.Object3D();
    labelAnchor.position.y = 1.27;
    const giftAnchor = new THREE.Object3D();
    giftAnchor.position.y = 1.62;
    body.add(labelAnchor, giftAnchor);
    const pose: VisitorPose = { walk: 0, phase: (h % 628) / 100, jump: 0, hold: 0, joy: 0, lookUp: 0 };
    const idle = (h % 100) / 16;
    return {
      root,
      pose,
      labelAnchor,
      giftAnchor,
      height: 1.25,
      update(_dt, t) {
        const up = Math.max(pose.hold, pose.joy);
        const swing = Math.sin(pose.phase) * 0.7 * pose.walk;
        body.position.y = pose.jump * 0.45 + Math.abs(Math.sin(pose.phase)) * 0.05 * pose.walk + Math.sin(t * 1.6 + idle) * 0.012;
        body.rotation.z = Math.sin(pose.phase) * 0.07 * pose.walk;
        armL.rotation.set(swing * (1 - up), 0, -0.15 - up * 2.7);
        armR.rotation.set(-swing * (1 - up), 0, 0.15 + up * 2.7);
        head.rotation.x = -pose.lookUp * 0.5;
      },
      dispose() {
        coat.dispose();
      },
    };
  }

  function createSanta(): SantaRig {
    const root = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.6, 6, 16), red);
    torso.position.y = 0.95;
    const head = new THREE.Group();
    head.position.y = 1.78;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), skin));
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), white);
    beard.position.set(0, -0.2, 0.14);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 14), red);
    hat.position.y = 0.48;
    head.add(beard, hat);
    const armGeoS = new THREE.CapsuleGeometry(0.14, 0.5, 4, 10);
    armGeoS.translate(0, -0.36, 0);
    const armL = new THREE.Mesh(armGeoS, red);
    armL.position.set(-0.7, 1.45, 0);
    const armR = new THREE.Mesh(armGeoS, red);
    armR.position.set(0.7, 1.45, 0);
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial({ color: '#8a5a36', roughness: 0.95 }));
    sack.position.set(1.35, 0.62, 0.1);
    sack.scale.set(1, 1.1, 1);
    const sackMouth = new THREE.Object3D();
    sackMouth.position.set(1.35, 1.45, 0.1);
    const bubbleAnchor = new THREE.Object3D();
    bubbleAnchor.position.y = 2.45;
    root.add(torso, head, armL, armR, sack, sackMouth, bubbleAnchor);
    root.traverse((o) => (o.castShadow = true));
    const pose: SantaPose = { wave: 0, talk: 0, rummage: 0, present: 0, give: 0, cheer: 0 };
    return {
      root,
      pose,
      sackMouth,
      bubbleAnchor,
      height: 2.4,
      update(_dt, t) {
        const breathe = Math.sin(t * 1.4) * 0.012;
        torso.scale.setScalar(1 + breathe);
        head.rotation.x = Math.sin(t * 9) * 0.06 * pose.talk;
        head.position.y = 1.78 + Math.abs(Math.sin(t * 9)) * 0.03 * pose.talk;
        const up = Math.max(pose.present, pose.cheer);
        // braço direito (do lado da câmera): acena; os dois sobem ao apresentar
        armR.rotation.set(-pose.give * 1.2, 0, 0.2 + pose.wave * (2.4 + Math.sin(t * 9) * 0.35) + up * 2.6);
        armL.rotation.set(-pose.rummage * (0.9 + Math.sin(t * 14) * 0.25), 0, -0.2 - up * 2.6 - pose.rummage * 0.9);
        root.position.y = Math.abs(Math.sin(t * 7)) * 0.08 * pose.cheer;
      },
      dispose() {},
    };
  }

  function createGift(_id: string): THREE.Object3D {
    const g = new THREE.Group();
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: '#e8bc65', emissive: '#e8bc65', emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.4 }));
    g.add(star);
    return g;
  }

  function createGiftBox(): GiftBox {
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), red);
    body.position.y = 0.35;
    const lid = new THREE.Group();
    lid.position.y = 0.7;
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), gold);
    lidMesh.position.y = 0.1;
    lid.add(lidMesh);
    root.add(body, lid);
    return { root, lid, body };
  }

  const cast: Cast = { createVisitor, createSanta, createGift, createGiftBox, setQuality() {} };
  return cast;
};
