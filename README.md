# Bank Exchange Rates MCP Server: live buy and sell rates from 1,219 commercial banks

[![npm version](https://img.shields.io/npm/v/bank-exchange-rates-mcp.svg)](https://www.npmjs.com/package/bank-exchange-rates-mcp)
[![license](https://img.shields.io/npm/l/bank-exchange-rates-mcp.svg)](https://github.com/AllRates-Today/bank-exchange-rates-mcp/blob/main/LICENSE)
[![MCP](https://img.shields.io/badge/MCP-server-1b7a40.svg)](https://modelcontextprotocol.io)

**An MCP server that gives Claude, Cursor, Windsurf and any other AI agent the real bank exchange rates.** It returns the buying rate and selling rate each commercial bank shows on its own website (telegraphic transfer, cash notes and card boards) for 1,219 banks in 124 countries, with the spread and the central bank's official rate next to every row.

Ask your assistant things like:

- "What is SBI's TT buying rate for USD today?"
- "Which bank in the UAE gives the most rupees for my dirhams?"
- "Compare HSBC, DBS and OCBC for EUR in Singapore."
- "How far is Emirates NBD's INR rate from the central bank rate?"
- "What did HDFC charge for USD on 15 October?"

Agents should fetch rates, not guess them. Bank rates move through the day and differ from the official rate by a percent or more on remittance currencies, so a remembered number is usually wrong.

## 🚀 Features

- 🏦 **1,219 commercial banks, 124 countries:** India, UAE, Singapore, Hong Kong, the UK, the US, Germany, Australia, Sri Lanka, Pakistan, the Philippines, Vietnam and more
- 💱 **Buy and sell rates** per 1 unit of foreign currency, in the local currency, read hourly from each bank's page
- 📊 **Spread and official rate** on every row (`spread_pct`, `official`, `vs_official_pct`)
- 🏆 **Bank comparison:** every bank in a country ranked best first for one currency
- 📅 **Past days** (about 400 days) on every plan; full daily history on paid plans
- 🔎 **Bank finder** that works offline, so the agent always gets the right country and bank code

## 🔑 Get your API key

Bank rates need an AllRatesToday API key; the free key works. Get one at [allratestoday.com/register](https://allratestoday.com/register). The bank finder tools work without a key, and the agent can call `request_trial_key` for a 100-call, 7-day key mid-conversation.

## 📦 Installation

### Claude Code

```bash
claude mcp add bank-exchange-rates -e ALLRATES_API_KEY=art_live_xxx -- npx -y bank-exchange-rates-mcp
```

### Claude Desktop, Cursor, Windsurf, Cline

Add to your MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, …):

```json
{
  "mcpServers": {
    "bank-exchange-rates": {
      "command": "npx",
      "args": ["-y", "bank-exchange-rates-mcp"],
      "env": { "ALLRATES_API_KEY": "art_live_xxx" }
    }
  }
}
```

Also published as `@allratestoday/bank-exchange-rates-mcp`.

## 🧰 Tools

| Tool | What it does | Key |
|---|---|---|
| `list_bank_countries` | Every covered country: code, home currency, number of banks | No |
| `find_banks` | Find a bank's country and bank code by name, or list a country's banks | No |
| `get_bank_rates` | One bank's buy/sell board, or one currency (`ccy`), latest or for a past `date` | Free key |
| `compare_bank_rates` | Rank every bank in a country for one currency, best first (`side`: `sell` or `buy`) | Free key |
| `get_country_bank_rates` | Every bank board in a country, optionally one currency | Free key |
| `get_bank_rate_history` | Daily buy/sell history for one bank and currency | Paid plan |
| `request_trial_key` | Self-issue a 100-call, 7-day key; the server adopts it | No |

Example `get_bank_rates` result (`country: "sg", bank: "dbs", ccy: "USD"`):

```json
{
  "bank": "dbs",
  "name": "DBS Bank",
  "quote_ccy": "SGD",
  "basis": "Telegraphic transfer",
  "ccy": "USD",
  "buy": 1.275666,
  "sell": 1.301063,
  "spread_pct": 1.971,
  "official": 1.2863,
  "vs_official_pct": 0.16
}
```

`buy` is what the bank pays you for 1 unit of the foreign currency; `sell` is what it charges you. These are retail prices, not official rates. For tax, customs and accounting, use the [central bank official rates](https://allratestoday.com/central-bank-rates-api/) (MCP: [@allratestoday/central-bank-mcp](https://www.npmjs.com/package/@allratestoday/central-bank-mcp)).

## ⚙️ Configuration

| Variable | Meaning |
|---|---|
| `ALLRATES_API_KEY` | Your AllRatesToday API key |
| `ALLRATES_BASE_URL` | Override the API host (default `https://allratestoday.com`) |

## 🌍 More from AllRatesToday

- [bank-exchange-rates](https://www.npmjs.com/package/bank-exchange-rates): the same data as a TypeScript client ([GitHub](https://github.com/AllRates-Today/bank-exchange-rates))
- [@allratestoday/mcp-server](https://www.npmjs.com/package/@allratestoday/mcp-server): real-time mid-market rates, official rates and bank rates in one MCP server
- [@allratestoday/central-bank-mcp](https://www.npmjs.com/package/@allratestoday/central-bank-mcp): official rates from 120+ central banks and 50+ tax authorities
- [Bank Exchange Rate API](https://allratestoday.com/bank-exchange-rate-api/): live bank boards, country by country

## 🔗 Links

- **Website:** [allratestoday.com](https://allratestoday.com)
- [Bank Rates API documentation](https://allratestoday.com/docs#bank-rates)
- [Bank codes](https://allratestoday.com/bank-exchange-rate-api/bank-codes/)
- [API Documentation](https://allratestoday.com/developers)
- [Register (Free)](https://allratestoday.com/register)
- [Dashboard](https://allratestoday.com/profile)
- [Status](https://allratestoday.com/status)
- [GitHub](https://github.com/AllRates-Today/bank-exchange-rates-mcp)

## 📜 License

MIT. Rates come from each named bank's public website; pages that show them need a visible link to [allratestoday.com](https://allratestoday.com).
