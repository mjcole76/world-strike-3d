import * as THREE from 'three';
import './style.css';
import { clamp, detectGoal, formatClock, penaltyResult, regulationResult, type MatchPhase, type Score, type Team } from './gameCore';

type Role = 'GK' | 'DEF' | 'MID' | 'ST';
interface Footballer {
  id: number;
  team: Team;
  role: Role;
  number: number;
  mesh: THREE.Group;
  home: THREE.Vector3;
  velocity: THREE.Vector3;
  stamina: number;
  controlled: boolean;
  cooldown: number;
  tackle: number;
}
interface DebugApi {
  getState: () => Record<string, unknown>;
  setTime: (seconds: number) => void;
  forceGoal: (team: Team) => void;
  start: () => void;
}
declare global { interface Window { __worldStrike: DebugApi } }

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const stage = $('#stage');
const scoreNode = $('#score');
const clockNode = $('#clock');
const playerLabel = $('#playerLabel');
const staminaBar = $('#staminaBar');
const possessionNode = $('#possession');
const matchMessage = $('#matchMessage');
const powerWrap = $('#powerWrap');
const powerBar = $('#powerBar');
const menu = $('#menu');
const pauseMenu = $('#pauseMenu');
const resultOverlay = $('#result');
const penaltyPanel = $('#penaltyPanel');
const penaltyScoreNode = $('#penaltyScore');
const soundtrack = $('#soundtrack') as HTMLAudioElement;
const musicButton = $('#musicButton') as HTMLButtonElement;
const touchControls = $('#touchControls');
const joystick = $('#joystick');
const joystickKnob = $('#joystickKnob');
const touchShoot = $('#touchShoot') as HTMLButtonElement;
const touchSprintButton = $('#touchSprint') as HTMLButtonElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06162f);
scene.fog = new THREE.FogExp2(0x07162d, 0.0085);

const camera = new THREE.PerspectiveCamera(innerWidth < innerHeight ? 62 : 48, innerWidth / innerHeight, 0.1, 500);
camera.position.set(44, 48, 58);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.5 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
stage.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x9ec8ff, 0x10220f, 2.4);
scene.add(hemi);
const flood = new THREE.DirectionalLight(0xf2f7ff, 4.4);
flood.position.set(25, 55, 20);
flood.castShadow = true;
flood.shadow.mapSize.set(2048, 2048);
flood.shadow.camera.left = -70;
flood.shadow.camera.right = 70;
flood.shadow.camera.top = 70;
flood.shadow.camera.bottom = -70;
scene.add(flood);

const FIELD_W = 64;
const FIELD_L = 104;
const GOAL_W = 18;
const BALL_Y = 0.48;
const keys = new Set<string>();
const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
const temp = new THREE.Vector3();
let touchMoveX = 0;
let touchMoveZ = 0;
let touchSprint = false;
let joystickPointer: number | null = null;

let phase: MatchPhase = 'menu';
let score: Score = { aurora: 0, atlas: 0 };
let timeLeft = 180;
let possessor: Footballer | null = null;
let controlled: Footballer;
let shotCharge = 0;
let charging = false;
let messageTimer = 0;
let celebrationTimer = 0;
let kickoffTeam: Team = 'aurora';
let audioContext: AudioContext | null = null;
let penaltyAim = 0;
let penaltyInFlight = false;
let penaltyTimer = 0;
let auroraPens: boolean[] = [];
let atlasPens: boolean[] = [];
let penaltyRound = 0;

const pitchGroup = new THREE.Group();
scene.add(pitchGroup);

function mat(color: number, roughness = .8, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createPitch(): void {
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
  createGoals();
  createCornerFlags();
}

function createGoals(): void {
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

function createCornerFlags(): void {
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

function createStadium(): void {
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

function createPlayerMesh(team: Team, number: number, role: Role): THREE.Group {
  const group = new THREE.Group();
  const primary = team === 'aurora' ? 0x1763ff : 0xd92045;
  const secondary = team === 'aurora' ? 0xf7fbff : 0x242632;
  const keeper = role === 'GK';
  const shirt = mat(keeper ? (team === 'aurora' ? 0xf5ca52 : 0x44d59a) : primary, .62);
  const shorts = mat(secondary, .68);
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
  numberBadge.position.set(0, 1.65, -.55); numberBadge.rotation.y = Math.PI; numberBadge.userData.number = number; group.add(numberBadge);
  group.userData.legL = legL; group.userData.legR = legR; group.userData.phase = Math.random() * Math.PI * 2;
  return group;
}

const formation: Array<[Role, number, number, number]> = [
  ['GK', 1, 0, 47], ['DEF', 4, -13, 27], ['DEF', 5, 13, 27], ['MID', 8, -4, 8], ['ST', 10, 4, -8],
];
const players: Footballer[] = [];
let nextId = 0;
for (const team of ['aurora', 'atlas'] as Team[]) {
  const sign = team === 'aurora' ? 1 : -1;
  for (const [role, number, x, z] of formation) {
    const mesh = createPlayerMesh(team, number, role);
    mesh.position.set(team === 'aurora' ? x : -x, 0, z * sign);
    mesh.rotation.y = team === 'aurora' ? Math.PI : 0;
    scene.add(mesh);
    players.push({ id: nextId++, team, role, number, mesh, home: mesh.position.clone(), velocity: new THREE.Vector3(), stamina: 100, controlled: false, cooldown: 0, tackle: 0 });
  }
}
controlled = players.find((player) => player.team === 'aurora' && player.role === 'ST')!;
controlled.controlled = true;

const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.72, .9, 28), new THREE.MeshBasicMaterial({ color: 0xf5ca52, side: THREE.DoubleSide, transparent: true, opacity: .95 }));
selectionRing.rotation.x = -Math.PI / 2;
selectionRing.position.y = .05;
scene.add(selectionRing);
const selectionArrow = new THREE.Mesh(new THREE.ConeGeometry(.25, .55, 8), new THREE.MeshBasicMaterial({ color: 0xf5ca52 }));
scene.add(selectionArrow);

const ball = new THREE.Mesh(new THREE.SphereGeometry(.46, 24, 18), mat(0xf1f1e8, .48));
ball.castShadow = true;
scene.add(ball);
const panelMat = new THREE.MeshBasicMaterial({ color: 0x071a38 });
for (let i = 0; i < 7; i += 1) {
  const panel = new THREE.Mesh(new THREE.CircleGeometry(.12, 6), panelMat);
  const a = i / 7 * Math.PI * 2;
  panel.position.set(Math.cos(a) * .42, BALL_Y + Math.sin(a * 2) * .1, Math.sin(a) * .42);
  panel.lookAt(ball.position);
  ball.add(panel);
}
const ballVelocity = new THREE.Vector3();
ball.position.set(0, BALL_Y, 0);

const penaltyAimMarker = new THREE.Mesh(new THREE.RingGeometry(.48, .7, 20), new THREE.MeshBasicMaterial({ color: 0xf5ca52, side: THREE.DoubleSide }));
penaltyAimMarker.position.set(0, 1.3, -51.1);
penaltyAimMarker.rotation.y = 0;
penaltyAimMarker.visible = false;
scene.add(penaltyAimMarker);

createPitch();
createStadium();

function showMessage(text: string, duration = 1.7): void {
  matchMessage.textContent = text;
  matchMessage.classList.add('visible');
  messageTimer = duration;
}

function ensureAudio(): void {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') void audioContext.resume();
}

function sfx(freq: number, duration: number, type: OscillatorType = 'sine', volume = .035, end = freq): void {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
  gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  osc.connect(gain).connect(audioContext.destination); osc.start(); osc.stop(now + duration);
}

function whistle(long = false): void {
  sfx(1700, long ? .7 : .25, 'sine', .03, 2200);
  setTimeout(() => sfx(1450, long ? .55 : .18, 'sine', .025, 1900), long ? 260 : 110);
}

function resetPositions(team: Team = kickoffTeam): void {
  kickoffTeam = team;
  for (const player of players) {
    player.mesh.visible = true;
    player.mesh.position.copy(player.home);
    player.velocity.set(0, 0, 0);
    player.cooldown = 0;
    player.tackle = 0;
    player.stamina = 100;
  }
  possessor = null;
  ball.position.set(0, BALL_Y, 0);
  ballVelocity.set(0, 0, 0);
  setControlled(players.find((player) => player.team === 'aurora' && player.role === 'ST')!);
  const kickoffPlayer = players.find((player) => player.team === team && player.role === 'MID')!;
  kickoffPlayer.mesh.position.set(team === 'aurora' ? -1.2 : 1.2, 0, team === 'aurora' ? 1 : -1);
  setTimeout(() => {
    if (phase === 'playing') {
      possessor = kickoffPlayer;
      showMessage('KICK OFF');
      whistle();
    }
  }, 500);
}

function setControlled(player: Footballer): void {
  controlled.controlled = false;
  controlled = player;
  controlled.controlled = true;
}

function startMatch(): void {
  score = { aurora: 0, atlas: 0 };
  timeLeft = 180;
  auroraPens = [];
  atlasPens = [];
  penaltyRound = 0;
  touchMoveX = 0;
  touchMoveZ = 0;
  touchSprint = false;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
  phase = 'playing';
  menu.classList.remove('visible');
  resultOverlay.classList.remove('visible');
  pauseMenu.classList.remove('visible');
  penaltyPanel.classList.remove('visible');
  soundtrack.volume = .38;
  void soundtrack.play().catch(() => undefined);
  ensureAudio();
  resetPositions('aurora');
  updateHud();
}

function closestPlayer(team: Team, position: THREE.Vector3, includeKeeper = true): Footballer {
  return players.filter((p) => p.team === team && (includeKeeper || p.role !== 'GK')).reduce((best, player) => player.mesh.position.distanceTo(position) < best.mesh.position.distanceTo(position) ? player : best);
}

function switchPlayer(): void {
  const target = closestPlayer('aurora', ball.position, false);
  setControlled(target);
  sfx(660, .08, 'square', .018, 820);
}

function teamAttackDirection(team: Team): number {
  return team === 'aurora' ? -1 : 1;
}

function kick(from: Footballer, target: THREE.Vector3, speed: number, lift: number): void {
  possessor = null;
  ball.position.copy(from.mesh.position).add(new THREE.Vector3(0, BALL_Y, teamAttackDirection(from.team) * 1.2));
  const direction = target.clone().sub(ball.position);
  direction.y = 0;
  direction.normalize();
  ballVelocity.set(direction.x * speed, lift, direction.z * speed);
  from.cooldown = .35;
  sfx(105, .12, 'sine', .055, 62);
}

function bestPassTarget(from: Footballer, through = false): Footballer {
  const direction = teamAttackDirection(from.team);
  const mates = players.filter((p) => p.team === from.team && p !== from && p.role !== 'GK');
  return mates.reduce((best, candidate) => {
    const candidateProgress = (candidate.mesh.position.z - from.mesh.position.z) * direction;
    const bestProgress = (best.mesh.position.z - from.mesh.position.z) * direction;
    const candidateDistance = candidate.mesh.position.distanceTo(from.mesh.position);
    const bestDistance = best.mesh.position.distanceTo(from.mesh.position);
    const candidateScore = (through ? candidateProgress * 2 : candidateProgress) - candidateDistance * .18;
    const bestScore = (through ? bestProgress * 2 : bestProgress) - bestDistance * .18;
    return candidateScore > bestScore ? candidate : best;
  });
}

function passBall(through = false): void {
  if (possessor !== controlled || phase !== 'playing') return;
  const targetPlayer = bestPassTarget(controlled, through);
  const lead = targetPlayer.velocity.clone().multiplyScalar(through ? .65 : .25);
  const target = targetPlayer.mesh.position.clone().add(lead);
  kick(controlled, target, through ? 27 : 20, through ? 1.1 : .45);
  showMessage(through ? 'THROUGH BALL' : 'PRECISION PASS', .8);
}

function shootBall(power: number): void {
  if (possessor !== controlled) return;
  const direction = teamAttackDirection(controlled.team);
  const goalZ = direction * 53;
  const movementBias = controlled.velocity.x * .065;
  const error = (Math.random() - .5) * (power > .92 ? 3.6 : 1.4);
  const targetX = phase === 'penalty' ? penaltyAim : clamp(movementBias + error, -7.6, 7.6);
  kick(controlled, new THREE.Vector3(targetX, 0, goalZ), 25 + power * 25, 2.8 + power * 4.4);
  sfx(78, .2, 'triangle', .055, 42);
  if (phase === 'playing') showMessage('POWER SHOT', .7);
  if (phase === 'penalty') {
    penaltyInFlight = true;
    penaltyTimer = 0;
  }
}

function tackle(): void {
  if (phase !== 'playing' || controlled.tackle > 0) return;
  controlled.tackle = .65;
  const enemy = players.filter((p) => p.team === 'atlas').sort((a, b) => a.mesh.position.distanceTo(controlled.mesh.position) - b.mesh.position.distanceTo(controlled.mesh.position))[0];
  if (enemy && possessor === enemy && enemy.mesh.position.distanceTo(controlled.mesh.position) < 2.1) {
    possessor = controlled;
    scoreNode.classList.add('pulse');
    showMessage('INTERCEPTION', .9);
    sfx(150, .1, 'square', .04, 80);
  }
}

function updateControlled(dt: number): void {
  if (phase !== 'playing' && phase !== 'penalty') return;
  let x = touchMoveX;
  let z = touchMoveZ;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  x = clamp(x, -1, 1);
  z = clamp(z, -1, 1);

  if (phase === 'penalty') {
    penaltyAim = clamp(penaltyAim + x * dt * 7, -7.7, 7.7);
    penaltyAimMarker.position.x = penaltyAim;
    controlled.velocity.set(0, 0, 0);
    return;
  }

  const moving = x !== 0 || z !== 0;
  const sprint = (keys.has('ShiftLeft') || touchSprint) && moving && controlled.stamina > 1;
  const speed = sprint ? 13 : 8.3;
  if (moving) {
    const length = Math.hypot(x, z);
    x /= length; z /= length;
    controlled.velocity.set(x * speed, 0, z * speed);
    const nx = clamp(controlled.mesh.position.x + controlled.velocity.x * dt, -31.2, 31.2);
    const nz = clamp(controlled.mesh.position.z + controlled.velocity.z * dt, -50.8, 50.8);
    controlled.mesh.position.set(nx, 0, nz);
    controlled.mesh.rotation.y = Math.atan2(x, z);
  } else {
    controlled.velocity.multiplyScalar(Math.pow(.04, dt));
  }
  controlled.stamina = clamp(controlled.stamina + (sprint ? -29 : 17) * dt, 0, 100);
}

function targetForAi(player: Footballer): THREE.Vector3 {
  const direction = teamAttackDirection(player.team);
  const ownBall = possessor?.team === player.team;
  if (player.role === 'GK') {
    const ownGoal = player.team === 'aurora' ? 48 : -48;
    return new THREE.Vector3(clamp(ball.position.x * .46, -7, 7), 0, ownGoal);
  }
  const nearest = closestPlayer(player.team, ball.position, false) === player;
  if (!ownBall && nearest) return ball.position.clone();
  const shift = ownBall ? direction * 9 : -direction * 3;
  const ballPull = new THREE.Vector3(ball.position.x * .16, 0, ball.position.z * .1);
  return player.home.clone().add(new THREE.Vector3(0, 0, shift)).add(ballPull);
}

function aiUseBall(player: Footballer): void {
  if (possessor !== player || player.cooldown > 0) return;
  const direction = teamAttackDirection(player.team);
  const distanceToGoal = Math.abs(direction * 52 - player.mesh.position.z);
  const pressure = closestPlayer(player.team === 'aurora' ? 'atlas' : 'aurora', player.mesh.position, false).mesh.position.distanceTo(player.mesh.position);
  if (distanceToGoal < 25) {
    const target = new THREE.Vector3((Math.random() - .5) * 10, 0, direction * 53);
    kick(player, target, 30 + Math.random() * 8, 3 + Math.random() * 2);
  } else if (pressure < 4.2 || Math.random() < .004) {
    const mate = bestPassTarget(player, true);
    kick(player, mate.mesh.position.clone().add(new THREE.Vector3(0, 0, direction * 3)), 20, .65);
  }
}

function updateAi(dt: number): void {
  for (const player of players) {
    if (player === controlled || phase !== 'playing') continue;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.tackle = Math.max(0, player.tackle - dt);
    const target = targetForAi(player);
    temp.copy(target).sub(player.mesh.position); temp.y = 0;
    const distance = temp.length();
    if (distance > .45) {
      temp.normalize();
      const speed = player.role === 'GK' ? 7 : possessor === player ? 7.4 : 7.9;
      player.velocity.copy(temp).multiplyScalar(speed);
      player.mesh.position.addScaledVector(player.velocity, dt);
      player.mesh.position.x = clamp(player.mesh.position.x, -31, 31);
      player.mesh.position.z = clamp(player.mesh.position.z, -50, 50);
      player.mesh.rotation.y = Math.atan2(player.velocity.x, player.velocity.z);
    } else player.velocity.multiplyScalar(.8);
    aiUseBall(player);
  }
}

function animatePlayers(dt: number): void {
  for (const player of players) {
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.tackle = Math.max(0, player.tackle - dt);
    const speed = player.velocity.length();
    player.mesh.userData.phase += dt * speed * 1.6;
    const swing = Math.sin(player.mesh.userData.phase) * Math.min(.55, speed * .06);
    const legL = player.mesh.userData.legL as THREE.Mesh;
    const legR = player.mesh.userData.legR as THREE.Mesh;
    legL.rotation.x = swing + (player.tackle > .25 ? -1 : 0);
    legR.rotation.x = -swing;
    player.mesh.position.y = Math.abs(Math.sin(player.mesh.userData.phase * 2)) * Math.min(.05, speed * .006);
  }
  selectionRing.position.set(controlled.mesh.position.x, .055, controlled.mesh.position.z);
  selectionArrow.position.set(controlled.mesh.position.x, 3.65 + Math.sin(performance.now() * .006) * .12, controlled.mesh.position.z);
  selectionArrow.rotation.x = Math.PI;
}

function acquireBall(): void {
  if (possessor || ball.position.y > 1.1 || ballVelocity.length() > 18) return;
  const nearest = players.filter((p) => p.cooldown <= 0).sort((a, b) => a.mesh.position.distanceTo(ball.position) - b.mesh.position.distanceTo(ball.position))[0];
  if (nearest && nearest.mesh.position.distanceTo(ball.position) < 1.5) {
    possessor = nearest;
    ballVelocity.set(0, 0, 0);
    if (nearest.team === 'aurora' && nearest !== controlled && phase === 'playing') setControlled(nearest);
  }
}

function goalkeeperSave(): boolean {
  if (ballVelocity.length() < 10) return false;
  const keeper = players.find((p) => p.role === 'GK' && p.team === (ballVelocity.z < 0 ? 'atlas' : 'aurora'));
  if (!keeper || !keeper.mesh.visible) return false;
  if (keeper.mesh.position.distanceTo(ball.position) < 1.65 && ball.position.y < 2.7) {
    possessor = keeper;
    ballVelocity.set(0, 0, 0);
    showMessage('GREAT SAVE');
    sfx(190, .18, 'triangle', .05, 95);
    if (phase === 'penalty') resolveUserPenalty(false);
    return true;
  }
  return false;
}

function updateBall(dt: number): void {
  if (possessor) {
    const direction = possessor.velocity.lengthSq() > .2 ? possessor.velocity.clone().normalize() : new THREE.Vector3(0, 0, teamAttackDirection(possessor.team));
    ball.position.copy(possessor.mesh.position).add(direction.multiplyScalar(1.05));
    ball.position.y = BALL_Y;
    ball.rotation.x += possessor.velocity.length() * dt * 1.5;
    return;
  }

  ball.position.addScaledVector(ballVelocity, dt);
  ballVelocity.y -= 13 * dt;
  if (ball.position.y <= BALL_Y) {
    ball.position.y = BALL_Y;
    if (Math.abs(ballVelocity.y) > 1.2) ballVelocity.y *= -.42; else ballVelocity.y = 0;
    ballVelocity.x *= Math.pow(.39, dt);
    ballVelocity.z *= Math.pow(.39, dt);
  }
  ball.rotation.x += ballVelocity.z * dt * 2;
  ball.rotation.z -= ballVelocity.x * dt * 2;

  const goal = detectGoal(ball.position.x, ball.position.z, GOAL_W / 2, 51);
  if (goal) {
    if (phase === 'penalty') resolveUserPenalty(true);
    else registerGoal(goal);
    return;
  }
  if (Math.abs(ball.position.x) > FIELD_W / 2) {
    ball.position.x = Math.sign(ball.position.x) * FIELD_W / 2;
    ballVelocity.x *= -.72;
  }
  if (Math.abs(ball.position.z) > FIELD_L / 2) {
    ball.position.z = Math.sign(ball.position.z) * FIELD_L / 2;
    ballVelocity.z *= -.68;
  }
  if (!goalkeeperSave()) acquireBall();
}

function registerGoal(team: Team): void {
  if (phase !== 'playing') return;
  score[team] += 1;
  phase = 'celebration';
  celebrationTimer = 2.7;
  possessor = null;
  ballVelocity.set(0, 0, 0);
  showMessage('GOAL', 2.5);
  sfx(90, .6, 'sawtooth', .055, 45);
  setTimeout(() => sfx(330, .6, 'sine', .04, 660), 160);
  updateHud();
}

function finishRegulation(): void {
  const result = regulationResult(score);
  whistle(true);
  if (result === 'penalty') startPenalties();
  else finishMatch(result);
}

function startPenalties(): void {
  phase = 'penalty';
  penaltyPanel.classList.add('visible');
  auroraPens = [];
  atlasPens = [];
  penaltyRound = 0;
  showMessage('PENALTY SHOOTOUT', 2.4);
  setupPenaltyKick();
}

function setupPenaltyKick(): void {
  phase = 'penalty';
  penaltyInFlight = false;
  penaltyTimer = 0;
  charging = false;
  shotCharge = 0;
  penaltyAim = 0;
  possessor = null;
  for (const player of players) player.mesh.visible = false;
  const shooter = players.find((p) => p.team === 'aurora' && p.role === 'ST')!;
  const keeper = players.find((p) => p.team === 'atlas' && p.role === 'GK')!;
  shooter.mesh.visible = true;
  keeper.mesh.visible = true;
  shooter.mesh.position.set(0, 0, -37.8);
  shooter.mesh.rotation.y = Math.PI;
  keeper.mesh.position.set(0, 0, -49.2);
  keeper.mesh.rotation.y = 0;
  setControlled(shooter);
  ball.position.set(0, BALL_Y, -40.7);
  ballVelocity.set(0, 0, 0);
  possessor = shooter;
  penaltyAimMarker.visible = true;
  penaltyAimMarker.position.x = 0;
  updatePenaltyHud();
  showMessage(`AURORA KICK ${penaltyRound + 1}`, 1.2);
}

function resolveUserPenalty(scored: boolean): void {
  if (!penaltyInFlight) return;
  penaltyInFlight = false;
  auroraPens.push(scored);
  showMessage(scored ? 'PENALTY SCORED' : 'PENALTY MISSED', 1.25);
  sfx(scored ? 520 : 145, .35, scored ? 'sine' : 'sawtooth', .04, scored ? 780 : 70);
  updatePenaltyHud();
  phase = 'celebration';
  setTimeout(() => {
    const atlasScored = Math.random() < .62;
    atlasPens.push(atlasScored);
    showMessage(atlasScored ? 'ATLAS SCORES' : 'AURORA KEEPER SAVES', 1.25);
    updatePenaltyHud();
    penaltyRound += 1;
    const winner = penaltyResult(auroraPens.filter(Boolean).length, atlasPens.filter(Boolean).length, penaltyRound);
    if (winner) {
      setTimeout(() => finishMatch(winner), 1300);
    } else {
      setTimeout(setupPenaltyKick, 1400);
    }
  }, 1450);
}

function updatePenaltyHud(): void {
  const marks = (values: boolean[]): string => Array.from({ length: Math.max(3, values.length) }, (_, i) => i < values.length ? (values[i] ? '●' : '×') : '○').join(' ');
  penaltyScoreNode.textContent = `AUR ${marks(auroraPens)}   ATL ${marks(atlasPens)}`;
}

function finishMatch(winner: Team): void {
  phase = 'finished';
  penaltyAimMarker.visible = false;
  penaltyPanel.classList.remove('visible');
  resultOverlay.classList.add('visible');
  const won = winner === 'aurora';
  $('#resultOverline').textContent = won ? 'WORLD CROWN CHAMPIONS' : 'FINAL WHISTLE';
  $('#resultTitle').innerHTML = won ? 'AURORA RULES<br />THE WORLD' : 'ATLAS TAKES<br />THE CROWN';
  $('#resultDetail').textContent = won ? 'A championship performance under the lights.' : 'The Crimson Wall held firm. Return stronger.';
  $('#finalScore').textContent = `AUR ${score.aurora} - ${score.atlas} ATL${auroraPens.length ? `  (${auroraPens.filter(Boolean).length}-${atlasPens.filter(Boolean).length} PENS)` : ''}`;
  soundtrack.volume = won ? .55 : .2;
  showMessage('FINAL WHISTLE', 2);
}

function updatePenalty(dt: number): void {
  if (phase !== 'penalty' || !penaltyInFlight) return;
  penaltyTimer += dt;
  const keeper = players.find((p) => p.team === 'atlas' && p.role === 'GK')!;
  const saveTarget = clamp(penaltyAim + Math.sin(penaltyRound * 5.7) * 2.8, -7.5, 7.5);
  keeper.mesh.position.x += clamp(saveTarget - keeper.mesh.position.x, -dt * 7, dt * 7);
  if (penaltyTimer > 3.4 || (ballVelocity.length() < 1 && ball.position.z < -42)) resolveUserPenalty(false);
}

function updateHud(): void {
  scoreNode.innerHTML = `${score.aurora}&nbsp;&nbsp;-&nbsp;&nbsp;${score.atlas}`;
  clockNode.textContent = formatClock(timeLeft);
  playerLabel.textContent = `#${controlled.number} ${controlled.role === 'ST' ? 'STRIKER' : controlled.role === 'MID' ? 'MIDFIELDER' : controlled.role === 'DEF' ? 'DEFENDER' : 'GOALKEEPER'}`;
  staminaBar.style.width = `${controlled.stamina}%`;
  possessionNode.textContent = possessor ? `${possessor.team === 'aurora' ? 'AURORA' : 'ATLAS'} BALL` : 'LOOSE BALL';
  powerBar.style.width = `${shotCharge * 100}%`;
  powerWrap.classList.toggle('visible', charging);
  touchControls.classList.toggle('visible', phase === 'playing' || phase === 'penalty');
}

function updateCamera(dt: number): void {
  if (phase === 'menu') {
    const t = performance.now() * .00008;
    camera.position.set(Math.sin(t) * 48, 42, 72 + Math.cos(t) * 18);
    camera.lookAt(0, 0, 0);
    return;
  }
  if (phase === 'penalty' || penaltyPanel.classList.contains('visible')) {
    camera.position.lerp(new THREE.Vector3(18, 12, -27), 1 - Math.pow(.02, dt));
    camera.lookAt(0, 1, -45);
    return;
  }
  cameraTarget.copy(ball.position);
  cameraTarget.x *= .32;
  const portrait = innerWidth < innerHeight;
  const desired = portrait
    ? new THREE.Vector3(cameraTarget.x + 30, 56, cameraTarget.z + 51)
    : new THREE.Vector3(cameraTarget.x + 40, 43, cameraTarget.z + 42);
  camera.position.lerp(desired, 1 - Math.pow(.06, dt));
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z - 5);
}

function update(dt: number): void {
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) matchMessage.classList.remove('visible');
  }
  if (phase === 'playing') {
    timeLeft = Math.max(0, timeLeft - dt);
    updateControlled(dt);
    updateAi(dt);
    updateBall(dt);
    if (timeLeft <= 0) finishRegulation();
  } else if (phase === 'celebration') {
    celebrationTimer -= dt;
    updateBall(dt);
    if (celebrationTimer <= 0 && !auroraPens.length && !atlasPens.length) {
      phase = 'playing';
      kickoffTeam = score.aurora > score.atlas ? 'atlas' : 'aurora';
      resetPositions(kickoffTeam);
    }
  } else if (phase === 'penalty') {
    updateControlled(dt);
    updateBall(dt);
    updatePenalty(dt);
  }
  animatePlayers(dt);
  updateCamera(dt);
  updateHud();
}

function render(): void {
  renderer.render(scene, camera);
}

function loop(): void {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .04);
  update(dt);
  render();
}

function togglePause(): void {
  if (phase === 'playing') {
    phase = 'paused';
    pauseMenu.classList.add('visible');
    soundtrack.volume = .16;
  } else if (phase === 'paused') {
    phase = 'playing';
    pauseMenu.classList.remove('visible');
    soundtrack.volume = .38;
    clock.getDelta();
  }
}

function beginCharge(): void {
  if ((phase === 'playing' || phase === 'penalty') && possessor === controlled && !charging) {
    charging = true;
    shotCharge = 0;
  }
}

function releaseCharge(): void {
  if (!charging) return;
  charging = false;
  if (phase === 'penalty' || shotCharge > .24) shootBall(Math.max(.25, shotCharge));
  else passBall(false);
  shotCharge = 0;
}

function updateJoystick(event: PointerEvent): void {
  const rect = joystick.getBoundingClientRect();
  const radius = rect.width * .34;
  let dx = event.clientX - (rect.left + rect.width / 2);
  let dy = event.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy);
  if (length > radius) {
    dx = dx / length * radius;
    dy = dy / length * radius;
  }
  touchMoveX = dx / radius;
  touchMoveZ = dy / radius;
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function resetJoystick(): void {
  joystickPointer = null;
  touchMoveX = 0;
  touchMoveZ = 0;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
}

joystick.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  joystickPointer = event.pointerId;
  try { joystick.setPointerCapture(event.pointerId); } catch { /* Synthetic QA events have no active pointer. */ }
  updateJoystick(event);
});
joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId === joystickPointer) updateJoystick(event);
});
joystick.addEventListener('pointerup', resetJoystick);
joystick.addEventListener('pointercancel', resetJoystick);

function bindTouchAction(selector: string, action: () => void): void {
  const button = $(selector) as HTMLButtonElement;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.classList.add('active');
    action();
  });
  const release = (): void => button.classList.remove('active');
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

bindTouchAction('#touchSwitch', () => { if (phase === 'playing') switchPlayer(); });
bindTouchAction('#touchThrough', () => passBall(true));
bindTouchAction('#touchTackle', tackle);
bindTouchAction('#touchPass', () => passBall(false));

touchSprintButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  touchSprint = true;
  touchSprintButton.classList.add('active');
});
const stopTouchSprint = (): void => {
  touchSprint = false;
  touchSprintButton.classList.remove('active');
};
touchSprintButton.addEventListener('pointerup', stopTouchSprint);
touchSprintButton.addEventListener('pointercancel', stopTouchSprint);
touchSprintButton.addEventListener('pointerleave', stopTouchSprint);

touchShoot.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  touchShoot.classList.add('active');
  beginCharge();
});
const releaseTouchShot = (): void => {
  touchShoot.classList.remove('active');
  if (!charging) return;
  charging = false;
  shootBall(Math.max(.38, shotCharge));
  shotCharge = 0;
};
touchShoot.addEventListener('pointerup', releaseTouchShot);
touchShoot.addEventListener('pointercancel', releaseTouchShot);
touchShoot.addEventListener('pointerleave', releaseTouchShot);
$('#touchPause').addEventListener('pointerdown', (event) => { event.preventDefault(); togglePause(); });
touchControls.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.repeat) { keys.add(event.code); return; }
  keys.add(event.code);
  if (event.code === 'Escape') togglePause();
  if (event.code === 'KeyQ' && phase === 'playing') switchPlayer();
  if (event.code === 'KeyE') passBall(true);
  if (event.code === 'KeyF') tackle();
  if (event.code === 'Space') beginCharge();
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'Space') releaseCharge();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < innerHeight ? 62 : 48;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.5 : 1.8));
});
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') togglePause(); });

$('#startButton').addEventListener('click', startMatch);
$('#restartButton').addEventListener('click', startMatch);
$('#pauseRestartButton').addEventListener('click', startMatch);
$('#resumeButton').addEventListener('click', togglePause);
musicButton.addEventListener('click', () => {
  soundtrack.muted = !soundtrack.muted;
  musicButton.textContent = soundtrack.muted ? 'MUSIC OFF' : 'MUSIC ON';
  if (!soundtrack.muted && phase !== 'menu') void soundtrack.play().catch(() => undefined);
});

setInterval(() => {
  if (charging) shotCharge = clamp(shotCharge + .035, 0, 1);
}, 35);

window.__worldStrike = {
  getState: () => ({
    phase,
    timeLeft,
    score: { ...score },
    possessor: possessor?.team ?? null,
    controlled: controlled.number,
    controlledPosition: { x: controlled.mesh.position.x, z: controlled.mesh.position.z },
    ballPosition: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
    penaltyRound,
  }),
  setTime: (seconds) => { timeLeft = clamp(seconds, 0, 180); },
  forceGoal: (team) => registerGoal(team),
  start: startMatch,
};

updateHud();
loop();
