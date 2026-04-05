const axios = require('axios');

const ALPHA_VANTAGE_KEY = 'YOUR_ALPHA_VANTAGE_API_KEY';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';

/**
 * Fetch stock price from Alpha Vantage
 * @param {string} symbol - The stock symbol (e.g., 'AAPL')
 */
const fetchStockPrice = async (symbol) => {
  const response = await axios.get(ALPHA_VANTAGE_URL, {
    params: {
      function: 'TIME_SERIES_INTRADAY',
      symbol,
      interval: '1min',
      apikey: ALPHA_VANTAGE_KEY
    }
  });
  const timeSeries = response.data['Time Series (1min)'];
  const latestTimestamp = Object.keys(timeSeries)[0];
  return { price: timeSeries[latestTimestamp]['1. open'], timestamp: latestTimestamp };
};

/**
 * Fetch crypto price from CoinGecko
 * @param {string} id - The CoinGecko id (e.g., 'bitcoin')
 */
const fetchCryptoPrice = async (id) => {
  const response = await axios.get(COINGECKO_URL, {
    params: { ids: id, vs_currencies: 'usd' }
  });
  return response.data[id].usd;
};

/**
 * Get multiple stock prices
 * @param {Array<string>} symbols - Array of stock symbols
 */
const getMultipleStockPrices = async (symbols) => {
  const pricePromises = symbols.map(symbol => fetchStockPrice(symbol));
  return Promise.all(pricePromises);
};

/**
 * Get multiple crypto prices
 * @param {Array<string>} ids - Array of CoinGecko ids
 */
const getMultipleCryptoPrices = async (ids) => {
  const pricePromises = ids.map(id => fetchCryptoPrice(id));
  return Promise.all(pricePromises);
};

/**
 * Calculate gains/losses
 * @param {number} purchasePrice - The price at which the stock/crypto was purchased
 * @param {number} currentPrice - The current price
 */
const calculateGainsLosses = (purchasePrice, currentPrice) => {
  return ((currentPrice - purchasePrice) / purchasePrice) * 100;
};

module.exports = {
  fetchStockPrice,
  fetchCryptoPrice,
  getMultipleStockPrices,
  getMultipleCryptoPrices,
  calculateGainsLosses
};