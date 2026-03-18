#!/bin/bash
# 小红书需求雷达 - 每日自动运行脚本
# 由 cron 调用，每天 9:00 执行

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/daily.log"

mkdir -p "$PROJECT_DIR/logs"

{
  echo "========================================"
  echo "$(date '+%Y-%m-%d %H:%M:%S') 开始每日任务"
  echo "========================================"

  cd "$PROJECT_DIR"

  # Step 1: 抓取新榜数据
  echo "→ 抓取新榜数据..."
  node scripts/fetch_newrank.js
  echo ""

  # Step 2: 用 Claude Code CLI 分析，输出传给 Discord 推送脚本
  echo "→ AI 分析 + 推送 Discord..."
  claude -p "跑需求雷达" \
    --allowedTools "Read,Bash" \
    --output-format text \
    2>/dev/null \
  | node scripts/push_discord.js

  echo "$(date '+%Y-%m-%d %H:%M:%S') 任务完成 ✅"

} >> "$LOG_FILE" 2>&1
