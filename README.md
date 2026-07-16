# World Strike 3D

Lead Team Aurora through a cinematic 5v5 championship final against Team Atlas in Crown Arena.

## Play

- **WASD / Arrow keys** - move
- **Shift** - sprint
- **Space tap** - precision pass
- **Space hold and release** - power shot
- **E** - through ball
- **F** - standing tackle
- **Q** - switch player
- **Escape** - pause
- **M / music button** - music control

### Mobile

- Left virtual joystick - move and aim penalties
- Blue Pass button - immediate grounded pass
- Gold Shoot button - always shoots; hold for more power
- Switch, Through, Tackle and Sprint touch buttons
- Dedicated pause button
- Portrait and landscape layouts with safe-area support

## Match format

- Three-minute 5v5 arcade final
- AI teammates and opponents
- Goalkeepers, tackling, possession, passing, shooting and stamina
- Direct best-of-three penalty shootout after a tied match
- Victory, defeat, pause and restart loops

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
- Web Audio API
- Treblo v3 original music

The teams, competition, stadium, crests and presentation are fictional. No real tournament branding or player likenesses are used.
