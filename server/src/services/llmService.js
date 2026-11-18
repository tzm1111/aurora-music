// LLM调用服务 - 支持OpenAI、DeepSeek、Gemini和Claude
import axios from 'axios';
import { callDeepSeekHelper } from '../utils/deepseekHelper.js';
import { callGeminiHelper } from '../utils/geminiHelper.js';

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
    } else if (LLM_PROVIDER === 'deepseek') {
      response = await callDeepSeek(prompt);
    } else if (LLM_PROVIDER === 'gemini') {
      response = await callGemini(prompt);
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
 * 调用OpenAI兼容接口（OpenAI / DeepSeek共用）
 */
async function callOpenAICompatible(prompt, { baseUrl, apiKey, model }) {
  if (!apiKey) {
    throw new Error('API key未配置');
  }

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
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
 * 调用OpenAI API
 */
async function callOpenAI(prompt) {
  return callOpenAICompatible(prompt, {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  });
}

/**
 * 调用DeepSeek API：.env里配了key就直连，否则经由vault key helper（本机）
 */
async function callDeepSeek(prompt) {
  const messages = [
    {
      role: 'system',
      content: '你是一个专业的音乐推荐AI助手。你擅长根据用户的心情和场景推荐合适的音乐。',
    },
    {
      role: 'user',
      content: prompt,
    },
  ];
  if (process.env.DEEPSEEK_API_KEY) {
    return callOpenAICompatible(prompt, {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    });
  }
  return callDeepSeekHelper({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages,
    temperature: 0.7,
    maxTokens: 1500,
  });
}

/**
 * 调用Gemini API：.env里配了key就直连，否则经由vault key helper（本机）
 */
async function callGemini(prompt) {
  const messages = [
    {
      role: 'system',
      content: '你是一个专业的音乐推荐AI助手。你擅长根据用户的心情和场景推荐合适的音乐。',
    },
    {
      role: 'user',
      content: prompt,
    },
  ];
  if (process.env.GEMINI_API_KEY) {
    return callOpenAICompatible(prompt, {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    });
  }
  return callGeminiHelper({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    messages,
    temperature: 0.7,
    maxTokens: 1500,
  });
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

// DJ 使用结构化选歌计划，歌曲 ID 与可播权限始终由音乐接口核验。
export function djModelStatus(settings) {
  const configured = {
    openai: Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_')),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    claude: Boolean(process.env.CLAUDE_API_KEY && !process.env.CLAUDE_API_KEY.startsWith('your_')),
  };
  const provider = settings?.provider || process.env.LLM_PROVIDER || Object.keys(configured).find(key => configured[key]) || 'disabled';
  return { provider, available: Boolean(settings?.apiKey || configured[provider]) };
}
export async function callDJPlan(description, previous, settings) {
  const status = djModelStatus(settings);
  if (!status.available) return null;
  const prompt = `你是用户的私人音乐DJ。理解心情、场景、歌手偏好和否定约束，为连续播放生成选歌计划。不要闲聊或要求用户搜索。用户说更安静、换一批时，要在上次偏好基础上调整。
用户：${description}
上次意图：${JSON.stringify(previous || {})}
只返回JSON：{"label":"最多8字的中文场景名","intro":"不超过50字，说明这段音乐的氛围","queries":["用于音乐搜索的具体歌曲名+歌手或歌手/风格，1到3项"],"excludeTerms":["应排除的版本或歌手"],"instrumental":false}。
不要编造歌曲ID、链接或可播放权限。专注与助眠优先纯音乐，尊重不要Live、不要某歌手等限制。`;
  try {
    const providers = {
      openai: { url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' },
      deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' },
      gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
      claude: { url: 'https://api.anthropic.com/v1/messages', key: process.env.CLAUDE_API_KEY, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514' },
    };
    const config = providers[status.provider];
    if (!config) return null;
    const key = settings?.apiKey || config.key;
    const response = await axios.post(config.url, { model: settings?.model || config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 700 }, {
      headers: status.provider === 'claude' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${key}` }, timeout: 8000,
    });
    const text = status.provider === 'claude' ? response.data.content?.[0]?.text : response.data.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
    const queries = parsed.queries?.filter(query => typeof query === 'string' && query.trim()).slice(0, 3).map(query => query.slice(0, 100));
    if (!queries?.length) return null;
    return { label: String(parsed.label || '此刻的音乐').slice(0, 16), intro: String(parsed.intro || '让音乐陪你一会儿。').slice(0, 100),
      queries, excludeTerms: Array.isArray(parsed.excludeTerms) ? parsed.excludeTerms.filter(t => typeof t === 'string').slice(0, 8).map(t => t.slice(0, 50)) : [], instrumental: parsed.instrumental === true };
  } catch { return null; }
}
