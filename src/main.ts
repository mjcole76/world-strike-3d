import * as THREE from 'three';
import './style.css';
import {
  attackDirection, clamp, classifyRestart, detectGoal, DIFFICULTIES, formatClock, otherTeam,
  regulationResult, shootoutWinner, type Difficulty, type MatchPhase, type Restart, type Role, type Score, type Team,
} from './gameCore';
import { ROLE_SKILL, ROLE_SPEED, TEAMS, teamById, type TeamInfo } from './teams';
import { applyResult, createLeague, ordinal, simulateScore, sortTable, type LeagueState } from './league';
import { loadSave, saveData, type MatchMode } from './storage';
import * as audio from './audio';
import { applyKit, BALL_Y, buildPitch, buildStadium, createBall, createConfetti, createPlayerMesh, createTrail, FIELD_W, GOAL_W } from './world';
import { createRadar } from './radar';

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
  forceFreeKick: () => void;
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
const penaltyHint = $('#penaltyHint');
const soundtrack = $('#soundtrack') as HTMLAudioElement;
const musicButton = $('#musicButton') as HTMLButtonElement;
const touchControls = $('#touchControls');
const joystick = $('#joystick');
const joystickKnob = $('#joystickKnob');
const touchShoot = $('#touchShoot') as HTMLButtonElement;
const touchSprintButton = $('#touchSprint') as HTMLButtonElement;
const homeShort = $('#homeShort');
const awayShort = $('#awayShort');
const homeChip = $('#homeChip');
const awayChip = $('#awayChip');
const teamSelectNode = $('#teamSelect');
const teamTagline = $('#teamTagline');
const careerLine = $('#careerLine');
const startNote = $('#startNote');
const restartButton = $('#restartButton') as HTMLButtonElement;
const matchStatsNode = $('#matchStats');
const leagueBoxNode = $('#leagueBox');
const radarCanvas = $('#radar') as HTMLCanvasElement;
const radar = createRadar(radarCanvas);

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

const keys = new Set<string>();
const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
const temp = new THREE.Vector3();
let touchMoveX = 0;
let touchMoveZ = 0;
let touchSprint = false;
let joystickPointer: number | null = null;
let gamepadX = 0;
let gamepadZ = 0;
let gamepadSprint = false;
let padPrev: boolean[] = [];

let save = loadSave();
let homeInfo: TeamInfo = teamById(save.teamId);
let awayInfo: TeamInfo = TEAMS.find((t) => t.id !== homeInfo.id)!;
let difficulty: Difficulty = DIFFICULTIES[save.difficulty] ?? DIFFICULTIES.pro;
let matchLength = save.matchLength;
let mode: MatchMode = save.mode;
let cup: { round: number; opponents: string[] } | null = null;
let leagueState: LeagueState | null = null;
const ROUNDS = ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];

let phase: MatchPhase = 'menu';
let score: Score = { home: 0, away: 0 };
let timeLeft = matchLength;
let possessor: Footballer | null = null;
let trackedPossessor: Footballer | null = null;
let possessionTime = 0;
let controlled: Footballer;
let controlled2: Footballer | null = null;
let shotCharge = 0;
let charging = false;
let p2Charge = 0;
let p2Charging = false;
let messageTimer = 0;
let celebrationTimer = 0;
let shakeTimer = 0;
let kickoffTeam: Team = 'home';
let lastTouch: Team = 'home';
let lastKicker: Footballer | null = null;
let lastScorer: Team = 'home';
const celebrationFocus = new THREE.Vector3();
const freeKickSpot = new THREE.Vector3();
let crowdTick = 0;
let penaltyAim = 0;
let penaltyMode: 'shoot' | 'keep' = 'shoot';
let penaltyInFlight = false;
let penaltyTimer = 0;
let keepWindup = 1.4;
let homePens: boolean[] = [];
let awayPens: boolean[] = [];
let primaryAction: () => void = () => startMatch();

interface MatchStats {
  shots: Score; saves: Score; fouls: Score; cards: Score; corners: Score; possession: Score;
}
const emptyStats = (): MatchStats => ({
  shots: { home: 0, away: 0 }, saves: { home: 0, away: 0 }, fouls: { home: 0, away: 0 },
  cards: { home: 0, away: 0 }, corners: { home: 0, away: 0 }, possession: { home: 0, away: 0 },
});
let stats = emptyStats();

buildPitch(scene);
buildStadium(scene);
const confetti = createConfetti();
scene.add(confetti.points);
const trail = createTrail();
scene.add(trail.points);

const formation: Array<[Role, number, number, number]> = [
  ['GK', 1, 0, 47], ['DEF', 4, -13, 27], ['DEF', 5, 13, 27], ['MID', 8, -4, 8], ['ST', 10, 4, -8],
];
const players: Footballer[] = [];
let nextId = 0;
for (const team of ['home', 'away'] as Team[]) {
  const sign = team === 'home' ? 1 : -1;
  for (const [role, number, x, z] of formation) {
    const mesh = createPlayerMesh();
    mesh.position.set(team === 'home' ? x : -x, 0, z * sign);
    mesh.rotation.y = team === 'home' ? Math.PI : 0;
    scene.add(mesh);
    players.push({ id: nextId++, team, role, number, mesh, home: mesh.position.clone(), velocity: new THREE.Vector3(), stamina: 100, controlled: false, cooldown: 0, tackle: 0 });
  }
}
controlled = players.find((player) => player.team === 'home' && player.role === 'ST')!;
controlled.controlled = true;

const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.72, .9, 28), new THREE.MeshBasicMaterial({ color: 0xf5ca52, side: THREE.DoubleSide, transparent: true, opacity: .95 }));
selectionRing.rotation.x = -Math.PI / 2;
selectionRing.position.y = .05;
scene.add(selectionRing);
const selectionArrow = new THREE.Mesh(new THREE.ConeGeometry(.25, .55, 8), new THREE.MeshBasicMaterial({ color: 0xf5ca52 }));
scene.add(selectionArrow);
const selectionRing2 = new THREE.Mesh(new THREE.RingGeometry(.72, .9, 28), new THREE.MeshBasicMaterial({ color: 0xff5470, side: THREE.DoubleSide, transparent: true, opacity: .95 }));
selectionRing2.rotation.x = -Math.PI / 2;
selectionRing2.position.y = .05;
selectionRing2.visible = false;
scene.add(selectionRing2);

const ball = createBall();
scene.add(ball);
const ballVelocity = new THREE.Vector3();
ball.position.set(0, BALL_Y, 0);

const penaltyAimMarker = new THREE.Mesh(new THREE.RingGeometry(.48, .7, 20), new THREE.MeshBasicMaterial({ color: 0xf5ca52, side: THREE.DoubleSide }));
penaltyAimMarker.position.set(0, 1.3, -51.1);
penaltyAimMarker.visible = false;
scene.add(penaltyAimMarker);

function showMessage(text: string, duration = 1.7): void {
  matchMessage.textContent = text;
  matchMessage.classList.add('visible');
  messageTimer = duration;
}

function teamInfo(team: Team): TeamInfo {
  return team === 'home' ? homeInfo : awayInfo;
}

function playerPace(player: Footballer): number {
  return ROLE_SPEED[player.role] * teamInfo(player.team).speed;
}

function playerSkill(player: Footballer): number {
  return ROLE_SKILL[player.role] * teamInfo(player.team).skill;
}

function strengthOf(info: TeamInfo): number {
  return info.skill * .6 + info.speed * .4;
}

function applyTeamKits(): void {
  for (const player of players) {
    const info = teamInfo(player.team);
    if (player.role === 'GK') applyKit(player.mesh, info.keeperKit, 0x10131a);
    else applyKit(player.mesh, info.primary, info.secondary);
  }
  homeShort.textContent = homeInfo.short;
  awayShort.textContent = awayInfo.short;
  homeChip.style.background = homeInfo.css;
  awayChip.style.background = awayInfo.css;
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
  setControlled(players.find((player) => player.team === 'home' && player.role === 'ST')!);
  const kickoffPlayer = players.find((player) => player.team === team && player.role === 'MID')!;
  kickoffPlayer.mesh.position.set(team === 'home' ? -1.2 : 1.2, 0, team === 'home' ? 1 : -1);
  setTimeout(() => {
    if (phase === 'playing') {
      possessor = kickoffPlayer;
      showMessage('KICK OFF');
      audio.whistle();
    }
  }, 500);
}

function setControlled(player: Footballer): void {
  controlled.controlled = false;
  controlled = player;
  controlled.controlled = true;
}

function drawCupOpponents(): string[] {
  const pool = TEAMS.filter((t) => t.id !== homeInfo.id).map((t) => t.id);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function randomOpponent(): TeamInfo {
  const pool = TEAMS.filter((t) => t.id !== homeInfo.id);
  return pool[Math.floor(Math.random() * pool.length)];
}

function setLeagueOpponent(): void {
  if (!leagueState) return;
  const fixture = leagueState.rounds[leagueState.round].find((f) => f.home === homeInfo.id || f.away === homeInfo.id)!;
  awayInfo = teamById(fixture.home === homeInfo.id ? fixture.away : fixture.home);
}

function beginCampaign(): void {
  save = saveData({ teamId: homeInfo.id, difficulty: difficulty.id, mode, matchLength });
  cup = null;
  leagueState = null;
  if (mode === 'cup') {
    cup = { round: 0, opponents: drawCupOpponents() };
    awayInfo = teamById(cup.opponents[0]);
  } else if (mode === 'league') {
    let lg = save.league;
    if (!lg || lg.playerTeam !== homeInfo.id || lg.round >= lg.rounds.length) {
      lg = createLeague(TEAMS.map((t) => t.id), homeInfo.id);
    }
    leagueState = lg;
    save = saveData({ league: lg });
    setLeagueOpponent();
  } else {
    awayInfo = randomOpponent();
  }
  startMatch();
}

function startMatch(): void {
  score = { home: 0, away: 0 };
  stats = emptyStats();
  timeLeft = matchLength;
  homePens = [];
  awayPens = [];
  penaltyInFlight = false;
  touchMoveX = 0;
  touchMoveZ = 0;
  touchSprint = false;
  p2Charging = false;
  p2Charge = 0;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
  applyTeamKits();
  phase = 'playing';
  menu.classList.remove('visible');
  resultOverlay.classList.remove('visible');
  pauseMenu.classList.remove('visible');
  penaltyPanel.classList.remove('visible');
  penaltyAimMarker.visible = false;
  soundtrack.volume = .38;
  void soundtrack.play().catch(() => undefined);
  audio.ensureAudio();
  audio.startCrowd();
  resetPositions('home');
  controlled2 = mode === 'versus' ? players.find((p) => p.team === 'away' && p.role === 'ST')! : null;
  selectionRing2.visible = !!controlled2;
  if (cup) showMessage(`${ROUNDS[cup.round]} - ${awayInfo.name}`, 2.2);
  if (leagueState) showMessage(`ROUND ${leagueState.round + 1}/${leagueState.rounds.length} - ${awayInfo.name}`, 2.2);
  updateHud();
}

function returnToMenu(): void {
  phase = 'menu';
  cup = null;
  leagueState = null;
  controlled2 = null;
  selectionRing2.visible = false;
  penaltyInFlight = false;
  penaltyAimMarker.visible = false;
  resultOverlay.classList.remove('visible');
  pauseMenu.classList.remove('visible');
  penaltyPanel.classList.remove('visible');
  menu.classList.add('visible');
  audio.stopCrowd();
  soundtrack.volume = .22;
  resetPositions('home');
  refreshCareerLine();
  refreshStartNote();
  updateHud();
}

function closestPlayer(team: Team, position: THREE.Vector3, includeKeeper = true): Footballer {
  return players.filter((p) => p.team === team && (includeKeeper || p.role !== 'GK')).reduce((best, player) => player.mesh.position.distanceTo(position) < best.mesh.position.distanceTo(position) ? player : best);
}

function switchPlayer(): void {
  const target = closestPlayer('home', ball.position, false);
  setControlled(target);
  audio.sfx(660, .08, 'square', .018, 820);
}

function switchPlayer2(): void {
  if (!controlled2) return;
  controlled2 = closestPlayer('away', ball.position, false);
  audio.sfx(660, .08, 'square', .018, 820);
}

function kick(from: Footballer, target: THREE.Vector3, speed: number, lift: number): void {
  possessor = null;
  lastTouch = from.team;
  lastKicker = from;
  ball.position.copy(from.mesh.position).add(new THREE.Vector3(0, BALL_Y, attackDirection(from.team) * 1.2));
  const direction = target.clone().sub(ball.position);
  direction.y = 0;
  direction.normalize();
  ballVelocity.set(direction.x * speed, lift, direction.z * speed);
  from.cooldown = .35;
  audio.kickSound(clamp(speed / 48, 0, 1));
}

function bestPassTarget(from: Footballer, through = false): Footballer {
  const direction = attackDirection(from.team);
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

function passFrom(from: Footballer | null, through = false): void {
  if (!from || possessor !== from || phase !== 'playing') return;
  const targetPlayer = bestPassTarget(from, through);
  const lead = targetPlayer.velocity.clone().multiplyScalar(through ? .65 : .25);
  const target = targetPlayer.mesh.position.clone().add(lead);
  kick(from, target, through ? 27 : 20, through ? 1.1 : .45);
  if (from === controlled) showMessage(through ? 'THROUGH BALL' : 'PRECISION PASS', .8);
}

function shootFrom(from: Footballer | null, power: number): void {
  if (!from || possessor !== from) return;
  const direction = attackDirection(from.team);
  const goalZ = direction * 53;
  const movementBias = from.velocity.x * .065;
  const error = (Math.random() - .5) * (power > .92 ? 3.6 : 1.4) * (2 - playerSkill(from));
  const aimed = from === controlled && (phase === 'penalty' || phase === 'freekick');
  const targetX = aimed ? penaltyAim : clamp(movementBias + error, -7.6, 7.6);
  stats.shots[from.team] += 1;
  kick(from, new THREE.Vector3(targetX, 0, goalZ), 25 + power * 25, 2.8 + power * 4.4);
  if (phase === 'freekick') {
    penaltyAimMarker.visible = false;
    phase = 'playing';
    showMessage('FREE KICK STRIKE', .8);
  } else if (phase === 'penalty') {
    penaltyInFlight = true;
    penaltyTimer = 0;
  } else if (phase === 'playing' && from === controlled) {
    showMessage('POWER SHOT', .7);
  }
}

function lobFrom(from: Footballer | null): void {
  if (!from || possessor !== from || phase !== 'playing') return;
  const direction = attackDirection(from.team);
  const targetX = clamp(from.mesh.position.x * .4 + from.velocity.x * .1, -7, 7);
  stats.shots[from.team] += 1;
  kick(from, new THREE.Vector3(targetX, 0, direction * 52), 16.5, 7.2);
  if (from === controlled) showMessage('CHIP', .7);
}

function handleFoul(offender: Footballer, victim: Footballer): void {
  stats.fouls[offender.team] += 1;
  offender.tackle = .8;
  possessor = null;
  ballVelocity.set(0, 0, 0);
  audio.foulWhistle();
  audio.crowdOoh();
  const carded = Math.random() < .3;
  if (carded) stats.cards[offender.team] += 1;
  const attackingSpot = victim.team === 'home' && victim.mesh.position.z < -12;
  if (attackingSpot) {
    startFreeKick(victim, carded);
    return;
  }
  possessor = victim;
  victim.cooldown = 0;
  if (victim.team === 'home') setControlled(victim);
  showMessage(carded ? `FOUL - ${teamInfo(offender.team).short} YELLOW CARD` : 'FREE KICK', 1.2);
}

function startFreeKick(taker: Footballer, carded: boolean): void {
  phase = 'freekick';
  charging = false;
  shotCharge = 0;
  penaltyAim = 0;
  freeKickSpot.copy(taker.mesh.position);
  freeKickSpot.z = clamp(freeKickSpot.z, -34, -12);
  freeKickSpot.x = clamp(freeKickSpot.x, -24, 24);
  taker.mesh.position.set(freeKickSpot.x, 0, freeKickSpot.z + 2);
  taker.velocity.set(0, 0, 0);
  taker.mesh.rotation.y = Math.PI;
  ball.position.set(freeKickSpot.x, BALL_Y, freeKickSpot.z);
  ballVelocity.set(0, 0, 0);
  possessor = taker;
  setControlled(taker);
  penaltyAimMarker.visible = true;
  penaltyAimMarker.position.x = 0;
  const toGoal = new THREE.Vector3(-freeKickSpot.x, 0, -52 - freeKickSpot.z).normalize();
  const perp = new THREE.Vector3(-toGoal.z, 0, toGoal.x);
  const wall = players
    .filter((p) => p.team === 'away' && p.role !== 'GK')
    .sort((a, b) => a.mesh.position.distanceTo(freeKickSpot) - b.mesh.position.distanceTo(freeKickSpot))
    .slice(0, 2);
  wall.forEach((defender, i) => {
    defender.mesh.position.copy(freeKickSpot).addScaledVector(toGoal, 6).addScaledVector(perp, i === 0 ? .75 : -.75);
    defender.velocity.set(0, 0, 0);
    defender.mesh.rotation.y = Math.atan2(-toGoal.x, -toGoal.z) + Math.PI;
  });
  showMessage(carded ? 'YELLOW CARD - DIRECT FREE KICK' : 'DIRECT FREE KICK', 1.5);
}

function tackleFor(tackler: Footballer | null): void {
  if (!tackler || phase !== 'playing' || tackler.tackle > 0) return;
  tackler.tackle = .65;
  const enemyTeam = otherTeam(tackler.team);
  const enemy = players.filter((p) => p.team === enemyTeam).sort((a, b) => a.mesh.position.distanceTo(tackler.mesh.position) - b.mesh.position.distanceTo(tackler.mesh.position))[0];
  if (enemy && possessor === enemy && enemy.mesh.position.distanceTo(tackler.mesh.position) < 2.1) {
    if (Math.random() < .22) {
      handleFoul(tackler, enemy);
      return;
    }
    possessor = tackler;
    if (tackler === controlled || tackler === controlled2) showMessage('INTERCEPTION', .9);
    audio.sfx(150, .1, 'square', .04, 80);
  }
}

function updateControlled(dt: number): void {
  if (phase !== 'playing' && phase !== 'penalty' && phase !== 'freekick') return;
  const padX = controlled2 ? 0 : gamepadX;
  const padZ = controlled2 ? 0 : gamepadZ;
  let x = clamp(touchMoveX + padX, -1, 1);
  let z = clamp(touchMoveZ + padZ, -1, 1);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  x = clamp(x, -1, 1);
  z = clamp(z, -1, 1);

  if (phase === 'penalty' || phase === 'freekick') {
    if (phase === 'freekick' || penaltyMode === 'shoot') {
      penaltyAim = clamp(penaltyAim + x * dt * 7, -7.7, 7.7);
      penaltyAimMarker.position.x = penaltyAim;
      controlled.velocity.set(0, 0, 0);
    } else {
      controlled.mesh.position.x = clamp(controlled.mesh.position.x + x * dt * 11, -8.4, 8.4);
      controlled.mesh.position.z = -49.2;
      controlled.mesh.rotation.y = 0;
      controlled.velocity.set(x * 11, 0, 0);
    }
    return;
  }

  const moving = x !== 0 || z !== 0;
  const sprint = (keys.has('ShiftLeft') || touchSprint || (!controlled2 && gamepadSprint)) && moving && controlled.stamina > 1;
  const speed = (sprint ? 13 : 8.3) * playerPace(controlled);
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

function updateControlled2(dt: number): void {
  if (!controlled2 || phase !== 'playing') return;
  let x = clamp(gamepadX, -1, 1);
  let z = clamp(gamepadZ, -1, 1);
  const moving = x !== 0 || z !== 0;
  const sprint = gamepadSprint && moving && controlled2.stamina > 1;
  const speed = (sprint ? 13 : 8.3) * playerPace(controlled2);
  if (moving) {
    const length = Math.hypot(x, z);
    x /= length; z /= length;
    controlled2.velocity.set(x * speed, 0, z * speed);
    const nx = clamp(controlled2.mesh.position.x + controlled2.velocity.x * dt, -31.2, 31.2);
    const nz = clamp(controlled2.mesh.position.z + controlled2.velocity.z * dt, -50.8, 50.8);
    controlled2.mesh.position.set(nx, 0, nz);
    controlled2.mesh.rotation.y = Math.atan2(x, z);
  } else {
    controlled2.velocity.multiplyScalar(Math.pow(.04, dt));
  }
  controlled2.stamina = clamp(controlled2.stamina + (sprint ? -29 : 17) * dt, 0, 100);
}

function targetForAi(player: Footballer): THREE.Vector3 {
  const direction = attackDirection(player.team);
  const ownBall = possessor?.team === player.team;
  if (player.role === 'GK') {
    const ownGoal = player.team === 'home' ? 48 : -48;
    return new THREE.Vector3(clamp(ball.position.x * .46, -7, 7), 0, ownGoal);
  }
  const nearest = closestPlayer(player.team, ball.position, false) === player;
  if (!ownBall && nearest) return ball.position.clone();
  if (ownBall && possessor !== player) {
    if (player.role === 'ST') {
      const aheadZ = clamp(ball.position.z + direction * 16, -46, 46);
      return new THREE.Vector3(clamp(-ball.position.x * .5 + player.home.x * .7, -26, 26), 0, aheadZ);
    }
    if (player.role === 'MID') {
      const supportZ = clamp(ball.position.z + direction * 7, -44, 44);
      return new THREE.Vector3(clamp(ball.position.x * .4 + player.home.x * .5, -28, 28), 0, supportZ);
    }
    return player.home.clone().add(new THREE.Vector3(ball.position.x * .16, 0, direction * 8 + ball.position.z * .15));
  }
  const shift = ownBall ? direction * 9 : -direction * 3;
  const ballPull = new THREE.Vector3(ball.position.x * .16, 0, ball.position.z * .1);
  return player.home.clone().add(new THREE.Vector3(0, 0, shift)).add(ballPull);
}

function attemptSteal(player: Footballer, dt: number): void {
  if (!possessor || possessor.team === player.team || player.tackle > 0) return;
  if (possessionTime < .55 || possessor.cooldown > 0) return;
  if (player.mesh.position.distanceTo(possessor.mesh.position) > 1.7) return;
  const rate = player.team === 'away' ? difficulty.stealRate : .8;
  if (Math.random() >= rate * dt) return;
  if (Math.random() < .16) {
    handleFoul(player, possessor);
    return;
  }
  const victim = possessor;
  victim.cooldown = .9;
  player.tackle = .5;
  possessor = player;
  if (victim === controlled || victim === controlled2) showMessage('DISPOSSESSED', .8);
  if (player.team === 'home') setControlled(player);
  else if (controlled2) controlled2 = player;
  audio.sfx(150, .1, 'square', .04, 80);
}

function aiUseBall(player: Footballer): void {
  if (possessor !== player || player.cooldown > 0) return;
  const direction = attackDirection(player.team);
  if (player.role === 'GK') {
    if (possessionTime > .6) {
      const mate = bestPassTarget(player, false);
      kick(player, mate.mesh.position.clone(), 22, .8);
    }
    return;
  }
  const distanceToGoal = Math.abs(direction * 52 - player.mesh.position.z);
  const pressure = closestPlayer(otherTeam(player.team), player.mesh.position, false).mesh.position.distanceTo(player.mesh.position);
  if (distanceToGoal < 25) {
    const scatter = (player.team === 'away' ? difficulty.shotError : 5) * (2 - playerSkill(player));
    const target = new THREE.Vector3((Math.random() - .5) * scatter, 0, direction * 53);
    stats.shots[player.team] += 1;
    kick(player, target, 28 + Math.random() * 8, 2.5 + Math.random() * 2);
  } else if (pressure < 4.2 || Math.random() < .004) {
    const mate = bestPassTarget(player, true);
    kick(player, mate.mesh.position.clone().add(new THREE.Vector3(0, 0, direction * 3)), 20, .65);
  }
}

function updateAi(dt: number): void {
  if (phase !== 'playing') return;
  for (const player of players) {
    if (player === controlled || player === controlled2) continue;
    const target = targetForAi(player);
    temp.copy(target).sub(player.mesh.position); temp.y = 0;
    const distance = temp.length();
    const base = player.role === 'GK' ? 7.4 : player.team === 'away' ? difficulty.aiSpeed : 7.7;
    const speed = base * playerPace(player) * (possessor === player ? .93 : 1);
    if (distance > .45) {
      temp.normalize();
      player.velocity.copy(temp).multiplyScalar(speed);
      player.mesh.position.addScaledVector(player.velocity, dt);
      player.mesh.position.x = clamp(player.mesh.position.x, -31, 31);
      player.mesh.position.z = clamp(player.mesh.position.z, -50, 50);
      player.mesh.rotation.y = Math.atan2(player.velocity.x, player.velocity.z);
    } else player.velocity.multiplyScalar(.8);
    attemptSteal(player, dt);
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
  if (controlled2) selectionRing2.position.set(controlled2.mesh.position.x, .055, controlled2.mesh.position.z);
}

function acquireBall(): void {
  if (possessor || ball.position.y > 1.1 || ballVelocity.length() > 18) return;
  const nearest = players.filter((p) => p.cooldown <= 0 && p.mesh.visible).sort((a, b) => a.mesh.position.distanceTo(ball.position) - b.mesh.position.distanceTo(ball.position))[0];
  if (nearest && nearest.mesh.position.distanceTo(ball.position) < 1.5) {
    possessor = nearest;
    ballVelocity.set(0, 0, 0);
    if (nearest.team === 'home' && nearest !== controlled && phase === 'playing') setControlled(nearest);
    if (controlled2 && nearest.team === 'away' && nearest !== controlled2 && phase === 'playing') controlled2 = nearest;
  }
}

function goalkeeperSave(): boolean {
  if (ballVelocity.length() < 10) return false;
  const team: Team = ballVelocity.z < 0 ? 'away' : 'home';
  const keeper = players.find((p) => p.role === 'GK' && p.team === team);
  if (!keeper || !keeper.mesh.visible || keeper === controlled || keeper === controlled2) return false;
  const reach = team === 'away' ? difficulty.keeperReach : 1.7;
  if (keeper.mesh.position.distanceTo(ball.position) < reach && ball.position.y < 2.7) {
    possessor = keeper;
    ballVelocity.set(0, 0, 0);
    stats.saves[team] += 1;
    showMessage('GREAT SAVE');
    audio.sfx(190, .18, 'triangle', .05, 95);
    audio.crowdOoh();
    shakeTimer = Math.max(shakeTimer, .15);
    if (phase === 'penalty' && penaltyMode === 'shoot') resolveHomePenalty(false);
    return true;
  }
  return false;
}

function handleRestart(restart: Restart): void {
  const spot = new THREE.Vector3();
  if (restart.type === 'throw-in') spot.set(Math.sign(ball.position.x) * 31.2, 0, clamp(ball.position.z, -48, 48));
  else if (restart.type === 'corner') spot.set(Math.sign(ball.position.x || 1) * 29.5, 0, Math.sign(ball.position.z) * 49);
  else spot.set(0, 0, Math.sign(ball.position.z) * 45);
  if (restart.type === 'corner') stats.corners[restart.team] += 1;
  const receiver = restart.type === 'goal-kick'
    ? players.find((p) => p.team === restart.team && p.role === 'GK')!
    : closestPlayer(restart.team, spot, false);
  receiver.mesh.position.copy(spot);
  receiver.velocity.set(0, 0, 0);
  possessor = receiver;
  possessionTime = 0;
  lastTouch = restart.team;
  ballVelocity.set(0, 0, 0);
  ball.position.set(spot.x, BALL_Y, spot.z);
  if (restart.team === 'home' && restart.type !== 'goal-kick') setControlled(receiver);
  if (controlled2 && restart.team === 'away' && restart.type !== 'goal-kick') controlled2 = receiver;
  showMessage(restart.type === 'throw-in' ? 'THROW IN' : restart.type === 'corner' ? 'CORNER' : 'GOAL KICK', .9);
}

function updateBall(dt: number): void {
  if (possessor) {
    const direction = possessor.velocity.lengthSq() > .2 ? possessor.velocity.clone().normalize() : new THREE.Vector3(0, 0, attackDirection(possessor.team));
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

  const goal = detectGoal(ball.position.x, ball.position.y, ball.position.z, GOAL_W / 2, 51);
  if (goal) {
    if (phase === 'penalty') {
      if (penaltyMode === 'shoot') resolveHomePenalty(true);
      else resolveAwayPenalty(true);
    } else registerGoal(goal);
    return;
  }
  if (phase === 'playing') {
    const restart = classifyRestart(ball.position.x, ball.position.z, lastTouch, FIELD_W / 2, 52);
    if (restart) {
      handleRestart(restart);
      return;
    }
  }
  if (!goalkeeperSave()) acquireBall();
}

function registerGoal(team: Team): void {
  if (phase !== 'playing') return;
  score[team] += 1;
  lastScorer = team;
  phase = 'celebration';
  celebrationTimer = 3.1;
  shakeTimer = .5;
  possessor = null;
  ballVelocity.set(0, 0, 0);
  celebrationFocus.copy(lastKicker && lastKicker.team === team ? lastKicker.mesh.position : ball.position);
  const info = teamInfo(team);
  confetti.burst(celebrationFocus, [info.primary, 0xf5ca52, 0xffffff]);
  showMessage(`GOAL - ${info.short}`, 2.6);
  audio.netSwish();
  audio.sfx(90, .6, 'sawtooth', .055, 45);
  setTimeout(() => audio.sfx(330, .6, 'sine', .04, 660), 160);
  audio.crowdRoar(team === 'home' ? .2 : .13);
  updateHud();
}

function finishRegulation(): void {
  const result = regulationResult(score);
  if (result === 'penalty') {
    if (mode === 'league' || mode === 'versus') {
      finishMatch(null);
    } else {
      audio.whistle(true);
      startPenalties();
    }
  } else finishMatch(result);
}

function startPenalties(): void {
  phase = 'penalty';
  penaltyPanel.classList.add('visible');
  homePens = [];
  awayPens = [];
  showMessage('PENALTY SHOOTOUT', 2.4);
  setupPenaltyShoot();
}

function setupPenaltyShoot(): void {
  phase = 'penalty';
  penaltyMode = 'shoot';
  penaltyInFlight = false;
  penaltyTimer = 0;
  charging = false;
  shotCharge = 0;
  penaltyAim = 0;
  possessor = null;
  for (const player of players) player.mesh.visible = false;
  const shooter = players.find((p) => p.team === 'home' && p.role === 'ST')!;
  const keeper = players.find((p) => p.team === 'away' && p.role === 'GK')!;
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
  penaltyPanel.dataset.mode = 'shoot';
  penaltyHint.textContent = 'A/D AIM - HOLD SPACE FOR POWER';
  updatePenaltyHud();
  showMessage(`${homeInfo.short} KICK ${homePens.length + 1}`, 1.2);
}

function setupPenaltyKeep(): void {
  phase = 'penalty';
  penaltyMode = 'keep';
  penaltyInFlight = false;
  penaltyTimer = 0;
  charging = false;
  shotCharge = 0;
  keepWindup = 1.1 + Math.random() * .9;
  possessor = null;
  for (const player of players) player.mesh.visible = false;
  const shooter = players.find((p) => p.team === 'away' && p.role === 'ST')!;
  const keeper = players.find((p) => p.team === 'home' && p.role === 'GK')!;
  shooter.mesh.visible = true;
  keeper.mesh.visible = true;
  shooter.mesh.position.set(0, 0, -37.8);
  shooter.mesh.rotation.y = Math.PI;
  keeper.mesh.position.set(0, 0, -49.2);
  keeper.mesh.rotation.y = 0;
  setControlled(keeper);
  ball.position.set(0, BALL_Y, -40.7);
  ballVelocity.set(0, 0, 0);
  penaltyAimMarker.visible = false;
  penaltyPanel.dataset.mode = 'keep';
  penaltyHint.textContent = 'A/D MOVE YOUR KEEPER - MAKE THE SAVE';
  updatePenaltyHud();
  showMessage(`${awayInfo.short} KICK ${awayPens.length + 1} - DEFEND`, 1.4);
}

function resolveHomePenalty(scored: boolean): void {
  if (!penaltyInFlight) return;
  penaltyInFlight = false;
  homePens.push(scored);
  showMessage(scored ? 'PENALTY SCORED' : 'PENALTY MISSED', 1.25);
  audio.sfx(scored ? 520 : 145, .35, scored ? 'sine' : 'sawtooth', .04, scored ? 780 : 70);
  if (scored) {
    audio.netSwish();
    audio.crowdRoar(.16);
    confetti.burst(ball.position, [homeInfo.primary, 0xf5ca52, 0xffffff]);
  } else audio.crowdOoh();
  updatePenaltyHud();
  phase = 'celebration';
  const winner = shootoutWinner(homePens, awayPens);
  setTimeout(() => {
    if (phase !== 'celebration') return;
    if (winner) finishMatch(winner);
    else setupPenaltyKeep();
  }, 1400);
}

function resolveAwayPenalty(scored: boolean, label?: string): void {
  if (!penaltyInFlight) return;
  penaltyInFlight = false;
  awayPens.push(scored);
  showMessage(scored ? `${awayInfo.short} SCORES` : label ?? `${homeInfo.short} KEEPER SAVES`, 1.25);
  audio.sfx(scored ? 320 : 520, .35, scored ? 'sawtooth' : 'sine', .04, scored ? 120 : 780);
  if (!scored) audio.crowdRoar(.18);
  else audio.netSwish();
  ballVelocity.set(0, 0, 0);
  updatePenaltyHud();
  phase = 'celebration';
  const winner = shootoutWinner(homePens, awayPens);
  setTimeout(() => {
    if (phase !== 'celebration') return;
    if (winner) finishMatch(winner);
    else setupPenaltyShoot();
  }, 1400);
}

function updatePenaltyHud(): void {
  const width = Math.max(3, homePens.length, awayPens.length);
  const marks = (values: boolean[]): string => Array.from({ length: width }, (_, i) => i < values.length ? (values[i] ? '●' : '×') : '○').join(' ');
  penaltyScoreNode.textContent = `${homeInfo.short} ${marks(homePens)}   ${awayInfo.short} ${marks(awayPens)}`;
}

function refreshCareerLine(): void {
  careerLine.textContent = `CUPS ${save.cupsWon} - TITLES ${save.titles} - WINS ${save.wins}`;
}

function renderMatchStats(): void {
  const possessionTotal = stats.possession.home + stats.possession.away;
  const homePct = possessionTotal > 0 ? Math.round(stats.possession.home / possessionTotal * 100) : 50;
  const rows: Array<[string, number | string, number | string]> = [
    ['SHOTS', stats.shots.home, stats.shots.away],
    ['SAVES', stats.saves.home, stats.saves.away],
    ['POSSESSION', `${homePct}%`, `${100 - homePct}%`],
    ['FOULS', stats.fouls.home, stats.fouls.away],
    ['CARDS', stats.cards.home, stats.cards.away],
    ['CORNERS', stats.corners.home, stats.corners.away],
  ];
  matchStatsNode.innerHTML = rows.map(([label, h, a]) => `<div><span>${h}</span><b>${label}</b><span>${a}</span></div>`).join('');
}

function renderLeagueBox(): void {
  if (!leagueState) {
    leagueBoxNode.innerHTML = '';
    return;
  }
  const rows = sortTable(leagueState.table);
  const body = rows.map((row, i) => {
    const info = teamById(row.id);
    const me = row.id === homeInfo.id ? ' class="me"' : '';
    return `<tr${me}><td>${i + 1}</td><td>${info.short}</td><td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gf - row.ga}</td><td>${row.pts}</td></tr>`;
  }).join('');
  leagueBoxNode.innerHTML = `<table><thead><tr><th>#</th><th>CLUB</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>PTS</th></tr></thead><tbody>${body}</tbody></table>`;
}

function finishMatch(winner: Team | null): void {
  phase = 'finished';
  penaltyAimMarker.visible = false;
  penaltyPanel.classList.remove('visible');
  audio.stopCrowd();
  audio.whistle(true);
  const won = winner === 'home';
  const drew = winner === null;
  if (won) save = saveData({ wins: save.wins + 1 });
  const pensNote = homePens.length || awayPens.length ? ` (${homePens.filter(Boolean).length}-${awayPens.filter(Boolean).length} PENS)` : '';
  $('#finalScore').textContent = `${homeInfo.short} ${score.home} - ${score.away} ${awayInfo.short}${pensNote}`;
  renderMatchStats();

  const overline = $('#resultOverline');
  const title = $('#resultTitle');
  const detail = $('#resultDetail');

  if (leagueState) {
    const roundFixtures = leagueState.rounds[leagueState.round];
    const mine = roundFixtures.find((f) => f.home === homeInfo.id || f.away === homeInfo.id)!;
    const playerHome = mine.home === homeInfo.id;
    applyResult(leagueState.table, mine.home, mine.away, playerHome ? score.home : score.away, playerHome ? score.away : score.home);
    for (const fixture of roundFixtures) {
      if (fixture === mine) continue;
      const [hg, ag] = simulateScore(strengthOf(teamById(fixture.home)), strengthOf(teamById(fixture.away)));
      applyResult(leagueState.table, fixture.home, fixture.away, hg, ag);
    }
    leagueState.round += 1;
    const standings = sortTable(leagueState.table);
    const position = standings.findIndex((row) => row.id === homeInfo.id) + 1;
    const seasonOver = leagueState.round >= leagueState.rounds.length;
    if (seasonOver) {
      const champion = position === 1;
      if (champion) {
        save = saveData({ titles: save.titles + 1 });
        confetti.burst(new THREE.Vector3(0, 0, 0), [homeInfo.primary, 0xf5ca52, 0xffffff]);
        audio.crowdRoar(.22);
      }
      save = saveData({ league: null });
      overline.textContent = champion ? 'LEAGUE CHAMPIONS' : 'SEASON COMPLETE';
      title.innerHTML = champion ? `${homeInfo.name.replace('TEAM ', '')} RULES<br />THE LEAGUE` : `${ordinal(position)} PLACE<br />FINISH`;
      detail.textContent = champion ? 'Ten rounds. Top of the pile. A season to remember.' : `The season ends in ${ordinal(position).toLowerCase()} place. Go again.`;
      restartButton.textContent = 'NEW SEASON';
      primaryAction = beginCampaign;
      leagueState = null;
    } else {
      save = saveData({ league: leagueState });
      const nextFixture = leagueState.rounds[leagueState.round].find((f) => f.home === homeInfo.id || f.away === homeInfo.id)!;
      const nextOpponent = teamById(nextFixture.home === homeInfo.id ? nextFixture.away : nextFixture.home);
      overline.textContent = won ? 'LEAGUE WIN' : drew ? 'LEAGUE DRAW' : 'LEAGUE DEFEAT';
      title.innerHTML = `${ordinal(position)} AFTER<br />ROUND ${leagueState.round}`;
      detail.textContent = `Next: ${nextOpponent.name} - ${nextOpponent.nickname}.`;
      restartButton.textContent = `PLAY ROUND ${leagueState.round + 1}/${leagueState.rounds.length}`;
      primaryAction = () => {
        setLeagueOpponent();
        startMatch();
      };
    }
    renderLeagueBox();
  } else {
    renderLeagueBox();
    if (cup && won && cup.round < 2) {
      const nextRound = ROUNDS[cup.round + 1];
      const nextOpponent = teamById(cup.opponents[cup.round + 1]);
      overline.textContent = `${ROUNDS[cup.round]} WON`;
      title.innerHTML = `THROUGH TO<br />THE ${nextRound}`;
      detail.textContent = `Next up: ${nextOpponent.name} - ${nextOpponent.nickname}.`;
      restartButton.textContent = `PLAY ${nextRound}`;
      primaryAction = () => {
        cup!.round += 1;
        awayInfo = teamById(cup!.opponents[cup!.round]);
        startMatch();
      };
    } else if (cup && won) {
      save = saveData({ cupsWon: save.cupsWon + 1 });
      overline.textContent = 'WORLD CROWN CHAMPIONS';
      title.innerHTML = `${homeInfo.name.replace('TEAM ', '')} RULES<br />THE WORLD`;
      detail.textContent = 'Three rounds. One crown. A perfect cup run.';
      restartButton.textContent = 'RUN IT BACK';
      primaryAction = beginCampaign;
      confetti.burst(new THREE.Vector3(0, 0, 0), [homeInfo.primary, 0xf5ca52, 0xffffff]);
      audio.crowdRoar(.22);
    } else if (cup && !won) {
      overline.textContent = 'KNOCKED OUT';
      title.innerHTML = `${awayInfo.short} TAKES<br />THE TIE`;
      detail.textContent = `The cup run ends at the ${ROUNDS[cup.round].toLowerCase()}. Return stronger.`;
      restartButton.textContent = 'NEW CUP RUN';
      primaryAction = beginCampaign;
    } else if (drew) {
      overline.textContent = 'ALL SQUARE';
      title.innerHTML = 'HONOURS<br />SHARED';
      detail.textContent = 'Nothing to separate the sides at the final whistle.';
      restartButton.textContent = 'REMATCH';
      primaryAction = startMatch;
    } else if (won) {
      overline.textContent = mode === 'versus' ? 'PLAYER ONE WINS' : 'FRIENDLY WON';
      title.innerHTML = `${homeInfo.name.replace('TEAM ', '')} RULES<br />THE NIGHT`;
      detail.textContent = 'A championship performance under the lights.';
      restartButton.textContent = 'PLAY AGAIN';
      primaryAction = startMatch;
      audio.crowdRoar(.18);
    } else {
      overline.textContent = mode === 'versus' ? 'PLAYER TWO WINS' : 'FINAL WHISTLE';
      title.innerHTML = `${awayInfo.short} TAKES<br />THE NIGHT`;
      detail.textContent = `${awayInfo.nickname} held firm. Return stronger.`;
      restartButton.textContent = 'REMATCH';
      primaryAction = startMatch;
    }
  }
  refreshCareerLine();
  refreshStartNote();
  resultOverlay.classList.add('visible');
  soundtrack.volume = won ? .55 : .2;
  showMessage('FINAL WHISTLE', 2);
}

function updatePenalty(dt: number): void {
  if (phase !== 'penalty') return;
  if (penaltyMode === 'shoot') {
    if (!penaltyInFlight) return;
    penaltyTimer += dt;
    const keeper = players.find((p) => p.team === 'away' && p.role === 'GK')!;
    const saveTarget = clamp(penaltyAim + Math.sin(homePens.length * 5.7) * 2.8, -7.5, 7.5);
    keeper.mesh.position.x += clamp(saveTarget - keeper.mesh.position.x, -dt * difficulty.keeperTrack, dt * difficulty.keeperTrack);
    if (penaltyTimer > 3.4 || (ballVelocity.length() < 1 && ball.position.z < -42)) resolveHomePenalty(false);
    return;
  }
  penaltyTimer += dt;
  const keeper = controlled;
  const shooter = players.find((p) => p.team === 'away' && p.role === 'ST')!;
  if (!penaltyInFlight) {
    if (penaltyTimer >= keepWindup) {
      const accurate = Math.random() < difficulty.penAccuracy;
      const side = keeper.mesh.position.x >= 0 ? -1 : 1;
      const aimX = accurate ? side * (3.2 + Math.random() * 4) : (Math.random() - .5) * 19;
      kick(shooter, new THREE.Vector3(aimX, 0, -53), 26 + Math.random() * 6, 1.2 + Math.random() * 2.4);
      penaltyInFlight = true;
      penaltyTimer = 0;
    }
    return;
  }
  if (ball.position.z < -46.5 && ball.position.y < 2.9 && keeper.mesh.position.distanceTo(ball.position) < 1.8) {
    stats.saves.home += 1;
    resolveAwayPenalty(false, 'WHAT A SAVE');
    return;
  }
  if (penaltyTimer > 3 || ball.position.z < -54 || Math.abs(ball.position.x) > 32) resolveAwayPenalty(false, `${awayInfo.short} MISSES`);
}

function updateHud(): void {
  scoreNode.innerHTML = `${score.home}&nbsp;&nbsp;-&nbsp;&nbsp;${score.away}`;
  clockNode.textContent = formatClock(timeLeft);
  playerLabel.textContent = `#${controlled.number} ${controlled.role === 'ST' ? 'STRIKER' : controlled.role === 'MID' ? 'MIDFIELDER' : controlled.role === 'DEF' ? 'DEFENDER' : 'GOALKEEPER'}`;
  staminaBar.style.width = `${controlled.stamina}%`;
  possessionNode.textContent = possessor ? `${teamInfo(possessor.team).short} BALL` : 'LOOSE BALL';
  powerBar.style.width = `${shotCharge * 100}%`;
  powerWrap.classList.toggle('visible', charging);
  touchControls.classList.toggle('visible', phase === 'playing' || phase === 'penalty' || phase === 'freekick');
  radarCanvas.classList.toggle('visible', phase === 'playing');
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
  if (phase === 'freekick') {
    camera.position.lerp(new THREE.Vector3(freeKickSpot.x * .6 + 9, 8.5, freeKickSpot.z + 15), 1 - Math.pow(.02, dt));
    camera.lookAt(freeKickSpot.x * .3, 1.2, -46);
    return;
  }
  if (phase === 'celebration') {
    const t = (3.1 - celebrationTimer) * .85;
    temp.set(celebrationFocus.x + Math.cos(t) * 13, 6.2, celebrationFocus.z + Math.sin(t) * 13);
    camera.position.lerp(temp, 1 - Math.pow(.03, dt));
    camera.lookAt(celebrationFocus.x, 1.3, celebrationFocus.z);
    applyShake(dt);
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
  applyShake(dt);
}

function applyShake(dt: number): void {
  if (shakeTimer <= 0) return;
  shakeTimer = Math.max(0, shakeTimer - dt);
  camera.position.x += (Math.random() - .5) * shakeTimer * 1.7;
  camera.position.y += (Math.random() - .5) * shakeTimer * 1.2;
}

function update(dt: number): void {
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) matchMessage.classList.remove('visible');
  }
  if (possessor !== trackedPossessor) {
    trackedPossessor = possessor;
    possessionTime = 0;
  } else possessionTime += dt;
  if (charging && phase !== 'paused') shotCharge = clamp(shotCharge + dt, 0, 1);
  if (p2Charging && phase !== 'paused') p2Charge = clamp(p2Charge + dt, 0, 1);

  if (phase === 'playing') {
    timeLeft = Math.max(0, timeLeft - dt);
    if (possessor) stats.possession[possessor.team] += dt;
    updateControlled(dt);
    updateControlled2(dt);
    updateAi(dt);
    updateBall(dt);
    if (timeLeft <= 0) finishRegulation();
  } else if (phase === 'celebration') {
    celebrationTimer -= dt;
    updateBall(dt);
    if (celebrationTimer <= 0 && !homePens.length && !awayPens.length) {
      phase = 'playing';
      resetPositions(otherTeam(lastScorer));
    }
  } else if (phase === 'penalty') {
    updateControlled(dt);
    updateBall(dt);
    updatePenalty(dt);
  } else if (phase === 'freekick') {
    updateControlled(dt);
    updateBall(dt);
  }
  confetti.update(dt);
  trail.update(ball.position, !possessor && ballVelocity.length() > 17);

  if (phase === 'playing' || phase === 'celebration' || phase === 'penalty' || phase === 'freekick') {
    crowdTick += dt;
    if (crowdTick > .25) {
      crowdTick = 0;
      const proximity = clamp(1 - (52 - Math.abs(ball.position.z)) / 52, 0, 1);
      audio.setCrowdExcitement(phase === 'celebration' ? 1 : proximity * proximity);
    }
  }
  if (phase === 'playing') {
    radar.draw(
      players.map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z, team: p.team, controlled: p === controlled || p === controlled2 })),
      { x: ball.position.x, z: ball.position.z },
      homeInfo.css,
      awayInfo.css,
    );
  }
  animatePlayers(dt);
  updateCamera(dt);
  updateHud();
}

function pollGamepad(): void {
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  const pad = pads ? pads[0] : null;
  if (!pad) {
    gamepadX = 0; gamepadZ = 0; gamepadSprint = false;
    return;
  }
  const dead = (value: number | undefined): number => {
    const v = value ?? 0;
    return Math.abs(v) < .18 ? 0 : v;
  };
  gamepadX = dead(pad.axes[0]);
  gamepadZ = dead(pad.axes[1]);
  const pressed = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
  const edge = (i: number): boolean => pressed(i) && !padPrev[i];
  if (phase === 'menu') {
    if (edge(9) || edge(0)) beginCampaign();
  } else if (controlled2) {
    if (edge(0)) passFrom(controlled2);
    if (edge(1)) tackleFor(controlled2);
    if (edge(2) && possessor === controlled2 && !p2Charging && phase === 'playing') { p2Charging = true; p2Charge = 0; }
    if (!pressed(2) && padPrev[2] && p2Charging) {
      p2Charging = false;
      shootFrom(controlled2, Math.max(.3, p2Charge));
      p2Charge = 0;
    }
    if (edge(3) && phase === 'playing') switchPlayer2();
    if (edge(4)) lobFrom(controlled2);
    if (edge(5)) passFrom(controlled2, true);
    if (edge(9)) togglePause();
  } else {
    if (edge(0)) passFrom(controlled);
    if (edge(1)) tackleFor(controlled);
    if (edge(2)) beginCharge();
    if (!pressed(2) && padPrev[2]) releaseCharge();
    if (edge(3) && phase === 'playing') switchPlayer();
    if (edge(4)) lobFrom(controlled);
    if (edge(5)) passFrom(controlled, true);
    if (edge(9)) togglePause();
  }
  gamepadSprint = pressed(6) || pressed(7);
  padPrev = pad.buttons.map((b) => b.pressed);
}

function render(): void {
  renderer.render(scene, camera);
}

function loop(): void {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .04);
  pollGamepad();
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
  if (phase === 'penalty' && penaltyMode === 'keep') return;
  if ((phase === 'playing' || phase === 'penalty' || phase === 'freekick') && possessor === controlled && !charging) {
    charging = true;
    shotCharge = 0;
  }
}

function releaseCharge(): void {
  if (!charging) return;
  charging = false;
  if (phase === 'penalty' || phase === 'freekick' || shotCharge > .24) shootFrom(controlled, Math.max(.25, shotCharge));
  else passFrom(controlled, false);
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
bindTouchAction('#touchThrough', () => passFrom(controlled, true));
bindTouchAction('#touchLob', () => lobFrom(controlled));
bindTouchAction('#touchTackle', () => tackleFor(controlled));
bindTouchAction('#touchPass', () => passFrom(controlled, false));

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
  shootFrom(controlled, Math.max(.38, shotCharge));
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
  if (event.code === 'KeyE') passFrom(controlled, true);
  if (event.code === 'KeyC') lobFrom(controlled);
  if (event.code === 'KeyF') tackleFor(controlled);
  if (event.code === 'Space') beginCharge();
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'Space') releaseCharge();
});
window.addEventListener('blur', () => {
  keys.clear();
  touchSprint = false;
  gamepadSprint = false;
  if (charging) {
    charging = false;
    shotCharge = 0;
  }
  if (p2Charging) {
    p2Charging = false;
    p2Charge = 0;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < innerHeight ? 62 : 48;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.5 : 1.8));
});
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') togglePause(); });

function wirePills(container: HTMLElement, initial: string, onChange: (value: string) => void): void {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
  const select = (value: string): void => {
    for (const button of buttons) button.classList.toggle('selected', button.dataset.value === value);
  };
  select(initial);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      select(button.dataset.value!);
      onChange(button.dataset.value!);
    });
  }
}

function refreshStartNote(): void {
  if (mode === 'cup') {
    startNote.textContent = 'THREE ROUNDS TO GLORY';
  } else if (mode === 'league') {
    const lg = save.league;
    const resumable = lg && lg.playerTeam === homeInfo.id && lg.round < lg.rounds.length;
    startNote.textContent = resumable ? `RESUME SEASON - ROUND ${lg.round + 1}/${lg.rounds.length}` : 'NEW SEASON - 10 ROUNDS';
  } else if (mode === 'versus') {
    startNote.textContent = 'P1 KEYBOARD VS P2 GAMEPAD';
  } else {
    startNote.textContent = `${Math.round(matchLength / 60)} MINUTE MATCH`;
  }
}

function buildTeamSelect(): void {
  teamSelectNode.innerHTML = '';
  for (const team of TEAMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `team-chip${team.id === homeInfo.id ? ' selected' : ''}`;
    button.style.setProperty('--chip', team.css);
    button.title = `${team.name} - ${team.nickname}`;
    button.innerHTML = `<i>${team.crest}</i><span>${team.short}</span>`;
    button.addEventListener('click', () => {
      homeInfo = team;
      save = saveData({ teamId: team.id });
      teamTagline.textContent = `${team.name} - ${team.nickname}`;
      for (const chip of Array.from(teamSelectNode.children)) chip.classList.toggle('selected', chip === button);
      refreshStartNote();
    });
    teamSelectNode.appendChild(button);
  }
  teamTagline.textContent = `${homeInfo.name} - ${homeInfo.nickname}`;
}

buildTeamSelect();
wirePills($('#modeSelect'), mode, (value) => {
  mode = value as MatchMode;
  save = saveData({ mode });
  refreshStartNote();
});
wirePills($('#difficultySelect'), difficulty.id, (value) => {
  difficulty = DIFFICULTIES[value as keyof typeof DIFFICULTIES];
  save = saveData({ difficulty: difficulty.id });
});
wirePills($('#lengthSelect'), String(matchLength), (value) => {
  matchLength = Number(value);
  save = saveData({ matchLength });
  refreshStartNote();
});
refreshStartNote();
refreshCareerLine();

$('#startButton').addEventListener('click', beginCampaign);
restartButton.addEventListener('click', () => primaryAction());
$('#menuButton').addEventListener('click', returnToMenu);
$('#pauseRestartButton').addEventListener('click', startMatch);
$('#pauseExitButton').addEventListener('click', returnToMenu);
$('#resumeButton').addEventListener('click', togglePause);

soundtrack.muted = save.muted;
musicButton.textContent = save.muted ? 'MUSIC OFF' : 'MUSIC ON';
musicButton.addEventListener('click', () => {
  soundtrack.muted = !soundtrack.muted;
  save = saveData({ muted: soundtrack.muted });
  musicButton.textContent = soundtrack.muted ? 'MUSIC OFF' : 'MUSIC ON';
  if (!soundtrack.muted && phase !== 'menu') void soundtrack.play().catch(() => undefined);
});

window.__worldStrike = {
  getState: () => ({
    phase,
    timeLeft,
    score: { ...score },
    possessor: possessor?.team ?? null,
    controlled: controlled.number,
    p2: controlled2?.number ?? null,
    controlledPosition: { x: controlled.mesh.position.x, z: controlled.mesh.position.z },
    ballPosition: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
    penaltyRound: Math.max(homePens.length, awayPens.length),
    difficulty: difficulty.id,
    mode,
    teams: { home: homeInfo.id, away: awayInfo.id },
    cupRound: cup?.round ?? null,
    leagueRound: leagueState?.round ?? null,
    stats: { shots: { ...stats.shots }, fouls: { ...stats.fouls }, saves: { ...stats.saves } },
  }),
  setTime: (seconds) => { timeLeft = clamp(seconds, 0, matchLength); },
  forceGoal: (team) => registerGoal(team),
  forceFreeKick: () => {
    if (phase !== 'playing') return;
    controlled.mesh.position.set(4, 0, -24);
    startFreeKick(controlled, false);
  },
  start: startMatch,
};

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

applyTeamKits();
updateHud();
loop();
