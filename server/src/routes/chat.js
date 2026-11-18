// AI聊天API路由
import { Router } from 'express';
import axios from 'axios';
import { callDeepSeekHelper } from '../utils/deepseekHelper.js';
import { callGeminiHelper } from '../utils/geminiHelper.js';

const router = Router();

/**
 * POST /api/chat
 * AI聊天对话
 */
router.post('/', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: { message: '消息不能为空' },
      });
    }

    // 如果LLM已启用，调用LLM
    if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== 'disabled') {
      const llmReply = await callLLMForChat(message, context);
      if (llmReply) {
        return res.json({
          success: true,
          reply: llmReply,
          type: 'ai',
        });
      }
    }

    // 本地回复（降级方案）
    const localReply = generateLocalReply(message);
    res.json({
      success: true,
      reply: localReply,
      type: 'local',
    });
  } catch (error) {
    console.error('聊天API错误:', error);
    res.status(500).json({
      success: false,
      error: { message: '聊天服务暂时不可用' },
    });
  }
});

/**
 * 调用DeepSeek进行聊天：.env里配了key就直连，否则经由vault key helper（本机）
 */
async function callDeepSeekChat(prompt) {
  const messages = [
    { role: 'system', content: '你是一个AI音乐电台DJ助手，友好、有个性、热爱音乐。' },
    { role: 'user', content: prompt },
  ];
  if (process.env.DEEPSEEK_API_KEY) {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages,
        temperature: 0.8,
        max_tokens: 200,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        timeout: 5000,
      }
    );
    return response.data.choices[0].message.content;
  }
  return callDeepSeekHelper({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages,
    temperature: 0.8,
    maxTokens: 200,
  });
}

/**
 * 调用Gemini进行聊天：.env里配了key就直连，否则经由vault key helper（本机）
 */
async function callGeminiChat(prompt) {
  const messages = [
    { role: 'system', content: '你是一个AI音乐电台DJ助手，友好、有个性、热爱音乐。' },
    { role: 'user', content: prompt },
  ];
  if (process.env.GEMINI_API_KEY) {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        messages,
        temperature: 0.8,
        max_tokens: 200,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        },
        timeout: 5000,
      }
    );
    return response.data.choices[0].message.content;
  }
  return callGeminiHelper({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    messages,
    temperature: 0.8,
    maxTokens: 200,
  });
}

/**
 * 调用LLM进行聊天
 */
async function callLLMForChat(message, context) {
  try {
    const prompt = `你是一个AI音乐电台DJ助手。你的任务是：
1. 友好地与用户聊天，像真正的DJ一样有个性
2. 推荐适合用户心情的音乐
3. 分享音乐相关的知识或趣闻
4. 回话要简洁、温暖、有感染力

用户消息：${message}
${context ? `上下文：${context}` : ''}

请用简短而有趣的方式回复（不超过100字）。`;

    let response;
    if (process.env.LLM_PROVIDER === 'openai') {
      response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: '你是一个AI音乐电台DJ助手，友好、有个性、热爱音乐。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 200,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          timeout: 5000,
        }
      );
      return response.data.choices[0].message.content;
    } else if (process.env.LLM_PROVIDER === 'deepseek') {
      return callDeepSeekChat(prompt);
    } else if (process.env.LLM_PROVIDER === 'gemini') {
      return callGeminiChat(prompt);
    } else if (process.env.LLM_PROVIDER === 'claude') {
      response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
          max_tokens: 200,
          system: '你是一个AI音乐电台DJ助手，友好、有个性、热爱音乐。',
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': process.env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          timeout: 5000,
        }
      );
      return response.data.content[0].text;
    }
  } catch (error) {
    console.warn('LLM聊天调用失败:', error.message);
    return null;
  }
  return null;
}

/**
 * 生成本地回复（降级方案）
 */
function generateLocalReply(message) {
  const lowerMsg = message.toLowerCase();

  // 基于关键词的简单回复
  if (lowerMsg.includes('推荐') || lowerMsg.includes('recommend')) {
    return '让我为你推荐一些好听的音乐吧！告诉我你现在的心情如何？😊';
  }

  if (lowerMsg.includes('心情') || lowerMsg.includes('mood')) {
    return '音乐是心情的良药。无论你现在感受如何，都有适合的歌曲。你想听什么类型的音乐？';
  }

  if (lowerMsg.includes('天气') || lowerMsg.includes('weather')) {
    return '不同的天气配不同的音乐最有感觉了！今天你那里天气如何？';
  }

  if (lowerMsg.includes('你好') || lowerMsg.includes('hi') || lowerMsg.includes('hello')) {
    return '你好！欢迎来到Aurora Music！今天想听什么样的音乐呢？🎵';
  }

  if (lowerMsg.includes('谢谢') || lowerMsg.includes('thanks')) {
    return '不客气！音乐就是最好的陪伴。享受你的音乐时光吧！✨';
  }

  // 默认回复
  const defaultReplies = [
    '音乐世界里有无数的宝藏等着你去发现！告诉我你喜欢什么，我来帮你找。',
    '每一首歌都有一个故事。你今天想听什么样的故事呢？',
    '音乐是最好的心情调节器。你现在感觉如何？我来为你推荐合适的歌曲。',
  ];

  return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
}

export { router as chatRouter };
