// Gemini调用桥：通过Python helper走保险库里的key（custom.gemini）。
// key本身不在任何文件里；helper向authd要一个surrogate，出口处再换成真key。
import { execFile } from 'node:child_process';

const HELPER = '/home/hatch/workspace/custom-connectors/custom.gemini/bin/gemini_chat.py';

export function callGeminiHelper({ model, messages, temperature, maxTokens }) {
  return new Promise((resolve) => {
    const child = execFile('python3', [HELPER], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.warn('Gemini helper调用失败:', error.message, stdout ? `stdout: ${stdout.slice(0, 200)}` : '', stderr ? `stderr: ${stderr.slice(0, 200)}` : '');
        return resolve(null);
      }
      try {
        const data = JSON.parse(stdout);
        if (data.error) {
          console.warn('Gemini API错误:', data.error);
          return resolve(null);
        }
        resolve(data.choices?.[0]?.message?.content || null);
      } catch (e) {
        console.warn('Gemini helper返回解析失败:', e.message);
        resolve(null);
      }
    });
    child.stdin.write(
      JSON.stringify({ model, messages, temperature, max_tokens: maxTokens })
    );
    child.stdin.end();
  });
}
