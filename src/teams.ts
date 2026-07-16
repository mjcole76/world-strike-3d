import type { Role } from './gameCore';

/** Per-role pace multipliers so strikers feel quicker than defenders. */
export const ROLE_SPEED: Record<Role, number> = { GK: .94, DEF: .97, MID: 1.01, ST: 1.07 };
/** Per-role finishing/passing quality multipliers. */
export const ROLE_SKILL: Record<Role, number> = { GK: .9, DEF: .95, MID: 1.05, ST: 1.08 };

export interface TeamInfo {
  id: string;
  name: string;
  short: string;
  nickname: string;
  crest: string;
  primary: number;
  secondary: number;
  keeperKit: number;
  css: string;
  /** Run-speed multiplier applied to the whole squad. */
  speed: number;
  /** Passing/finishing quality multiplier (1 = neutral). */
  skill: number;
}

export const TEAMS: TeamInfo[] = [
  { id: 'aurora', name: 'TEAM AURORA', short: 'AUR', nickname: 'THE NORTHERN LIGHT', crest: 'A', primary: 0x1763ff, secondary: 0xf7fbff, keeperKit: 0xf5ca52, css: '#1763ff', speed: 1, skill: 1 },
  { id: 'atlas', name: 'TEAM ATLAS', short: 'ATL', nickname: 'THE CRIMSON WALL', crest: 'T', primary: 0xd92045, secondary: 0x242632, keeperKit: 0x44d59a, css: '#d92045', speed: .97, skill: 1.04 },
  { id: 'solaris', name: 'TEAM SOLARIS', short: 'SOL', nickname: 'THE GOLDEN STORM', crest: 'S', primary: 0xf5a623, secondary: 0x221605, keeperKit: 0x9c6cff, css: '#f5a623', speed: 1.06, skill: .94 },
  { id: 'verdant', name: 'TEAM VERDANT', short: 'VER', nickname: 'THE EMERALD TIDE', crest: 'V', primary: 0x18a85c, secondary: 0xeafff3, keeperKit: 0xff7a33, css: '#18a85c', speed: .95, skill: 1.06 },
  { id: 'tempest', name: 'TEAM TEMPEST', short: 'TMP', nickname: 'THE VIOLET SURGE', crest: 'M', primary: 0x8b46ff, secondary: 0xf1e9ff, keeperKit: 0x2ee6d6, css: '#8b46ff', speed: 1.03, skill: .98 },
  { id: 'ironclad', name: 'TEAM IRONCLAD', short: 'IRC', nickname: 'THE STEEL GUARD', crest: 'I', primary: 0x5d6b7d, secondary: 0xff8a3d, keeperKit: 0xffd23e, css: '#7d8ea3', speed: .93, skill: 1.1 },
];

export function teamById(id: string): TeamInfo {
  return TEAMS.find((team) => team.id === id) ?? TEAMS[0];
}
