// 心情-音乐风格映射表
export const MOOD_MAPPINGS = {
  happy: {
    genres: ['pop', 'dance', 'electronic', 'funk', 'disco', 'indie pop'],
    energyRange: [6, 10],
    valenceRange: [6, 10],
    tags: ['uplifting', 'bright', 'energetic', 'feel-good'],
  },
  sad: {
    genres: ['folk', 'acoustic', 'piano ballad', 'indie', 'classical', 'ambient'],
    energyRange: [1, 4],
    valenceRange: [1, 4],
    tags: ['melancholic', 'slow tempo', 'emotional', 'reflective'],
  },
  calm: {
    genres: ['ambient', 'classical', 'jazz', 'lo-fi', 'new age', 'chillout'],
    energyRange: [1, 5],
    valenceRange: [4, 7],
    tags: ['peaceful', 'relaxing', 'mellow', 'atmospheric'],
  },
  anxious: {
    genres: ['ambient', 'classical', 'nature sounds', 'meditation', 'lo-fi'],
    energyRange: [1, 3],
    valenceRange: [3, 6],
    tags: ['calming', 'soothing', 'gentle', 'healing'],
  },
  nostalgic: {
    genres: ['oldies', 'classic rock', 'folk', 'jazz', 'soul', 'r&b'],
    energyRange: [3, 6],
    valenceRange: [4, 7],
    tags: ['retro', 'vintage', 'warm', 'memory'],
  },
  romantic: {
    genres: ['r&b', 'jazz', 'soul', 'acoustic', 'pop ballad', 'bossa nova'],
    energyRange: [2, 5],
    valenceRange: [5, 8],
    tags: ['intimate', 'warm', 'soft', 'dreamy'],
  },
  focused: {
    genres: ['lo-fi', 'classical', 'ambient', 'electronic', 'post-rock', 'minimal'],
    energyRange: [2, 5],
    valenceRange: [4, 6],
    tags: ['concentration', 'steady', 'instrumental', 'minimal vocals'],
  },
  energetic: {
    genres: ['rock', 'edm', 'hip-hop', 'pop', 'metal', 'drum and bass'],
    energyRange: [7, 10],
    valenceRange: [5, 10],
    tags: ['powerful', 'intense', 'driving', 'motivational'],
  },
  lonely: {
    genres: ['indie', 'folk', 'acoustic', 'ambient', 'post-rock'],
    energyRange: [1, 4],
    valenceRange: [2, 5],
    tags: ['solitude', 'introspective', 'atmospheric', 'emotional'],
  },
  stressed: {
    genres: ['ambient', 'classical', 'nature sounds', 'meditation', 'lo-fi'],
    energyRange: [1, 3],
    valenceRange: [3, 6],
    tags: ['relaxing', 'calming', 'healing', 'peaceful'],
  },
};

// 心情关键词映射（用于识别用户输入）
export const MOOD_KEYWORDS = {
  happy: ['开心', '快乐', '高兴', '幸福', '愉快', '兴奋', 'joy', 'happy', 'great', 'amazing'],
  sad: ['难过', '伤心', '悲伤', '失落', '沮丧', 'sad', 'unhappy', 'down', 'depressed', '心情不好'],
  calm: ['平静', '安宁', '放松', '轻松', '惬意', 'calm', 'peaceful', 'relaxed', 'chill'],
  anxious: ['焦虑', '紧张', '不安', '担心', '烦躁', 'anxious', 'nervous', 'worried', 'stress'],
  nostalgic: ['怀念', '回忆', '想念', 'nostalgic', 'miss', 'memories', 'old times'],
  romantic: ['浪漫', '甜蜜', '恋爱', 'romantic', 'love', 'in love'],
  focused: ['专注', '集中', '工作', '学习', 'focus', 'concentration', 'work', 'study'],
  energetic: ['精力充沛', '活力', '运动', 'energetic', 'workout', 'pumped', 'motivated'],
  lonely: ['孤独', '寂寞', '一个人', 'lonely', 'alone', 'solitude', 'isolated'],
  stressed: ['压力', '压力大', '累', '疲惫', 'stressed', 'pressure', 'tired', 'exhausted'],
};

// 心情文本识别函数
export function detectMood(text) {
  if (!text) return 'calm';
  const lowerText = text.toLowerCase();
  const scores = {};

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    scores[mood] = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[mood] += 1;
      }
    }
  }

  // 返回得分最高的心情
  let detectedMood = 'calm';
  let maxScore = 0;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedMood = mood;
    }
  }

  return detectedMood;
}
