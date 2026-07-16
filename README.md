# World Strike 3D

Pick one of six fictional clubs and fight through cinematic 5v5 matches in Crown Arena - as a one-off friendly or a three-round Crown Cup run (quarter-final, semi-final, final).

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
- Three difficulty tiers (Easy / Pro / Legend) that scale AI speed, tackling pressure, keeper reach and finishing
- Opponents can dispossess you - protect the ball
- Throw-ins, corners and goal kicks when the ball leaves play
- Goal celebrations with a camera orbit, confetti and crowd roar; reactive crowd ambience all match
- Best-of-three penalty shootout after a draw, with sudden death - you take your kicks **and** play as the keeper for theirs
- Radar minimap so you can find teammates for through balls
- Team choice, mode, difficulty, match length, music setting and career record (cups and match wins) persist in localStorage

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
