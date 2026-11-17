// LLM调用服务 - 支持OpenAI和Claude
import axios from 'axios';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'disabled';

/**
 * 调用LLM获取音乐推荐
 * @param {string} mood - 心情描述
 * @param {string} weather - 天气类型
 * @param {string} scene - 场景描述
 * @returns {Object|null} LLM推荐结果或null
 */
export async function callLLM(mood, weather, scene) {
  if (LLM_PROVIDER === 'disabled') {
    return null;
  }

  try {
    const prompt = buildLLMPrompt(mood, weather, scene);

    let response;
    if (LLM_PROVIDER === 'openai') {
      response = await callOpenAI(prompt);
    } else if (LLM_PROVIDER === 'claude') {
      response = await callClaude(prompt);
    } else {
      console.warn(`未知的LLM提供商: ${LLM_PROVIDER}`);
      return null;
    }

    // 解析LLM返回的JSON
    return parseLLMResponse(response);
  } catch (error) {
    console.error('LLM调用失败:', error.message);
    return null;
  }
}

/**
 * 构建LLM Prompt
 */
function buildLLMPrompt(mood, weather, scene) {
  return `你是一个专业的音乐推荐AI。请根据用户的心情、天气和场景描述，推荐合适的音乐。

用户描述：
- 心情：${mood || '未指定'}
- 天气：${weather || '未指定'}
- 场景：${scene || '未指定'}

请分析用户的情绪状态，并返回以下JSON格式的结果（不要返回其他任何内容）：

{
  "context": {
    "mood": "检测到的主要情绪",
    "weather": "天气类型",
    "scene": "场景描述"
  },
  "djIntro": "一句DJ风格的开场白，温暖而有感染力",
  "tracks": [
    {
      "title": "歌曲名",
      "artist": "艺术家",
      "album": "专辑名",
      "duration": 180,
      "genres": ["流派1", "流派2"],
      "tags": ["标签1", "标签2"],
      "matchScore": 0.85,
      "matchReasons": ["推荐理由1", "推荐理由2"],
      "coverUrl": "https://picsum.photos/seed/example/300/300"
    }
  ]
}

请推荐5-8首歌曲，确保推荐理由具体且有感染力。`;
}

/**
 * 调用OpenAI API
 */
async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY未配置');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的音乐推荐AI助手。你擅长根据用户的心情和场景推荐合适的音乐。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 8000,
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * 调用Claude API
 */
async function callClaude(prompt) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY未配置');
  }

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 1500,
      system: '你是一个专业的音乐推荐AI助手。你擅长根据用户的心情和场景推荐合适的音乐。',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 8000,
    }
  );

  return response.data.content[0].text;
}

/**
 * 解析LLM返回的响应
 */
function parseLLMResponse(text) {
  try {
    // 尝试直接解析
    const json = JSON.parse(text);
    return validateLLMResponse(json);
  } catch {
    try {
      // 尝试从markdown代码块中提取
      const match = text.match(/```json\s*\n([\s\S]*?)\n```/);
      if (match) {
        const json = JSON.parse(match[1]);
        return validateLLMResponse(json);
      }

      // 尝试从文本中提取JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        return validateLLMResponse(json);
      }
    } catch (parseError) {
      console.error('JSON解析失败:', parseError.message);
    }
  }

  return null;
}

/**
 * 验证LLM返回的数据结构
 */
function validateLLMResponse(data) {
  if (!data || !data.tracks || !Array.isArray(data.tracks)) {
    return null;
  }

  // 为每首歌曲添加默认值
  data.tracks = data.tracks.map((track, index) => ({
    id: `llm_${index}`,
    title: track.title || '未知歌曲',
    artist: track.artist || '未知艺术家',
    album: track.album || '',
    duration: track.duration || 180,
    genres: track.genres || [],
    tags: track.tags || [],
    matchScore: track.matchScore || 0.7,
    matchReasons: track.matchReasons || ['AI推荐'],
    coverUrl: track.coverUrl || `https://picsum.photos/seed/${index}/300/300`,
  }));

  return data;
}
