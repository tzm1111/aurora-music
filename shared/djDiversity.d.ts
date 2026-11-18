export type SongIdentity = { id?: string; title: string; artist?: string; preview?: boolean };
export function songKey(track: SongIdentity): string;
export function artistKeys(track: SongIdentity): string[];
export function dedupeSongs<T extends SongIdentity>(tracks: T[], excludedTracks?: SongIdentity[]): T[];
export function selectDiverseTracks<T extends SongIdentity>(tracks: T[], options?: { limit?: number; recentTracks?: SongIdentity[]; maxPerArtist?: number }): T[];
