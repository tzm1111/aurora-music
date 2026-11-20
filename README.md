# Aurora Music · 极光音乐

一个本地运行的专属 DJ 播放器：说一句当前心情，或点选场景，即可开始听歌。DJ 自动准备后续曲目，让用户少搜歌、多听歌；首页以极简深色界面和动态光球呈现。

## 功能

- **心情即开听**：一句话或放松、专注、提神、入睡快捷入口，先检查真实可播放音源，再自动开播
- **专属 DJ 续播**：接近队列末尾时补充歌曲，排除最近推荐；播放中调整心情保留当前曲目与进度，更新后续队列
- **作品去重与歌手分散**：合并同名作品的不同专辑、Live、Demo、重制与翻唱版本，优先完整音源与原版本；扩大场景歌手候选，优先每位歌手一首，不足时最多两首，不靠重复作品凑满。换一批、续播和再次推荐会排除近期作品；明确指定歌手时保留该偏好。已有 DJ 歌单展示与重播也应用去重
- **DJ 推荐歌单**：首页展示当前与待播曲目，点击查看完整列表；每次成功推荐自动保存为有名称的历史歌单，首页“DJ 歌单”入口可查看与重播，最近 50 张保存在当前浏览器
- **DJ 陪伴界面**：点击光球说话，拖动心情坐标选择轻柔 / 动感与沉静 / 明亮；光球随聆听、选歌和播放状态反馈，外侧三条倾斜行星轨道以不同周期运行。开始听后展示当前歌曲与后续推荐，手机端自动收紧陪伴区。后台与减少动态效果设置会暂停轨道动画
- **语音输入**：点击 DJ 光球或语音入口，说出心情，识别文字后可编辑再发送。使用浏览器语音识别服务，需麦克风权限、浏览器支持与可用网络；不支持时显示提示，可继续打字
- **当地天气与出行提示**：顶部独立状态条轮播天气、降雨与空气质量，点击展开小型位置面板；授权定位或手动选择城市 / 区县，查看出行建议。Open-Meteo 提供预报与 CAMS 空气数据，天气连接失败时使用 MET Norway 备用预报；AQI 明确采用 US AQI 口径。精确定位不保存，查询坐标取整到约 1 公里，空气数据缺失时明确提示
- **真实模型连接**：界面连接 OpenAI、DeepSeek、Gemini 或 Claude；未连接或请求失败时明确标注场景推荐
- **网易云扫码登录**：使用网易云 App 扫码确认，按账号与版权权限获取音源，优先完整歌曲并标注试听
- **网易云音源**：搜索歌名 / 歌手 / 专辑，直接播放真实音频（后端代理流式传输，支持拖动进度条）
- **本地合成音源**：无网络时仍可播放内置曲目，音频由 Web Audio API 实时合成
- **播放器**：底部紧凑悬浮播放条支持喜欢，点开是全屏 Now Playing（圆形封面 + 实时频谱环 + 波形进度条），封面色驱动全场 mesh 渐变背景，换歌 1.2 秒平滑过渡；频谱按实际画布尺寸绘制，展开动画与高分屏下保持完整
- **发现页**：径向频谱、粒子、滚动歌词，支持全屏沉浸
- **封面取色**：从当前封面提取主色调，驱动全场 mesh 渐变背景与强调色
- **文字歌单 / MP3 / LRC 导入**

快捷键：`Space` 播放暂停 · `←/→` 切歌 · `↑/↓` 音量 · `F` 沉浸 · `D` 切换首页/发现 · `Esc` 退出沉浸

## 技术栈

React 19 · TypeScript · Zustand · Vite 8 · Express 5 · NeteaseCloudMusicApi

## 目录结构

```
aurora-music/
├── src/                    # 前端
│   ├── components/         # DJHome / AccountDialog / ModelDialog / MiniBar / NowPlaying / Sidebar / AudioEngine
│   ├── store/usePlayer.ts  # 全局播放状态
│   ├── lib/                # 合成音频、推荐算法、取色、歌词、可视化
│   └── services/api.ts     # 后端请求封装
├── server/                 # Express API（3001）
│   └── src/
│       ├── routes/         # dj / account / recommend / music / weather / chat / audio
│       └── services/       # 推荐引擎、LLM、网易云适配、音频合成
├── music-api/              # 本地 NeteaseCloudMusicApi（3100）
└── screenshots/
```

## 快速开始

需要符合 Vite 8 要求的 Node.js（20.19+ 或 22.12+，建议使用近期 LTS 版本）。

```bash
# 1. 安装依赖
npm install
npm --prefix server install
npm --prefix music-api install

# 2. 配置环境变量
cp server/.env.example server/.env

# 3. 一次启动前端、后端与音乐 API
npm run dev:all

# 或分别启动三个服务（各开一个终端）
npm run music-api   # 网易云 API，端口 3100
npm run server      # 后端 API，端口 3001
npm run dev         # 前端，端口 5173（/api 已代理到 3001）
```

打开 http://localhost:5173 。

### 可选配置

| 变量 | 说明 |
| --- | --- |
| `NETEASE_COOKIE` | 可选的服务端默认账号凭据；日常使用建议通过界面扫码连接自己的账号 |
| `LLM_PROVIDER` / `OPENAI_API_KEY` / `CLAUDE_API_KEY` / `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` | 可选的服务端模型配置；也可在界面连接模型。未配置时使用场景规则推荐，实际费用以服务商为准 |

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/dj/status` | 当前会话模型连接状态 |
| POST | `/api/dj/model` | 验证模型连接并保存在后端会话内存 |
| POST | `/api/dj/session` | 按心情生成、调整或补充已检查音源的队列 |
| GET | `/api/account/status` | 网易云连接状态与公开资料 |
| POST | `/api/account/qr` | 生成当前会话登录二维码 |
| POST | `/api/account/check` | 检查扫码结果 |
| POST | `/api/account/logout` | 清除会话内的网易云凭据 |
| GET | `/api/music/providers` | 各音源可用状态 |
| GET | `/api/music/search?source=local\|netease&q=` | 搜索 |
| GET | `/api/music/stream/netease/:id` | 音频流代理（支持 Range） |
| GET | `/api/audio/:trackId` | 本地合成音频（WAV） |
| GET | `/api/recommend` | 基于心情/天气的推荐 |
| GET | `/api/weather/cities?q=` | 搜索城市供用户选择 |
| POST | `/api/weather` | 根据位置查询天气、空气质量与出行建议 |
| POST | `/api/chat` | AI 对话 |

## 已知限制

- 网易云音源取决于账号订阅、版权与第三方接口。匿名或无权限账号可能只能试听或无法播放；登录不保证所有 VIP 歌曲可完整播放，也不绕过平台权限。
- 网易云凭据和界面输入的模型 Key 只保存在后端会话内存，使用 HttpOnly 会话 Cookie 绑定浏览器；后端重启或会话超过 24 小时需要重新连接。生产环境 Cookie 同时开启 Secure，采用 HTTPS 同源访问；单实例运行以保持会话一致。
- 未连接真实模型时使用场景规则；模型异常时自动降级并在界面显示。外部音源或网络异常可能影响续播，界面提供重试提示。
- QQ 音乐仅保留了 provider 占位，尚未接入。
- 项目仅供学习与个人使用，音源来自第三方开源接口，请遵守相关平台的服务条款。

## 截图

![网易云搜索与播放](screenshots/netease-search.png)

## 日常使用优化

- 收藏、可编辑歌单、播放队列（拖动或上下移动）、随机播放、列表/单曲循环。
- 搜索支持加载更多；文字歌单先搜索真实歌曲，再选择版本确认导入。
- 音量、当前曲目与进度、队列、收藏、歌单和歌词保存到当前浏览器；重新打开时暂停待续播。
- 导入的音频文件保存在 IndexedDB；浏览器清理站点数据后需要重新导入。
- 加载、缓冲和失败状态明确显示；失败可重试或换一首；支持的浏览器可用系统媒体键。
- 手动搜索、收藏、歌单与本地导入放在导航中，首页专注于心情输入和自动播放。

验证命令：`npm test` 检查队列、循环、收藏、恢复、DJ 过滤、会话隔离与续播控制；`npm run build` 与 `npm run lint` 检查构建和代码规范。

## Render 在线部署

仓库包含 `Dockerfile` 和 `render.yaml`。在 Render 的 **New → Blueprint** 选择本仓库，按配置创建 `aurora-music` 服务即可。容器内只公开播放器网页与 Express API，网易云接口在 `127.0.0.1:3100` 内部运行，不对公网开放。Render 提供 HTTPS 与 `onrender.com` 域名；首页、账号连接和 AI DJ 使用同一个地址。

- 默认选择 Free 实例，未配置共享模型 Key；可以在播放器里连接自己的模型，也可以在 Render 环境变量中配置服务端模型。
- Free 实例会在闲置后休眠，首次打开可能需要等待启动。会话默认保存 30 天，持续使用时续期。跨容器重建保留连接需要配置固定的 `AURORA_SESSION_SECRET`（64 位十六进制随机值）；常驻服务未配置时自动使用本机密钥文件。
- `APP_ORIGIN` 可选：使用自定义域名时填入完整 HTTPS 来源，例如 `https://music.example.com`；默认读取 Render 的 `RENDER_EXTERNAL_URL`。
- 网易云音源在不同地区的可用性仍需上线后验证，取决于接口网络、账号权限和版权。
- 不要把本地 `.env` 上传到仓库或镜像；Docker 构建已排除环境文件。

本地生产验证：`npm run test:deployment`。完整生产启动：先安装三处依赖并构建网页，再执行 `NODE_ENV=production HOST=127.0.0.1 npm start`；需确保内部端口 3100 未被其他进程使用。

## 魔搭创空间 Docker 部署

魔搭创空间提供免费 CPU 资源，Docker SDK 需要绑定已实名的阿里云账号。创建编程式空间时选择 Docker SDK 和免费 CPU 资源，把 `deploy/modelscope/Dockerfile` 上传为空间根目录的 `Dockerfile`，再在设置中点击上线。

该部署文件从公开 GitHub 仓库下载固定的已验证提交，构建完整网页与后端，监听魔搭要求的 `0.0.0.0:7860`；内部音乐接口使用 3100 端口，不占用平台保留的 8080 端口。后续升级需要更新文件中的提交编号并重新上线。参考文档：https://modelscope.cn/docs/studios/docker 。

### GitHub Pages + Vercel

GitHub Pages 部署完整播放器前端，Vercel Hobby 运行 `api/index.js` 中的 Express 后端。音乐 API 通过 npm 模块直接调用，无需常驻第二个进程。Vercel 设置 `PLAYER_ORIGINS=https://tzm1111.github.io`，并配置仅在服务器保存的 `AURORA_SESSION_SECRET`（64 位十六进制随机值）。GitHub 仓库变量 `AURORA_API_URL` 填入实际 Vercel HTTPS 域名，Pages 使用 GitHub Actions 发布。

连接状态使用服务器加密会话凭证，前端在 localStorage 保存加密凭证，兼容同源与跨站部署，并迁移旧标签页中的会话。网易云 Cookie 和模型 Key 不明文写入浏览器。关闭浏览器后可恢复连接，退出网易云与清除模型连接分别处理。会话到期、后端密钥变更、清除浏览器数据或网易云授权失效后需要重新连接。

魔搭、Render 等托管环境应通过私密环境变量配置固定的 `AURORA_SESSION_SECRET`，以便休眠唤醒和重新部署后解密原有连接。密钥不能写入公开 Dockerfile。未配置时使用服务账号目录下的 `.aurora-music/session.key`，可以跨进程重启恢复，但容器磁盘重建会丢失该文件。
