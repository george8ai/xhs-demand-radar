# 小红书需求雷达

从新榜低粉爆文榜数据中，识别"被低估但可变现的关键词"，每天自动推送到 Discord。

**核心思路**：低粉账号能在小红书爆文，说明内容供给少但需求真实存在。这类关键词竞争低、变现窗口尚未关闭。

## 效果预览

每天 9:00 自动推送到 Discord，输出一张卡片：

```
📊 小红书需求雷达 2026-03-18

🔥 肠镜清肠水喝法
   需求 做肠镜前不知道怎么正确喝泻药，怕喝错影响检查
   机会 ⭐⭐⭐⭐⭐ 收藏2410>>点赞1081，刚需且复购场景明确
   变现 清肠水代购/团购、肠镜准备清单、医疗健康知识付费

🔥 小个子中性风穿搭
   ...

💡 医疗刚需类和身材痛点类收藏远超点赞，是当前最值得切入的变现方向
```

## 工作流程

```
每天 9:00（cron）
    ↓
scripts/fetch.js      拉取新榜低粉爆文榜（24个行业，~470条图文）
    ↓
scripts/analyze.js    Claude AI 过滤 → 提取关键词 → 评分 → 输出 JSON
    ↓
Discord Webhook        发送 embed 卡片
```

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone https://github.com/george8ai/xhs-demand-radar.git
cd xhs-demand-radar
npm install
```

### 2. 配置凭证

```bash
cp .env.example .env
```

编辑 `.env`，填入三项配置：

**NEWRANK_TOKEN 和 NEWRANK_COOKIE**

1. 用 Chrome 登录 [newrank.cn](https://newrank.cn)
2. 打开 DevTools（F12）→ Network 标签
3. 刷新页面，找任意 `gw.newrank.cn` 请求
4. 点开 → Request Headers
5. 复制 `n-token` 的值 → `NEWRANK_TOKEN`
6. 复制 `cookie` 的完整值 → `NEWRANK_COOKIE`

**DISCORD_WEBHOOK**

1. 打开 Discord 频道设置 → Integrations → Webhooks
2. 新建 Webhook → 复制 URL → `DISCORD_WEBHOOK`

**ANTHROPIC_API_KEY**（可选，有自己的 Claude API 时填写）

```bash
# .env 示例
NEWRANK_TOKEN=your_n_token_here
NEWRANK_COOKIE=your_full_cookie_string_here
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
ANTHROPIC_API_KEY=sk-ant-...          # 可选
ANTHROPIC_BASE_URL=https://...        # 可选，自定义 API 地址
```

### 3. 手动运行

```bash
# 只拉数据
npm run fetch

# 只分析（需已有数据文件）
npm run analyze

# 完整流程：拉数据 + 分析 + 推送
npm run daily
```

### 4. 设置每日自动运行

```bash
# 查看当前 crontab
crontab -l

# 添加每天 9:00 定时任务
NODE=$(which node)
DIR=$(pwd)
(crontab -l; echo "0 9 * * * cd $DIR && $NODE scripts/daily.js >> logs/daily.log 2>&1") | crontab -
```

> **注意**：macOS 合盖睡眠时 cron 不会触发。需要更可靠的方案可改用 launchd。

## 目录结构

```
xhs-demand-radar/
├── lib/
│   └── env.js              # 统一加载 .env
├── scripts/
│   ├── fetch.js            # 新榜数据抓取（纯 HTTP，无需浏览器）
│   ├── analyze.js          # Claude AI 分析 + Discord embed 推送
│   └── daily.js            # 入口：fetch → analyze
├── skill/
│   └── SKILL.md            # AI 分析指令（手动触发用）
├── docs/
│   └── PRD.md              # 产品需求文档
├── data/                   # 抓取数据（不提交）
├── logs/                   # 运行日志（不提交）
├── .env.example            # 环境变量模板
└── .env                    # 本地凭证（不提交）
```

## 注意事项

| 事项 | 说明 |
|------|------|
| Cookie 有效期 | 新榜 cookie 约 30 天失效，过期后 fetch 会报错，需重新从 DevTools 获取 |
| 数据范围 | 只抓图文（`photoType=normal`），不含视频 |
| 行业覆盖 | 24 个行业，每行业最多 25 条，共约 470 条/天 |
| 分析模型 | 默认 `claude-opus-4-6`，需要 Claude API Key |

## 日志查看

```bash
# 实时查看日志
tail -f logs/daily.log
```
