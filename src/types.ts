export type Mood =
  | 'happy'
  | 'chill'
  | 'focus'
  | 'sad'
  | 'energetic'
  | 'romantic'
  | 'sleepy';

export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'night';

export type LyricLine = { time: number; text: string };

export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover: string;     // image url or data uri
  src?: string;      // audio url, optional (demo mode)
  duration: number;  // seconds
  tags: string[];    // e.g. ['chill','lofi','sunny']
  region?: string;   // 'CN' | 'US' | 'JP' | 'KR' | 'EU' | 'LA' ...
  lyrics?: LyricLine[];
  // 远程音源（网易云等），本地曲库不填
  source?: 'local' | 'netease' | 'qq';
  sourceId?: number;
  vip?: boolean;
};

export type Playlist = {
  id: string;
  name: string;
  description?: string;
  cover?: string;
  trackIds: string[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  text: string;
  pickedTrackId?: string;
};
