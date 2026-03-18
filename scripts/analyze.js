#!/usr/bin/env node
/**
 * 小红书需求雷达 - AI 分析 + Discord 推送
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// 加载 .env 文件
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
if (!DISCORD_WEBHOOK) {
  console.error('❌ 缺少 DISCORD_WEBHOOK，请在 .env 文件中设置');
  process.exit(1);
}

const PRACTICAL_CATEGORIES = [
  '美食', '家居家装', '教育', '母婴育儿', '穿搭打扮',
  '美妆', '美容个护', '运动健身', '健康养生', '职场',
  '婚嫁', '旅游出行', '鞋包潮玩', '萌宠',
];

// ── 找最新数据文件 ──────────────────────────────────────────────────────────
function findLatestData() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('newrank_') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) throw new Error('没有找到数据文件，请先运行 npm run fetch');
  return path.join(DATA_DIR, files[0]);
}

// ── 准备发给 Claude 的精简数据 ─────────────────────────────────────────────
function prepareDataSummary(data) {
  const items = data.data
    .filter(item => {
      const collect = Number(item.collect) || 0;
      return collect > 300 || PRACTICAL_CATEGORIES.includes(item.industry);
    })
    .sort((a, b) => (Number(b.collect) || 0) - (Number(a.collect) || 0))
    .slice(0, 120);

  return items
    .map(item =>
      `[${item.industry}] 粉丝:${item.fans} 收藏:${item.collect} 点赞:${item.like} | ${item.title}`
    )
    .join('\n');
}

// ── Claude 分析 ────────────────────────────────────────────────────────────
async function analyzeWithClaude(dataSummary, date) {
  const client = new Anthropic();

  const prompt = `你是小红书需求雷达分析师。分析以下新榜"低粉爆文榜（图文）"数据，找出"被低估但可变现的关键词"。

## 分析规则

**第一步：过滤无效内容**
剔除：纯娱乐/搞笑、明星八卦、情绪宣泄、无法提取具体需求的内容

**第二步：提取需求关键词**
把标题转成"用户实际会搜索的关键词"：
- "复古茶会" → 茶会布置、茶会流程、茶会策划
- "大学生晚上的固定操作" → 大学生晚间routine、晚自习效率

**第三步：评估机会**
- 收藏 >> 点赞：用户想保存 = 有真实需求
- 低粉能爆：内容供给少 = 竞争低
- 能对应具体产品/服务：变现路径清晰

**第四步：输出 3-5 个最有价值的关键词**

## 输出格式（严格遵守）

📊 **小红书需求雷达 ${date}**

🔥 **关键词**：XXX
　　需求：用户想要...
　　机会：⭐⭐⭐⭐（收藏高/内容少/有购买意图）
　　变现：[具体产品或服务]

（重复3-5次）

---
💡 **今日总结**：一句话说明最值得做的方向

## 今日榜单数据

${dataSummary}`;

  const stream = await client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();
  return message.content.find(b => b.type === 'text')?.text || '';
}

// ── 推送到 Discord ─────────────────────────────────────────────────────────
async function pushToDiscord(content) {
  // Discord 单条消息限制 2000 字符，超出则分段发送
  const chunks = [];
  let remaining = content;
  while (remaining.length > 1900) {
    const splitAt = remaining.lastIndexOf('\n', 1900);
    const pos = splitAt > 0 ? splitAt : 1900;
    chunks.push(remaining.slice(0, pos));
    remaining = remaining.slice(pos + 1);
  }
  chunks.push(remaining);

  for (const chunk of chunks) {
    const res = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord 推送失败 ${res.status}: ${text}`);
    }
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
  }
}

// ── 主流程 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 加载最新数据...');
  const filepath = findLatestData();
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const date = data.fetchedAt.split('T')[0];
  console.log(`  来源: ${filepath}`);
  console.log(`  数据: ${data.count} 条，日期: ${date}`);

  console.log('\n🤖 调用 Claude 分析...');
  const dataSummary = prepareDataSummary(data);
  const analysis = await analyzeWithClaude(dataSummary, date);

  console.log('\n📤 推送到 Discord...');
  await pushToDiscord(analysis);

  console.log('✅ 完成！\n');
  console.log(analysis);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
