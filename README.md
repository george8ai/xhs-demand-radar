# 小红书需求雷达

从新榜低粉爆文榜数据中，识别"被低估但可变现的关键词"。

**核心思路**：低粉账号能在小红书爆文，说明内容供给少但需求真实存在。这类关键词竞争低、变现窗口尚未关闭。

## 工作流程

```
新榜低粉爆文榜（24个行业）
    ↓ fetch
data/newrank_YYYY-MM-DD.json（~470条图文）
    ↓ AI分析
过滤娱乐内容 → 提取需求关键词 → 评估变现机会
    ↓ push
Discord 推送今日 3-5 个高价值关键词
```

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone https://github.com/your-username/xhs-demand-radar.git
cd xhs-demand-radar
npm install
```

### 2. 配置凭证

```bash
cp .env.example .env
```

编辑 `.env`，填入以下信息：

| 变量 | 获取方式 |
|------|---------|
| `NEWRANK_TOKEN` | 登录 newrank.cn → Chrome DevTools → Network → 任意 `gw.newrank.cn` 请求 → Request Headers → `n-token` |
| `NEWRANK_COOKIE` | 同一请求 → Request Headers → `cookie` 完整值 |
| `DISCORD_WEBHOOK` | Discord 频道设置 → Integrations → Webhooks → 复制 URL |

### 3. 手动运行

```bash
# 抓取今日数据
npm run fetch

# AI 分析 + 推送 Discord（使用 Codex CLI）
npm run daily
```

### 4. 自动化（每天 9:00）

```bash
# 查看当前 crontab
crontab -l

# 添加定时任务（替换路径为你的实际路径）
(crontab -l; echo "0 9 * * * cd /path/to/xhs-demand-radar && node scripts/fetch_newrank.js >> logs/daily.log 2>&1 && codex exec '跑需求雷达' -c 'sandbox_permissions=[\"disk-full-read-access\"]' 2>/dev/null | node scripts/push_discord.js >> logs/daily.log 2>&1") | crontab -
```

## 目录结构

```
xhs-demand-radar/
├── scripts/
│   ├── fetch_newrank.js    # 新榜数据抓取（纯 HTTP，无需浏览器）
│   ├── analyze.js          # Claude API 分析 + Discord 推送（备用方案）
│   ├── push_discord.js     # Discord 推送工具（从 stdin 读取）
│   └── daily.sh            # 每日任务编排脚本
├── skill/
│   └── SKILL.md            # AI 分析指令（触发词："跑需求雷达"）
├── docs/
│   └── PRD.md              # 产品需求文档
├── data/                   # 抓取数据（不提交）
├── logs/                   # 运行日志（不提交）
├── .env.example            # 环境变量模板
└── .env                    # 本地凭证（不提交）
```

## 输出示例

```
📊 小红书需求雷达 (2026-03-18)

🔥 关键词：胃肠镜准备 / 清肠水使用方法
　　需求：用户做胃肠镜前对准备流程不知所措，大量收藏备用
　　机会：⭐⭐⭐⭐⭐（收藏/点赞=2.23x，47粉爆文）
　　变现：清肠水带货 / 检查前私家准备指南

🔥 关键词：减脂提高基础代谢
　　需求：想减脂但感觉越减越难，寻找饮食结构调整方法
　　机会：⭐⭐⭐⭐（多个低粉账号同时命中，需求稳定）
　　变现：饮食计划模板 / 代谢调整课程
```

## 数据说明

- **来源**：新榜低粉爆文榜（图文类）
- **覆盖**：24 个行业，每行业最多 25 条
- **筛选**：`photoType === 'normal'`（排除视频）
- **认证**：新榜会员账号 + Chrome DevTools 获取的 token/cookie

## 注意事项

- 新榜 cookie 有效期约 30 天，过期需重新从 Chrome DevTools 获取
- Codex CLI 需要在 git 仓库内运行
- 日志保存在 `logs/daily.log`
