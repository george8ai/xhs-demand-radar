#!/usr/bin/env node
require('../lib/env');
const { fetchData } = require('./fetch');
const { runAnalysis } = require('./analyze');

async function main() {
  console.log(`\n🚀 小红书需求雷达 ${new Date().toLocaleString('zh-CN')}\n`);
  await fetchData();
  console.log('');
  await runAnalysis();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
