# World Strike 3D

Pick one of six fictional clubs and fight through cinematic 5v5 matches in Crown Arena - a one-off friendly, a local 2-player versus match, a three-round Crown Cup run, or a full 10-round league season with a live standings table.

## Play

- **WASD / Arrow keys** - move
- **Shift** - sprint
- **Space tap** - precision pass
- **Space hold and release** - power shot
- **E** - through ball
- **C** - chip / lob over the keeper
- **F** - standing tackle
- **Q** - switch player
- **Escape** - pause
- **M / music button** - music control

### Gamepad

- Left stick - move / aim
- **A** pass, **B** tackle, **X** hold to shoot, **Y** switch
- **LB** chip, **RB** through ball, **RT/LT** sprint, **Start** pause

### Mobile

- Left virtual joystick - move, aim penalties, dive as keeper
- Blue Pass button - immediate grounded pass
- Gold Shoot button - always shoots; hold for more power
- Switch, Through, Chip, Tackle and Sprint touch buttons
- Dedicated pause button
- Portrait and landscape layouts with safe-area support
- Installable as a PWA (offline-capable via a service worker)

## Match format

- 5v5 arcade matches (2, 3 or 5 minutes) with AI teammates and opponents
- Four modes: **Friendly**, **2P Versus** (keyboard vs gamepad, draws allowed), **Crown Cup** (three knockout rounds) and **League** (10-round double round-robin season with simulated rival fixtures and a persistent standings table)
- Three difficulty tiers (Easy / Pro / Legend) that scale AI speed, tackling pressure, keeper reach and finishing
- Opponents can dispossess you - protect the ball
- Fouls, yellow cards and direct free kicks: get fouled in the attacking third and you take an aimed, charged set piece over a defensive wall
- Smarter AI: strikers make forward runs beyond the ball, midfielders offer support angles
- Per-role player stats - strikers are quicker, midfielders pass better, defenders are steadier
- Throw-ins, corners and goal kicks when the ball leaves play
- Goal celebrations with a camera orbit, confetti, crowd roar, net swish and camera shake; reactive crowd ambience all match; kick sounds scale with power
- Ball trail on powerful strikes
- Full-time match stats: shots, saves, possession, fouls, cards, corners
- Best-of-three penalty shootout after a draw (cup/friendly), with sudden death - you take your kicks **and** play as the keeper for theirs
- Radar minimap so you can find teammates for through balls
- Team choice, mode, difficulty, match length, music setting, league season and career record (cups, titles, match wins) persist in localStorage

## Original score

`public/audio/world-crown-anthem.mp3` was generated specifically for the game with Treblo v3. The downloaded MP3 ships with the game, so playback does not depend on an expiring CDN URL.

## Development

```bash
npm install
npm run dev
```

Verification:

```bash
npm test
npm run lint
npm run build
```

## Technology

- Three.js
- TypeScript
- Vite
- WebGL
- Web Audio API (SFX, crowd ambience, roars)
- Gamepad API
- PWA (web app manifest + service worker)
- Treblo v3 original music

The teams, competition, stadium, crests and presentation are fictional. No real tournament branding or player likenesses are used.
