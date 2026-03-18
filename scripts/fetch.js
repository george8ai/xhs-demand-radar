#!/usr/bin/env node
require('../lib/env');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const API_URL = 'https://gw.newrank.cn/api/mainRank/nr/mainRank/hotContent/getXhsContentData';

const INDUSTRIES = [
  '美妆', '美容个护', '鞋包潮玩', '穿搭打扮', '美食',
  '母婴育儿', '旅游出行', '家居家装', '教育', '生活',
  '运动健身', '兴趣爱好', '影视综', '婚嫁', '摄影摄像',
  '萌宠', '情感星座', '科技互联网', '资讯', '健康养生',
  '科学科普', '职场', '交通工具', '其他',
];

function parseItems(apiData, industry) {
  return (apiData?.data?.list ?? [])
    .filter(item => item.photoType === 'normal')
    .map((item, i) => {
      const s = item.anaAdd ?? {};
      return {
        rank: item.rankPosition ?? (i + 1),
        industry,
        title: item.desc ?? item.title ?? '',
        author: item.userName ?? '',
        fans: item.fans ?? 0,
        category: item.userTypeFirst ?? '',
        subCategory: item.userTypeSecond ?? '',
        collect: s.collectedCount ?? item.collectCount ?? 0,
        share: s.useShareCount ?? item.shareCount ?? 0,
        comment: s.useCommentCount ?? item.commentCount ?? 0,
        like: s.useLikeCount ?? item.likeCount ?? 0,
        total: s.interactiveCount ?? 0,
        url: item.detailUrl ?? '',
      };
    });
}

async function fetchData() {
  if (!process.env.NEWRANK_TOKEN || !process.env.NEWRANK_COOKIE) {
    throw new Error('缺少 NEWRANK_TOKEN 或 NEWRANK_COOKIE，请检查 .env 文件');
  }

  const headers = {
    'n-token': process.env.NEWRANK_TOKEN,
    'Content-Type': 'application/json',
    'contenttype': 'application/json;charset=UTF-8',
    'Referer': 'https://www.newrank.cn/',
    'Cookie': process.env.NEWRANK_COOKIE,
  };

  const allData = [];
  const failed = [];

  console.log('📊 抓取各行业图文数据...');

  for (const industry of INDUSTRIES) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rankType: 4, rankDate: 1, type: [industry],
          secondType: '', size: 25, start: 1,
          rankRealType: 1, photoType: 'normal',
        }),
      });
      const json = await res.json();
      if (json.code !== 2000) {
        console.warn(`  ✗ ${industry}: ${json.msg}`);
        failed.push(industry);
        continue;
      }
      const items = parseItems(json, industry);
      console.log(`  ✓ ${industry}：${items.length} 条`);
      allData.push(...items);
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.warn(`  ✗ ${industry} 失败: ${err.message}`);
      failed.push(industry);
    }
  }

  if (failed.length) console.warn(`⚠️  失败行业: ${failed.join(', ')}`);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  const filepath = path.join(DATA_DIR, `newrank_${today}.json`);
  fs.writeFileSync(filepath, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    source: 'newrank.cn',
    type: '低粉爆文榜（图文）',
    count: allData.length,
    data: allData,
  }, null, 2));

  console.log(`✅ 已保存 ${allData.length} 条 → ${filepath}`);
  return filepath;
}

if (require.main === module) {
  fetchData().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { fetchData };
