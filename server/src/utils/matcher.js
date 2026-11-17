// 音乐匹配算法 - 基于标签、心情、能量评分

/**
 * 计算歌曲匹配分数
 * @param {Object} track - 歌曲数据
 * @param {Object} target - 目标参数 { genres, tags, mood, energy, valence }
 * @param {Object} userHistory - 用户历史记录（可选）
 * @returns {Object} { score, reasons }
 */
export function calculateMatchScore(track, target, userHistory = {}) {
  const reasons = [];
  let totalScore = 0;

  // 1. 流派匹配 (30%)
  const genreScore = calculateGenreMatch(track.genres, target.genres);
  totalScore += genreScore * 0.30;
  if (genreScore > 0.5) {
    reasons.push(`流派匹配: ${getMatchingGenres(track.genres, target.genres)}`);
  }

  // 2. 标签匹配 (25%)
  const tagScore = calculateTagMatch(track.tags, target.tags);
  totalScore += tagScore * 0.25;
  if (tagScore > 0.3) {
    reasons.push(`标签匹配: ${getMatchingTags(track.tags, target.tags)}`);
  }

  // 3. 心情匹配 (20%)
  const moodScore = calculateMoodMatch(track.mood, target.mood);
  totalScore += moodScore * 0.20;
  if (moodScore > 0) {
    reasons.push('心情匹配');
  }

  // 4. 能量匹配 (10%)
  const energyScore = calculateEnergyMatch(track.energy, target.energy);
  totalScore += energyScore * 0.10;

  // 5. 情感价匹配 (5%)
  const valenceScore = 1 - Math.abs(track.valence - (target.valence || 5)) / 10;
  totalScore += valenceScore * 0.05;

  // 6. 用户历史加分 (10%)
  const historyScore = calculateHistoryBoost(track, userHistory);
  totalScore += historyScore * 0.10;
  if (historyScore > 0.5) {
    reasons.push('基于你的听歌喜好');
  }

  return {
    score: Math.min(Math.max(totalScore, 0), 1), // 限制在0-1之间
    reasons,
  };
}

function calculateGenreMatch(trackGenres, targetGenres) {
  if (!targetGenres || targetGenres.length === 0) return 0.5;
  const matching = trackGenres.filter(g =>
    targetGenres.some(tg => g.toLowerCase().includes(tg.toLowerCase()) || tg.toLowerCase().includes(g.toLowerCase()))
  );
  return matching.length / Math.max(trackGenres.length, targetGenres.length);
}

function getMatchingGenres(trackGenres, targetGenres) {
  return trackGenres.filter(g =>
    targetGenres.some(tg => g.toLowerCase().includes(tg.toLowerCase()))
  ).join(', ');
}

function calculateTagMatch(trackTags, targetTags) {
  if (!targetTags || targetTags.length === 0) return 0.5;
  const matching = trackTags.filter(t => targetTags.includes(t));
  return matching.length / Math.max(trackTags.length, targetTags.length);
}

function getMatchingTags(trackTags, targetTags) {
  return trackTags.filter(t => targetTags.includes(t)).join(', ');
}

function calculateMoodMatch(trackMoods, targetMood) {
  if (!targetMood) return 0.5;
  if (!trackMoods) return 0;
  return trackMoods.includes(targetMood) ? 1 : 0;
}

function calculateEnergyMatch(trackEnergy, targetEnergy) {
  if (!targetEnergy) return 0.5;
  return 1 - Math.abs(trackEnergy - targetEnergy) / 10;
}

function calculateHistoryBoost(track, userHistory) {
  if (!userHistory || !userHistory.playedTracks) return 0;

  // 听过的艺术家加分
  if (userHistory.favoriteArtists?.includes(track.artist)) {
    return 0.8;
  }

  // 听过的歌曲加分
  const playedTrack = userHistory.playedTracks.find(t => t.trackId === track.id);
  if (playedTrack) {
    if (playedTrack.playCount > 3 && playedTrack.skipRate < 0.2) {
      return 0.6;
    }
    return 0.3;
  }

  // 喜欢的流派加分
  if (userHistory.favoriteGenres) {
    const genreOverlap = track.genres.filter(g => userHistory.favoriteGenres.includes(g));
    if (genreOverlap.length > 0) {
      return 0.4;
    }
  }

  return 0;
}

/**
 * 从音乐库中匹配和排序歌曲
 * @param {Array} library - 音乐库
 * @param {Object} target - 目标参数
 * @param {Object} options - 选项 { count, userHistory, excludeIds }
 * @returns {Array} 匹配的歌曲列表
 */
export function matchAndRankTracks(library, target, options = {}) {
  const { count = 8, userHistory = {}, excludeIds = [] } = options;

  // 过滤排除的歌曲
  const filteredLibrary = library.filter(track => !excludeIds.includes(track.id));

  // 计算每首歌的分数
  const scoredTracks = filteredLibrary.map(track => {
    const { score, reasons } = calculateMatchScore(track, target, userHistory);
    return {
      ...track,
      matchScore: Math.round(score * 100) / 100,
      matchReasons: reasons,
    };
  });

  // 按分数降序排序
  scoredTracks.sort((a, b) => b.matchScore - a.matchScore);

  // 返回Top N
  return scoredTracks.slice(0, count);
}
