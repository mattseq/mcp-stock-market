# MCP Stock Market

This tool provides stock market data using the Alpha Vantage API and is published to npm as [mcp-stock-market](https://www.npmjs.com/package/mcp-stock-market).
You must obtain a free API key from [Alpha Vantage](https://www.alphavantage.co/).

## Setup with Claude Desktop

1. **Get your API key:**  
   Sign up at [Alpha Vantage](https://www.alphavantage.co/) and copy your API key.

2. **Configure Claude Desktop:**  
   Add the following to your `claude_desktop_config.json` (replace `API_KEY_HERE` with your actual key):

   ```json
   {
     "mcpServers": {
       "stocks": {
         "command": "npx",
         "args": [
           "mcp-stock-market"
         ],
         "env": {
           "ALPHA_VANTAGE_API_KEY": "API_KEY_HERE"
         }
       }
     }
   }
   ```

## Running MCP Stock Market

Once you have configured your API key in `claude_desktop_config.json`, you can simply launch Claude Desktop and it should work automatically.  
You can check the settings in Claude to confirm that the MCP Stock Market server is running.