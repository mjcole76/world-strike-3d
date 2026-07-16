import * as THREE from 'three';

export const FIELD_W = 64;
export const FIELD_L = 104;
export const GOAL_W = 18;
export const BALL_Y = 0.48;

export function mat(color: number, roughness = .8, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function buildPitch(scene: THREE.Scene): void {
  const pitchGroup = new THREE.Group();
  scene.add(pitchGroup);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 180), mat(0x101c22));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.08;
  ground.receiveShadow = true;
  scene.add(ground);

  const stripeDepth = FIELD_L / 13;
  for (let i = 0; i < 13; i += 1) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, stripeDepth + .03), mat(i % 2 ? 0x247544 : 0x2b824a));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0, -FIELD_L / 2 + stripeDepth / 2 + i * stripeDepth);
    stripe.receiveShadow = true;
    pitchGroup.add(stripe);
  }

  const white = new THREE.LineBasicMaterial({ color: 0xe8f2e9 });
  const addLine = (points: THREE.Vector3[]): void => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, white);
    line.position.y = .035;
    pitchGroup.add(line);
  };
  addLine([new THREE.Vector3(-32, 0, -52), new THREE.Vector3(32, 0, -52), new THREE.Vector3(32, 0, 52), new THREE.Vector3(-32, 0, 52), new THREE.Vector3(-32, 0, -52)]);
  addLine([new THREE.Vector3(-32, 0, 0), new THREE.Vector3(32, 0, 0)]);
  const centerCurve: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i += 1) {
    const a = i / 64 * Math.PI * 2;
    centerCurve.push(new THREE.Vector3(Math.cos(a) * 9.15, 0, Math.sin(a) * 9.15));
  }
  addLine(centerCurve);
  for (const side of [-1, 1]) {
    const z = side * 52;
    const inner = side * 35.5;
    addLine([new THREE.Vector3(-20.15, 0, z), new THREE.Vector3(-20.15, 0, inner), new THREE.Vector3(20.15, 0, inner), new THREE.Vector3(20.15, 0, z)]);
    const six = side * 46.5;
    addLine([new THREE.Vector3(-9.15, 0, z), new THREE.Vector3(-9.15, 0, six), new THREE.Vector3(9.15, 0, six), new THREE.Vector3(9.15, 0, z)]);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(.18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(0, .04, side * 41);
    pitchGroup.add(spot);
  }
  const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(.2, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = .04;
  pitchGroup.add(centerSpot);
  buildGoals(scene);
  buildCornerFlags(scene);
}

function buildGoals(scene: THREE.Scene): void {
  const postMaterial = mat(0xf7f8f2, .35, .1);
  for (const side of [-1, 1]) {
    const goal = new THREE.Group();
    const z = side * 52;
    const backZ = z + side * 3.2;
    const postGeo = new THREE.CylinderGeometry(.13, .13, 3.1, 10);
    for (const x of [-GOAL_W / 2, GOAL_W / 2]) {
      const post = new THREE.Mesh(postGeo, postMaterial);
      post.position.set(x, 1.55, z);
      post.castShadow = true;
      goal.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, GOAL_W, 10), postMaterial);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 3.1, z);
    goal.add(bar);
    const netMaterial = new THREE.LineBasicMaterial({ color: 0xcde7ef, transparent: true, opacity: .34 });
    for (let x = -GOAL_W / 2; x <= GOAL_W / 2; x += 1.5) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 3.1, z), new THREE.Vector3(x, 2.5, backZ), new THREE.Vector3(x, 0, backZ)]);
      goal.add(new THREE.Line(g, netMaterial));
    }
    for (let y = 0; y <= 3.1; y += .65) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-GOAL_W / 2, y, z), new THREE.Vector3(GOAL_W / 2, y, z), new THREE.Vector3(GOAL_W / 2, y * .8, backZ), new THREE.Vector3(-GOAL_W / 2, y * .8, backZ)]);
      goal.add(new THREE.Line(g, netMaterial));
    }
    scene.add(goal);
  }
}

function buildCornerFlags(scene: THREE.Scene): void {
  for (const x of [-32, 32]) for (const z of [-52, 52]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.2, 6), mat(0xf6f2de));
    pole.position.set(x, 1.1, z);
    scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .62), new THREE.MeshBasicMaterial({ color: z < 0 ? 0x1763ff : 0xd92045, side: THREE.DoubleSide }));
    flag.position.set(x + (x < 0 ? .52 : -.52), 1.75, z);
    flag.rotation.y = x < 0 ? 0 : Math.PI;
    scene.add(flag);
  }
}

export function buildStadium(scene: THREE.Scene): void {
  const standMat = mat(0x07152e, .72, .12);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1763ff, emissive: 0x0b2d76, emissiveIntensity: 1.8 });
  const longGeo = new THREE.BoxGeometry(8, 13, 122);
  for (const x of [-43, 43]) {
    const stand = new THREE.Mesh(longGeo, standMat);
    stand.position.set(x, 5, 0);
    stand.rotation.z = x < 0 ? -.18 : .18;
    scene.add(stand);
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(.25, 1.1, 115), trimMat);
    ribbon.position.set(x + (x < 0 ? 4.3 : -4.3), 4, 0);
    scene.add(ribbon);
  }
  const endGeo = new THREE.BoxGeometry(76, 11, 7);
  for (const z of [-61, 61]) {
    const stand = new THREE.Mesh(endGeo, standMat);
    stand.position.set(0, 4.5, z);
    stand.rotation.x = z < 0 ? .16 : -.16;
    scene.add(stand);
  }

  const crowdGeometry = new THREE.BoxGeometry(.38, .62, .38);
  const crowdMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  const crowd = new THREE.InstancedMesh(crowdGeometry, crowdMaterial, 1300);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let index = 0;
  const colors = [0x1763ff, 0xffffff, 0xd92045, 0xf5ca52, 0x222a3e];
  for (let side = 0; side < 2; side += 1) for (let row = 0; row < 10; row += 1) for (let col = 0; col < 55; col += 1) {
    const x = side ? 39 + row * .55 : -39 - row * .55;
    const z = -55 + col * 2;
    dummy.position.set(x, 2.2 + row * .72 + Math.random() * .16, z + Math.random() * .5);
    dummy.rotation.y = side ? -Math.PI / 2 : Math.PI / 2;
    dummy.updateMatrix(); crowd.setMatrixAt(index, dummy.matrix); color.setHex(colors[(row + col * 3) % colors.length]); crowd.setColorAt(index, color); index += 1;
  }
  for (let side = 0; side < 2; side += 1) for (let row = 0; row < 5; row += 1) for (let col = 0; col < 20; col += 1) {
    const z = side ? 58 + row * .55 : -58 - row * .55;
    const x = -28 + col * 3;
    dummy.position.set(x, 2 + row * .7, z);
    dummy.rotation.y = side ? Math.PI : 0;
    dummy.updateMatrix(); crowd.setMatrixAt(index, dummy.matrix); color.setHex(colors[(row * 2 + col) % colors.length]); crowd.setColorAt(index, color); index += 1;
  }
  crowd.count = index;
  crowd.instanceMatrix.needsUpdate = true;
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  scene.add(crowd);

  const mastMat = mat(0x283647, .4, .8);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xeaf5ff });
  for (const x of [-46, 46]) for (const z of [-58, 58]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.18, .32, 30, 8), mastMat);
    mast.position.set(x, 15, z); scene.add(mast);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(7, 2, .5), lampMat);
    bank.position.set(x, 29, z); bank.lookAt(0, 0, 0); scene.add(bank);
    const light = new THREE.SpotLight(0xdceeff, 70, 150, .55, .65, 1.4);
    light.position.set(x, 28, z); light.target.position.set(0, 0, 0); scene.add(light, light.target);
  }

  const board = new THREE.Group();
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(20, 7, .5), mat(0x050911, .35, .4));
  boardFrame.position.set(0, 16, -65); board.add(boardFrame);
  const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 5.5), new THREE.MeshBasicMaterial({ color: 0x0c3d9b }));
  boardFace.position.set(0, 16, -64.72); board.add(boardFace);
  scene.add(board);
}

export function createPlayerMesh(): THREE.Group {
  const group = new THREE.Group();
  const shirt = mat(0x888888, .62);
  const shorts = mat(0xffffff, .68);
  const skin = mat(0xc7885d, .85);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.48, .62, 1.28, 10), shirt);
  torso.position.y = 1.62; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 10), skin);
  head.position.y = 2.58; head.castShadow = true; group.add(head);
  const shortsMesh = new THREE.Mesh(new THREE.BoxGeometry(.95, .5, .62), shorts);
  shortsMesh.position.y = .92; shortsMesh.castShadow = true; group.add(shortsMesh);
  const legGeo = new THREE.CylinderGeometry(.14, .16, .82, 8);
  const legL = new THREE.Mesh(legGeo, skin); legL.position.set(-.25, .36, 0); legL.castShadow = true; group.add(legL);
  const legR = new THREE.Mesh(legGeo, skin); legR.position.set(.25, .36, 0); legR.castShadow = true; group.add(legR);
  const bootGeo = new THREE.BoxGeometry(.28, .16, .52);
  const bootMat = mat(0x10131a, .5);
  const bootL = new THREE.Mesh(bootGeo, bootMat); bootL.position.set(-.25, -.02, -.1); group.add(bootL);
  const bootR = new THREE.Mesh(bootGeo, bootMat); bootR.position.set(.25, -.02, -.1); group.add(bootR);
  const numberBadge = new THREE.Mesh(new THREE.CircleGeometry(.2, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  numberBadge.position.set(0, 1.65, -.55); numberBadge.rotation.y = Math.PI; group.add(numberBadge);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.phase = Math.random() * Math.PI * 2;
  group.userData.shirtMat = shirt;
  group.userData.shortsMat = shorts;
  return group;
}

export function applyKit(group: THREE.Group, primary: number, secondary: number): void {
  (group.userData.shirtMat as THREE.MeshStandardMaterial).color.setHex(primary);
  (group.userData.shortsMat as THREE.MeshStandardMaterial).color.setHex(secondary);
}

export function createBall(): THREE.Mesh {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.46, 24, 18), mat(0xf1f1e8, .48));
  ball.castShadow = true;
  const panelMat = new THREE.MeshBasicMaterial({ color: 0x071a38 });
  for (let i = 0; i < 7; i += 1) {
    const panel = new THREE.Mesh(new THREE.CircleGeometry(.12, 6), panelMat);
    const a = i / 7 * Math.PI * 2;
    panel.position.set(Math.cos(a) * .42, Math.sin(a * 2) * .1, Math.sin(a) * .42);
    panel.lookAt(0, 0, 0);
    panel.rotateY(Math.PI);
    ball.add(panel);
  }
  return ball;
}

export interface Confetti {
  points: THREE.Points;
  burst(origin: THREE.Vector3, palette: number[]): void;
  update(dt: number): void;
}

export function createConfetti(count = 280): Confetti {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: .3, vertexColors: true, transparent: true, opacity: 1 });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.frustumCulled = false;
  let life = 0;
  const color = new THREE.Color();

  return {
    points,
    burst(origin: THREE.Vector3, palette: number[]): void {
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = origin.x + (Math.random() - .5) * 1.2;
        positions[i * 3 + 1] = origin.y + 1.4 + Math.random() * .8;
        positions[i * 3 + 2] = origin.z + (Math.random() - .5) * 1.2;
        const angle = Math.random() * Math.PI * 2;
        const power = 3 + Math.random() * 7;
        velocities[i * 3] = Math.cos(angle) * power * .6;
        velocities[i * 3 + 1] = 5 + Math.random() * 7;
        velocities[i * 3 + 2] = Math.sin(angle) * power * .6;
        color.setHex(palette[i % palette.length]);
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      life = 2.8;
      material.opacity = 1;
      points.visible = true;
    },
    update(dt: number): void {
      if (!points.visible) return;
      life -= dt;
      if (life <= 0) { points.visible = false; return; }
      for (let i = 0; i < count; i += 1) {
        velocities[i * 3 + 1] -= 8.5 * dt;
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        if (positions[i * 3 + 1] < .04) {
          positions[i * 3 + 1] = .04;
          velocities[i * 3] = 0; velocities[i * 3 + 1] = 0; velocities[i * 3 + 2] = 0;
        }
      }
      material.opacity = Math.min(1, life);
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
