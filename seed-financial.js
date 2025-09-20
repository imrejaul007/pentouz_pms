import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';
import BankAccount from './src/models/BankAccount.js';
import Budget from './src/models/Budget.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('Database connected for financial seeding');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const seedFinancialData = async () => {
  try {
    // Clear existing financial data
    await ChartOfAccounts.deleteMany({});
    await BankAccount.deleteMany({});
    await Budget.deleteMany({});
    console.log('Cleared existing financial data');

    // Create a simple user and hotel if they don't exist
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Admin User',
        email: 'admin@hotel.com',
        password: 'admin123',
        role: 'admin'
      });
      console.log('Created admin user');
    }

    let hotel = await Hotel.findOne();
    if (!hotel) {
      hotel = await Hotel.create({
        name: 'THE PENTOUZ',
        description: 'A luxury hotel in the heart of the city',
        address: {
          street: '123 Luxury Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India'
        },
        ownerId: adminUser._id
      });
      console.log('Created hotel');
    }

    // Create Chart of Accounts with real balances
    const chartOfAccountsData = [
      {
        hotelId: hotel._id,
        accountCode: '1110',
        accountName: 'Cash and Bank',
        accountType: 'Asset',
        accountSubType: 'Current Asset',
        currentBalance: 850000,
        isActive: true,
        normalBalance: 'Debit',
        description: 'Cash in hand and bank accounts',
        createdBy: adminUser._id
      },
      {
        hotelId: hotel._id,
        accountCode: '1120',
        accountName: 'Accounts Receivable',
        accountType: 'Asset',
        accountSubType: 'Current Asset',
        currentBalance: 1193000,
        isActive: true,
        normalBalance: 'Debit',
        description: 'Amount owed by customers',
        createdBy: adminUser._id
      },
      {
        hotelId: hotel._id,
        accountCode: '2110',
        accountName: 'Accounts Payable',
        accountType: 'Liability',
        accountSubType: 'Current Liability',
        currentBalance: 385000,
        isActive: true,
        normalBalance: 'Credit',
        description: 'Amount owed to suppliers',
        createdBy: adminUser._id
      },
      {
        hotelId: hotel._id,
        accountCode: '4100',
        accountName: 'Room Revenue',
        accountType: 'Revenue',
        accountSubType: 'Operating Revenue',
        currentBalance: 2100000,
        isActive: true,
        normalBalance: 'Credit',
        description: 'Revenue from room bookings',
        createdBy: adminUser._id
      },
      {
        hotelId: hotel._id,
        accountCode: '4200',
        accountName: 'Food & Beverage Revenue',
        accountType: 'Revenue',
        accountSubType: 'Operating Revenue',
        currentBalance: 750000,
        isActive: true,
        normalBalance: 'Credit',
        description: 'Revenue from restaurant and bar',
        createdBy: adminUser._id
      },
      {
        hotelId: hotel._id,
        accountCode: '6100',
        accountName: 'Operating Expenses',
        accountType: 'Expense',
        accountSubType: 'Operating Expense',
        currentBalance: 850000,
        isActive: true,
        normalBalance: 'Debit',
        description: 'Day-to-day operating costs',
        createdBy: adminUser._id
      },
      {
        hotelId: hotel._id,
        accountCode: '6200',
        accountName: 'Staff Expenses',
        accountType: 'Expense',
        accountSubType: 'Operating Expense',
        currentBalance: 650000,
        isActive: true,
        normalBalance: 'Debit',
        description: 'Salaries and staff-related costs',
        createdBy: adminUser._id
      }
    ];

    const createdAccounts = await ChartOfAccounts.insertMany(chartOfAccountsData);
    console.log('Chart of Accounts created: ' + createdAccounts.length);

    // Create Bank Accounts
    const cashAccount = createdAccounts.find(acc => acc.accountCode === '1110');
    const bankAccountsData = [
      {
        hotelId: hotel._id,
        accountName: 'Primary Current Account',
        bankName: 'HDFC Bank',
        accountNumber: '12345678901',
        routingNumber: 'HDFC0001234',
        accountType: 'Checking',
        currency: 'INR',
        currentBalance: 850000,
        availableBalance: 825000,
        isActive: true,
        isPrimary: true,
        description: 'Main operating account',
        glAccountId: cashAccount._id,
        createdBy: adminUser._id
      }
    ];

    const createdBankAccounts = await BankAccount.insertMany(bankAccountsData);
    console.log('Bank Accounts created: ' + createdBankAccounts.length);

    // Create Budget for current year
    const currentYear = new Date().getFullYear();
    const budgetData = [
      {
        hotelId: hotel._id,
        budgetName: 'Annual Budget ' + currentYear,
        fiscalYear: currentYear,
        period: {
          startDate: new Date(currentYear, 0, 1),
          endDate: new Date(currentYear, 11, 31)
        },
        currency: 'INR',
        budgetType: 'Operating',
        status: 'Active',
        budgetCategories: [
          {
            categoryName: 'Room Revenue',
            budgetedAmount: 25000000,
            actualAmount: 21000000,
            variance: -4000000,
            variancePercentage: -16
          },
          {
            categoryName: 'F&B Revenue',
            budgetedAmount: 8000000,
            actualAmount: 7500000,
            variance: -500000,
            variancePercentage: -6.25
          }
        ],
        totalBudgetedAmount: 33000000,
        totalActualAmount: 28500000,
        approvedBy: adminUser._id,
        createdBy: adminUser._id
      }
    ];

    const createdBudgets = await Budget.insertMany(budgetData);
    console.log('Budgets created: ' + createdBudgets.length);
    
    console.log('\nFinancial data seeded successfully!');
    console.log('Financial Summary:');
    console.log('   Total Revenue: ' + (2100000 + 750000));
    console.log('   Total Expenses: ' + (850000 + 650000));
    console.log('   Net Income: ' + ((2100000 + 750000) - (850000 + 650000)));
    console.log('   Cash & Bank: ' + 850000);
    console.log('   Accounts Receivable: ' + 1193000);
    
  } catch (error) {
    console.error('Financial seeding failed:', error);
    throw error;
  }
};

const main = async () => {
  await connectDB();
  await seedFinancialData();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

main().catch((error) => {
  console.error('Seeding process failed:', error);
  process.exit(1);
});
