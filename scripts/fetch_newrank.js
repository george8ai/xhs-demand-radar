#!/usr/bin/env node
/**
 * 新榜小红书低粉爆文榜数据抓取（图文 × 各行业）
 * 直接调 API，无需浏览器
 */

const fs = require('fs');
const path = require('path');

// 加载 .env 文件
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const API_URL = 'https://gw.newrank.cn/api/mainRank/nr/mainRank/hotContent/getXhsContentData';

// ── 认证信息（从 Chrome DevTools 复制，存入 .env 文件）──────────────────────
// 获取方式：Chrome Network tab → 任意 gw.newrank.cn 请求 → Request Headers
//   NEWRANK_TOKEN: n-token 字段的值
//   NEWRANK_COOKIE: cookie 字段的完整值
const N_TOKEN = process.env.NEWRANK_TOKEN;
const COOKIE  = process.env.NEWRANK_COOKIE;

if (!N_TOKEN || !COOKIE) {
  console.error('❌ 缺少认证信息，请在 .env 文件中设置 NEWRANK_TOKEN 和 NEWRANK_COOKIE');
  console.error('   参考 .env.example 文件');
  process.exit(1);
}

const HEADERS = {
  'n-token': N_TOKEN,
  'Content-Type': 'application/json',
  'contenttype': 'application/json;charset=UTF-8',
  'Referer': 'https://www.newrank.cn/',
  'Cookie': COOKIE,
};

// ── 行业列表 ──────────────────────────────────────────────────────────────────
const INDUSTRIES = [
  '美妆', '美容个护', '鞋包潮玩', '穿搭打扮', '美食',
  '母婴育儿', '旅游出行', '家居家装', '教育', '生活',
  '运动健身', '兴趣爱好', '影视综', '婚嫁', '摄影摄像',
  '萌宠', '情感星座', '科技互联网', '资讯', '健康养生',
  '科学科普', '职场', '交通工具', '其他',
];

// ── 数据解析 ──────────────────────────────────────────────────────────────────
function parseItems(apiData, industry) {
  const list = apiData?.data?.list ?? [];
  return list
    .filter(item => item.photoType === 'normal')
    .map((item, index) => {
      const stats = item.anaAdd ?? {};
      return {
        rank: item.rankPosition ?? (index + 1),
        industry,
        title: item.desc ?? item.title ?? '',
        author: item.userName ?? '',
        fans: item.fans ?? 0,
        category: item.userTypeFirst ?? '',
        subCategory: item.userTypeSecond ?? '',
        collect: stats.collectedCount ?? item.collectCount ?? 0,
        share: stats.useShareCount ?? item.shareCount ?? 0,
        comment: stats.useCommentCount ?? item.commentCount ?? 0,
        like: stats.useLikeCount ?? item.likeCount ?? 0,
        total: stats.interactiveCount ?? 0,
        url: item.detailUrl ?? '',
      };
    });
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
async function fetchNewrankData() {
  const allData = [];
  const failed = [];

  console.log('📊 开始抓取各行业图文数据...\n');

  for (const industry of INDUSTRIES) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          rankType: 4,
          rankDate: 1,
          type: [industry],
          secondType: '',
          size: 25,
          start: 1,
          rankRealType: 1,
          photoType: 'normal',
        }),
      });
      const json = await res.json();

      if (json.code !== 2000) {
        console.warn(`  ✗ ${industry}: code=${json.code} ${json.msg}`);
        failed.push(industry);
        continue;
      }

      const items = parseItems(json, industry);
      console.log(`  ✓ ${industry}：${items.length} 条图文`);
      if (items[0]) console.log(`    首条: ${items[0].title.slice(0, 30)} | 粉丝:${items[0].fans} | 收藏:${items[0].collect}`);
      allData.push(...items);

      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.warn(`  ✗ ${industry} 失败: ${err.message}`);
      failed.push(industry);
    }
  }

  if (failed.length) console.log(`\n⚠️  失败行业: ${failed.join(', ')}`);

  const today = new Date().toISOString().split('T')[0];
  const filepath = path.join(DATA_DIR, `newrank_${today}.json`);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const output = {
    fetchedAt: new Date().toISOString(),
    source: 'newrank.cn',
    type: '低粉爆文榜（图文）',
    industries: INDUSTRIES,
    count: allData.length,
    data: allData,
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  console.log(`\n✅ 数据已保存: ${filepath}`);
  console.log(`📈 共抓取 ${allData.length} 条图文，覆盖 ${INDUSTRIES.length} 个行业`);

  return output;
}

fetchNewrankData().catch(console.error);
