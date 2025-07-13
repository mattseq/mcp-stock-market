#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";

const server = new McpServer({
  name: "mcp-stock-market",
  version: "1.0.0"
});


const inputSchema = {
  symbol: z.string().describe("The stock ticker symbol, e.g., AAPL, MSFT"),
};


async function getStockPrice({ symbol }) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("Error: Missing ALPHA_VANTAGE_API_KEY environment variable.");

  const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
  if (!res.ok) throw new Error(`Failed to get stock price for ${symbol}`);

  const data = await res.json();

  const quote = data["Global Quote"];
  if (!quote || !quote["05. price"]) throw new Error(`No price data found for ${symbol}`);

  return {
    content: [{
      type: "text",
      text: `Stock: ${symbol.toUpperCase()}\nPrice: $${quote["05. price"]}\nChange: ${quote["09. change"]} (${quote["10. change percent"]})`
    }]
  };
}

async function getStockNews({ symbol }) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("Error: Missing ALPHA_VANTAGE_API_KEY environment variable.");

  const res = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${apiKey}`);
  if (!res.ok) throw new Error(`Failed to get news for ${symbol}`);

  const data = await res.json();

  if (!data.feed || data.feed.length === 0) {
    return { content: [{ type: "text", text: `No recent news found for ${symbol}` }] };
  }

  const topNews = data.feed.slice(0, 3)
    .map((a, i) => `${i + 1}. ${a.title}\n${a.url}`)
    .join("\n\n");

  return {
    content: [{
      type: "text",
      text: `Latest news for ${symbol.toUpperCase()}:\n\n${topNews}`
    }]
  };
}

async function getCompanyOverview({ symbol }) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("API key not set.");

  const res = await fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`);
  if (!res.ok) throw new Error(`Failed to get company overview for ${symbol}`);

  const data = await res.json();

  if (!data.Name) throw new Error(`No overview data found for ${symbol}`);

  return {
    content: [{
      type: "text",
      text:
        `Company: ${data.Name}\n` +
        `Sector: ${data.Sector}\n` +
        `Industry: ${data.Industry}\n` +
        `Description: ${data.Description.substring(0, 300)}...` // truncated for brevity
    }]
  };
}

async function getDividendHistory({ symbol }) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("API key not set.");

  const res = await fetch(`https://www.alphavantage.co/query?function=DIVIDEND_HISTORY&symbol=${symbol}&apikey=${apiKey}`);
  if (!res.ok) throw new Error(`Failed to get dividend history for ${symbol}`);

  const data = await res.json();

  if (!data["historical"] || data["historical"].length === 0) {
    return { content: [{ type: "text", text: `No dividend history found for ${symbol}` }] };
  }

  // Last 3 dividends
  const recentDividends = data["historical"].slice(0, 3);
  const lines = recentDividends.map(d => `${d.date}: $${d.dividend}`);

  return {
    content: [{
      type: "text",
      text: `Recent dividends for ${symbol.toUpperCase()}:\n${lines.join("\n")}`
    }]
  };
}

async function getIntraday({ symbol }) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("API key not set.");

  const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${apiKey}`);
  if (!res.ok) throw new Error(`Failed to get intraday data for ${symbol}`);

  const data = await res.json();

  const series = data["Time Series (5min)"];
  if (!series) throw new Error(`No intraday data found for ${symbol}`);

  // Get last 3 data points
  const times = Object.keys(series).slice(0, 3);
  const lines = times.map(time => {
    const point = series[time];
    return `${time}: Open $${point["1. open"]}, Close $${point["4. close"]}`;
  });

  return {
    content: [{
      type: "text",
      text: `Recent intraday (5min) prices for ${symbol.toUpperCase()}:\n${lines.join("\n")}`
    }]
  };
}

async function convertCurrency({ amount, from_currency, to_currency }) {
  if (!amount || isNaN(amount)) throw new Error("Amount must be a number");
  if (!from_currency || !to_currency) throw new Error("from_currency and to_currency are required");

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("API key not set.");

  const res = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from_currency}&to_currency=${to_currency}&apikey=${apiKey}`);
  if (!res.ok) throw new Error(`Failed to get exchange rate from ${from_currency} to ${to_currency}`);

  const data = await res.json();
  const rateInfo = data["Realtime Currency Exchange Rate"];
  if (!rateInfo) throw new Error("No exchange rate data found");

  const rate = parseFloat(rateInfo["5. Exchange Rate"]);
  const converted = (amount * rate).toFixed(2);

  return {
    content: [{
      type: "text",
      text:
        `${amount} ${from_currency.toUpperCase()} = ${converted} ${to_currency.toUpperCase()}\n` +
        `Exchange Rate: ${rate}\n` +
        `Last Refreshed: ${rateInfo["6. Last Refreshed"]}`
    }]
  };
}

async function calculatePortfolioValue({ holdings }) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("API key not set.");
  if (!Array.isArray(holdings) || holdings.length === 0) throw new Error("holdings must be a non-empty array");

  let totalValue = 0;
  let details = [];

  for (const { symbol, shares } of holdings) {
    if (!symbol || !shares) continue;

    const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
    if (!res.ok) continue;

    const data = await res.json();
    const quote = data["Global Quote"];
    if (!quote || !quote["05. price"]) continue;

    const price = parseFloat(quote["05. price"]);
    const value = price * shares;

    details.push(`${shares} shares of ${symbol.toUpperCase()} at $${price.toFixed(2)} = $${value.toFixed(2)}`);
    totalValue += value;
  }

  return {
    content: [{
      type: "text",
      text:
        `Portfolio Value:\n${details.join("\n")}\n\nTotal Estimated Value: $${totalValue.toFixed(2)}`
    }]
  };
}


server.registerTool("getStockPrice", {
    title: "Stock Price Tool",
    description: "Get the latest stock price for a given ticker symbol using Alpha Vantage API",
    inputSchema
}, getStockPrice);

server.registerTool("getStockNews", {
    title: "Stock News Tool",
    description: "Get the latest news for a stock ticker symbol using Alpha Vantage API",
    inputSchema
}, getStockNews);

server.registerTool("getCompanyOverview", {
  title: "Company Overview Tool",
  description: "Get company information for a given stock ticker symbol using Alpha Vantage API",
  inputSchema
}, getCompanyOverview);

server.registerTool("getDividendHistory", {
  title: "Dividend History Tool",
  description: "Get recent dividend payout history for a ticker symbol using Alpha Vantage API",
  inputSchema
}, getDividendHistory);

server.registerTool("getIntraday", {
  title: "Intraday Price Tool",
  description: "Get recent intraday stock prices (5-minute intervals) for a ticker symbol using Alpha Vantage API",
  inputSchema
}, getIntraday);

server.registerTool("convertCurrency", {
  title: "Currency Conversion Tool",
  description: "Convert an amount from one currency to another using latest exchange rate",
  inputSchema: {
    amount: z.number().describe("Amount of money to convert"),
    from_currency: z.string().describe("Currency to convert from, e.g., USD"),
    to_currency: z.string().describe("Currency to convert to, e.g., EUR"),
  },
}, convertCurrency);

server.registerTool("calculatePortfolioValue", {
  title: "Portfolio Value Calculator",
  description: "Calculate total value of a portfolio given holdings",
  inputSchema: {
    holdings: z.array(z.object({
      symbol: z.string(),
      shares: z.number(),
    })).describe("Array of stock holdings with symbol and shares"),
  },
}, calculatePortfolioValue);



(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();