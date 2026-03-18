#!/usr/bin/env node
/**
 * 从 stdin 读取内容，推送到 Discord webhook
 * 用法：echo "消息" | node scripts/push_discord.js
 */

// 加载 .env 文件
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
if (!DISCORD_WEBHOOK) {
  console.error('❌ 缺少 DISCORD_WEBHOOK，请在 .env 文件中设置');
  process.exit(1);
}

async function push(content) {
  const chunks = [];
  let remaining = content.trim();
  while (remaining.length > 1900) {
    const pos = remaining.lastIndexOf('\n', 1900);
    chunks.push(remaining.slice(0, pos > 0 ? pos : 1900));
    remaining = remaining.slice(pos > 0 ? pos + 1 : 1900);
  }
  if (remaining) chunks.push(remaining);

  for (const chunk of chunks) {
    const res = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) throw new Error(`Discord 推送失败 ${res.status}: ${await res.text()}`);
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
  }
  console.log(`✅ 推送完成（${chunks.length} 段）`);
}

// 从 stdin 读取
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  if (!input.trim()) { console.error('❌ 没有内容可推送'); process.exit(1); }
  push(input).catch(err => { console.error('❌', err.message); process.exit(1); });
});
