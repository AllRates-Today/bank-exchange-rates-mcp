import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  BankExchangeRates,
  BankExchangeRatesError,
  countries,
  country as countryOf,
  findBanks,
  BANK_COUNT,
  COUNTRY_COUNT,
} from 'bank-exchange-rates';
import { VERSION } from './version.js';

const SITE = 'https://allratestoday.com';
const NEEDS_KEY =
  'This tool needs an AllRatesToday API key. Get a free one at https://allratestoday.com/register and add it to this ' +
  'server\'s MCP config as "env": { "ALLRATES_API_KEY": "art_live_..." }, or call request_trial_key for a ' +
  '100-call, 7-day key right now.';

const cc = z
  .string()
  .regex(/^[A-Za-z]{2}$/, 'must be a 2-letter country code')
  .describe("Two-letter country code (ISO 3166), e.g. 'in', 'sg', 'ae', 'gb', 'us'. See list_bank_countries.");
const bankCode = z
  .string()
  .regex(/^[A-Za-z0-9_-]{2,30}$/, 'must be a bank code such as sbi, dbs, hsbchk')
  .describe("Bank code inside the country, e.g. 'sbi', 'hdfc', 'dbs', 'enbd', 'bofa'. Use find_banks if unsure.");
const ccy = z
  .string()
  .regex(/^[A-Za-z]{3}$/, 'must be a 3-letter ISO 4217 code')
  .describe("Foreign currency, ISO 4217, e.g. 'USD', 'EUR', 'GBP'. Prices are in the country's home currency per 1 unit.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD').describe('Date as YYYY-MM-DD.');

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;
const OFFLINE = { readOnlyHint: true, openWorldHint: false } as const;

function ok(structured: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
}
function fail(err: unknown) {
  const message =
    err instanceof BankExchangeRatesError
      ? `AllRatesToday error${err.status ? ` (${err.status})` : ''}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export interface ServerOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export function createServer(options: ServerOptions = {}) {
  const baseUrl = options.baseUrl || SITE;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  let apiKey = options.apiKey;
  let client = apiKey ? new BankExchangeRates({ apiKey, baseUrl, fetch: fetchImpl }) : undefined;
  const api = () => {
    if (!client) throw new Error(NEEDS_KEY);
    return client;
  };

  const server = new McpServer({ name: 'bank-exchange-rates-mcp', version: VERSION });

  server.registerTool(
    'list_bank_countries',
    {
      title: 'List countries with bank exchange rates',
      description:
        `Every country with commercial bank board rates (${COUNTRY_COUNT} countries, ${BANK_COUNT} banks): country code, name, home currency, number of banks. Works without an API key. Use it to find the country code for the other tools.`,
      inputSchema: {},
      annotations: OFFLINE,
    },
    async () =>
      ok({
        countries: countries().map((c) => ({ code: c.code, name: c.name, currency: c.currency, banks: c.banks.length })),
        banks: BANK_COUNT,
        bank_codes_page: `${SITE}/bank-exchange-rate-api/bank-codes/`,
      }),
  );

  server.registerTool(
    'find_banks',
    {
      title: 'Find a bank and its code',
      description:
        "Search covered banks by name, short name or code (e.g. 'hsbc', 'State Bank of India', 'emirates nbd'), or list every bank in one country. Returns the country code and bank code to pass to get_bank_rates. Works without an API key.",
      inputSchema: {
        query: z.string().max(80).optional().describe('Bank name, short name or code to search for.'),
        country: cc.optional().describe('Two-letter country code: list (or narrow the search to) banks in this country.'),
      },
      annotations: OFFLINE,
    },
    async ({ query, country }) => {
      const cc2 = country?.toLowerCase();
      if (cc2 && !countryOf(cc2)) return fail(new Error(`No covered banks in "${country}". Call list_bank_countries.`));
      let rows = query ? findBanks(query) : cc2 ? countryOf(cc2)!.banks.map((b) => ({ ...b, country: cc2 })) : [];
      if (cc2) rows = rows.filter((b) => b.country === cc2);
      if (!query && !cc2) return fail(new Error('Give a query, a country, or both.'));
      return ok({
        matches: rows.slice(0, 100).map((b) => ({
          country: b.country,
          bank: b.code,
          name: b.name,
          page: `${SITE}/bank-exchange-rate-api/${b.country}/${b.code}/`,
        })),
        total: rows.length,
        ...(rows.length > 100 ? { truncated: true } : {}),
      });
    },
  );

  server.registerTool(
    'get_bank_rates',
    {
      title: "Get a bank's buy and sell rates",
      description:
        "Live buy and sell exchange rates that one commercial bank shows on its own website, e.g. 'SBI TT buying rate for USD', 'DBS SGD rates', 'Emirates NBD INR rate today'. Give `ccy` for one currency (buy, sell, spread_pct and the central bank's official rate), or omit it for the bank's whole board. `date` returns the stored board for a past day (about 400 days kept). Prices are home currency per 1 unit of foreign currency. Retail prices, not official rates. Needs an API key (the free key works).",
      inputSchema: { country: cc, bank: bankCode, ccy: ccy.optional(), date: isoDate.optional() },
      annotations: READ_ONLY,
    },
    async ({ country, bank, ccy: cur, date }) => {
      try {
        const c = api();
        const res = cur ? await c.rate(country, bank, cur, { date }) : await c.bank(country, bank, { date });
        return ok(res as unknown as Record<string, unknown>);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'compare_bank_rates',
    {
      title: 'Compare banks in a country for one currency',
      description:
        "Rank every covered bank in a country for one currency, best first: 'which bank in India sells USD cheapest?', 'best bank to sell my euros in Sri Lanka'. side='sell' (default) ranks by the lowest price to buy the currency from the bank; side='buy' ranks by the highest price the bank pays you. Each row has buy, sell, spread_pct, the official rate and the bank's own update stamp. Needs an API key.",
      inputSchema: {
        country: cc,
        ccy,
        side: z.enum(['buy', 'sell']).optional().describe("'sell' = you buy the currency from the bank (default); 'buy' = you sell it to the bank."),
        limit: z.number().int().min(1).max(200).optional().describe('Max banks to return (default 20).'),
      },
      annotations: READ_ONLY,
    },
    async ({ country, ccy: cur, side, limit }) => {
      try {
        const rows = await api().compare(country, cur, { side: side ?? 'sell' });
        const meta = countryOf(country);
        return ok({
          country: country.toLowerCase(),
          quote_ccy: meta?.currency,
          ccy: cur.toUpperCase(),
          side: side ?? 'sell',
          banks: rows.slice(0, limit ?? 20),
          total: rows.length,
          note: 'Retail board prices as shown on each bank’s website; not official rates.',
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'get_country_bank_rates',
    {
      title: 'Get every bank board in a country',
      description:
        "Latest boards from every covered bank in one country, with the central bank's official rate for comparison. Pass `ccy` to keep only that currency (much smaller output). Needs an API key.",
      inputSchema: { country: cc, ccy: ccy.optional() },
      annotations: READ_ONLY,
    },
    async ({ country, ccy: cur }) => {
      try {
        const res = await api().country(country);
        if (cur) {
          const want = cur.toUpperCase();
          res.banks = res.banks.map((b) => ({ ...b, rates: b.rates.filter((r) => r.ccy === want) })).filter((b) => b.rates.length);
        }
        return ok(res as unknown as Record<string, unknown>);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'get_bank_rate_history',
    {
      title: "Get a bank's daily rate history",
      description:
        'Daily buy and sell history for one bank and currency between two dates (defaults to the last year). Needs a paid plan; on the free plan use get_bank_rates with `date` for a single past day.',
      inputSchema: { country: cc, bank: bankCode, ccy, from: isoDate.optional(), to: isoDate.optional() },
      annotations: READ_ONLY,
    },
    async ({ country, bank, ccy: cur, from, to }) => {
      try {
        return ok((await api().history(country, bank, cur, { from, to })) as unknown as Record<string, unknown>);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'request_trial_key',
    {
      title: 'Request a trial API key',
      description:
        'Self-issue an AllRatesToday API key with 100 calls, valid 7 days, with no account. Use it when a rate tool answered that it needs an API key and the user wants bank rates now. This server adopts the key for the rest of the session; tell the user to save it as ALLRATES_API_KEY in the MCP config. Capped at 3 keys per IP per day. Lasting free key: https://allratestoday.com/register.',
      inputSchema: {
        agent: z.string().max(80).optional().describe('Optional: the agent or product requesting the key.'),
        purpose: z.string().max(200).optional().describe('Optional: one line on what the rates are for.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ agent, purpose }) => {
      try {
        const res = await fetchImpl(`${baseUrl}/api/agent/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': `bank-exchange-rates-mcp/${VERSION}` },
          body: JSON.stringify({ agent, purpose }),
        });
        const text = await res.text();
        let body: any = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }
        if (!res.ok) throw new BankExchangeRatesError(body?.error ?? `HTTP ${res.status}`, res.status, body);
        const key: string | undefined = body?.api_key ?? body?.key;
        if (key) {
          apiKey = key;
          client = new BankExchangeRates({ apiKey, baseUrl, fetch: fetchImpl });
        }
        return ok({
          key,
          calls: body?.calls_included,
          expires_at: body?.expires_at,
          adopted: Boolean(key),
          note: 'This server now uses the trial key for this session. Keep it by adding "env": { "ALLRATES_API_KEY": "<key>" } to the MCP config.',
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}
