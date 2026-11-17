// 天气-音乐风格映射表
export const WEATHER_MAPPINGS = {
  sunny: {
    tags: ['bright', 'uplifting', 'warm', 'cheerful'],
    genreBoost: ['pop', 'indie pop', 'reggae', 'surf rock', 'tropical house'],
    moodModulation: { energy: 0.15, valence: 0.1 },
  },
  rainy: {
    tags: ['melancholic', 'cozy', 'rain ambience', 'introspective'],
    genreBoost: ['folk', 'jazz', 'lo-fi', 'piano', 'acoustic'],
    moodModulation: { energy: -0.1, valence: -0.15 },
  },
  cloudy: {
    tags: ['mellow', 'reflective', 'atmospheric', 'dreamy'],
    genreBoost: ['indie', 'alternative', 'dream pop', 'shoegaze'],
    moodModulation: { energy: -0.05, valence: -0.05 },
  },
  snowy: {
    tags: ['peaceful', 'cold atmosphere', 'ethereal', 'serene'],
    genreBoost: ['ambient', 'classical', 'post-rock', 'neo-classical'],
    moodModulation: { energy: -0.15, valence: 0.05 },
  },
  stormy: {
    tags: ['intense', 'dramatic', 'powerful', 'cinematic'],
    genreBoost: ['rock', 'metal', 'cinematic', 'orchestral', 'industrial'],
    moodModulation: { energy: 0.2, valence: -0.1 },
  },
  windy: {
    tags: ['breezy', 'free', 'flowing', 'airy'],
    genreBoost: ['folk', 'indie', 'acoustic', 'world music'],
    moodModulation: { energy: 0.05, valence: 0.05 },
  },
  hot: {
    tags: ['fiery', 'intense', 'tropical', 'vibrant'],
    genreBoost: ['latin', 'reggaeton', 'tropical', 'edm'],
    moodModulation: { energy: 0.1, valence: 0.1 },
  },
  cold: {
    tags: ['warm', 'cozy', 'comforting', 'intimate'],
    genreBoost: ['jazz', 'soul', 'r&b', 'acoustic', 'folk'],
    moodModulation: { energy: -0.05, valence: 0.05 },
  },
};

// 天气模拟数据（当API不可用时使用）
export function getMockWeather() {
  const weathers = ['sunny', 'cloudy', 'rainy'];
  const randomIndex = Math.floor(Math.random() * weathers.length);
  return {
    type: weathers[randomIndex],
    temperature: Math.floor(Math.random() * 15) + 15, // 15-30°C
    description: {
      sunny: '晴天',
      cloudy: '多云',
      rainy: '小雨',
    }[weathers[randomIndex]],
    location: '本地',
  };
}
