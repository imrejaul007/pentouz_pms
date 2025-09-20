import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Currency from './src/models/Currency.js';

dotenv.config();

const currencies = [
  {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    exchangeRate: 1.0,
    isBaseCurrency: true,
    isActive: true,
    decimalPlaces: 2
  },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    exchangeRate: 0.85,
    isActive: true,
    decimalPlaces: 2
  },
  {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    exchangeRate: 0.73,
    isActive: true,
    decimalPlaces: 2
  },
  {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    exchangeRate: 110.0,
    isActive: true,
    decimalPlaces: 0
  },
  {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    exchangeRate: 1.35,
    isActive: true,
    decimalPlaces: 2
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    exchangeRate: 1.25,
    isActive: true,
    decimalPlaces: 2
  },
  {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    exchangeRate: 74.5,
    isActive: true,
    decimalPlaces: 2
  }
];

async function createCurrencies() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Connected to database');

    // Clear existing currencies
    await Currency.deleteMany({});
    console.log('Cleared existing currencies');

    // Create currencies
    await Currency.insertMany(currencies);
    console.log('Created currencies:', currencies.map(c => c.code).join(', '));

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createCurrencies();