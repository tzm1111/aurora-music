export type ContextSnapshot = {
  date: string; weekday: number; hour: number;
  weather: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'night' | null;
  temperatureBand: 'cold' | 'mild' | 'hot' | null;
};
export type ContextMix = {
  context: ContextSnapshot; key: string; timeLabel: string; title: string; name: string;
  profile: 'ambient' | 'bright' | 'piano' | 'chill' | 'warm';
  queries: string[]; instrumental: boolean; description: string;
};
export function buildContextMix(input: ContextSnapshot | null | undefined): ContextMix | null;
