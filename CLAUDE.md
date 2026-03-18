# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

小红书需求雷达 (XHS Demand Radar) - A tool that scrapes Newrank's low-follower viral content data from Xiaohongshu (Little Red Book) and identifies undervalued, monetizable keywords.

**Core workflow**: Newrank data → Filter entertainment content → Extract demand keywords → Evaluate monetization opportunities

## Common Commands

### Data Collection
```bash
npm run fetch
```
Launches Playwright to scrape Newrank's low-follower viral content ranking (低粉爆文榜). Data is saved to `data/newrank_YYYY-MM-DD.json`.

### Analysis
The analysis is performed via the skill system (see skill/SKILL.md). User triggers analysis by saying phrases like "分析小红书需求" or "跑需求雷达".

## Architecture

### Data Flow
1. **Scraping** (`scripts/fetch_newrank.js`): Uses Playwright to scrape dynamic content from newrank.cn
   - Launches browser in non-headless mode
   - Waits 15 seconds for JS rendering
   - Extracts table data including: rank, title, author, fans, category, engagement metrics (collect/share/comment/like)
   - Saves to `data/newrank_YYYY-MM-DD.json`

2. **Analysis** (`skill/SKILL.md`): AI-driven analysis workflow
   - Filters out entertainment/gossip content with no monetization value
   - Extracts demand keywords from titles (e.g., "复古茶会" → "茶会布置、茶会流程")
   - Scores opportunities based on: demand strength (收藏 > 点赞), competition (low-follower viral = low content supply), monetization potential
   - Outputs 3-5 high-value keywords with actionable product suggestions

### Data Structure
Scraped JSON format:
```json
{
  "fetchedAt": "ISO timestamp",
  "source": "newrank.cn",
  "type": "低粉爆文榜",
  "count": number,
  "data": [
    {
      "rank": number,
      "title": string,
      "author": string,
      "fans": number,
      "category": string,
      "subCategory": string,
      "collect": string,
      "share": string,
      "comment": string,
      "like": string,
      "total": string
    }
  ]
}
```

### Key Filtering Criteria
- **Keep**: High collect count (indicates demand), practical categories (美食/家居/教育/母婴/穿搭)
- **Discard**: Pure entertainment, celebrity gossip, emotional venting, content without extractable demand

### Opportunity Scoring
High-value keywords have:
- High collect-to-like ratio (users want to save it)
- Low-follower viral success (indicates content gap)
- Clear product/service monetization path

## Automation Potential
The README mentions future automation via cron:
1. Morning data fetch
2. AI analysis with Discord push notification
