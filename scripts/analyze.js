#!/usr/bin/env node
require('../lib/env');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const DATA_DIR = path.join(__dirname, '..', 'data');
const XHS_RED = 0xFF2442;

const PRACTICAL_CATEGORIES = [
  '美食', '家居家装', '教育', '母婴育儿', '穿搭打扮',
  '美妆', '美容个护', '运动健身', '健康养生', '职场',
  '婚嫁', '旅游出行', '鞋包潮玩', '萌宠',
];

function findLatestFile() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('newrank_') && f.endsWith('.json'))
    .sort().reverse();
  if (!files.length) throw new Error('没有找到数据文件，请先运行 npm run fetch');
  return path.join(DATA_DIR, files[0]);
}

function buildPrompt(data) {
  const date = data.fetchedAt.split('T')[0];
  const items = data.data
    .filter(item => (Number(item.collect) || 0) > 300 || PRACTICAL_CATEGORIES.includes(item.industry))
    .sort((a, b) => (Number(b.collect) || 0) - (Number(a.collect) || 0))
    .slice(0, 60)
    .map(item => `[${item.industry}] 粉丝:${item.fans} 收藏:${item.collect} 点赞:${item.like} | ${item.title.replace(/\s+/g, ' ').trim()}`)
    .join('\n');

  return { date, items };
}

async function callClaude(client, messages) {
  // 处理代理可能注入 web_search 工具的 agentic loop（最多 3 轮）
  for (let i = 0; i < 3; i++) {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages,
    });
    const textBlock = message.content.find(b => b.type === 'text');
    if (textBlock) return textBlock.text;
    messages.push({ role: 'assistant', content: message.content });
    messages.push({ role: 'user', content: '请基于以上信息，直接输出 JSON 结果。' });
  }
  throw new Error('未能获取分析结果');
}

async function runAnalysis() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('缺少 ANTHROPIC_API_KEY，请检查 .env 文件');
  if (!process.env.DISCORD_WEBHOOK) throw new Error('缺少 DISCORD_WEBHOOK，请检查 .env 文件');

  const filepath = findLatestFile();
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const { date, items } = buildPrompt(data);

  console.log(`🤖 分析 ${date} 数据（${data.count} 条）...`);

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
  });

  const userPrompt = `你是小红书需求雷达分析师。分析以下新榜"低粉爆文榜（图文）"数据，找出"被低估但可变现的关键词"。

## 分析规则

**过滤无效内容**：剔除纯娱乐/搞笑、明星八卦、情绪宣泄、无法提取具体需求的内容
**提取需求关键词**：把标题转成"用户实际会搜索的关键词"
**评估机会**：收藏>>点赞=有真实需求，低粉能爆=内容供给少，能对应具体产品=变现路径清晰

## 输出要求

严格输出以下 JSON 格式，不要输出其他任何内容：

{
  "date": "${date}",
  "keywords": [
    {
      "keyword": "关键词名称",
      "demand": "用户想解决什么问题（1句话）",
      "score": 5,
      "reason": "评分理由（收藏数据+竞争情况）",
      "monetization": "具体变现方式"
    }
  ],
  "summary": "今日最值得做的方向（1句话）"
}

keywords 输出 3-5 个，score 为 1-5 的整数，按 score 从高到低排列。

## 今日榜单数据

${items}`;

  const raw = await callClaude(client, [{ role: 'user', content: userPrompt }]);

  // 提取 JSON（防止模型在前后加文字）
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude 未返回有效 JSON');
  const result = JSON.parse(jsonMatch[0]);

  console.log('📤 推送到 Discord...');
  await pushToDiscord(result);
  console.log('✅ 完成');
}

function buildEmbed(result) {
  const stars = n => '⭐'.repeat(n) + '✩'.repeat(5 - n);

  const fields = result.keywords.map(kw => ({
    name: `🔥 ${kw.keyword}`,
    value: `**需求** ${kw.demand}\n**机会** ${stars(kw.score)} ${kw.reason}\n**变现** ${kw.monetization}`,
    inline: false,
  }));

  return {
    title: `📊 小红书需求雷达 ${result.date}`,
    color: XHS_RED,
    fields,
    footer: { text: `💡 ${result.summary}` },
    timestamp: new Date().toISOString(),
  };
}

async function pushToDiscord(result) {
  const embed = buildEmbed(result);
  const res = await fetch(process.env.DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord 推送失败 ${res.status}: ${await res.text()}`);
}

if (require.main === module) {
  runAnalysis().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { runAnalysis };
