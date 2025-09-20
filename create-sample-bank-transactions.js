import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BankAccount from './src/models/BankAccount.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected for bank transactions seeding');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const createSampleTransactions = async () => {
  try {
    await connectDB();
    
    console.log('🔍 Finding existing bank account...');
    
    // Find the existing bank account
    const bankAccount = await BankAccount.findOne({ accountNumber: 'SB0012345678' });
    
    if (!bankAccount) {
      console.log('❌ Bank account not found. Please run create-sample-bank-accounts.js first.');
      return;
    }
    
    console.log(`✅ Found bank account: ${bankAccount.accountName}`);
    console.log(`💰 Current balance: ₹${bankAccount.currentBalance.toLocaleString()}`);
    
    // Clear existing transactions
    bankAccount.transactions = [];
    bankAccount.currentBalance = bankAccount.openingBalance;
    
    console.log('🗑️ Cleared existing transactions');
    
    // Sample transactions data
    const sampleTransactions = [
      {
        transactionDate: new Date('2024-01-15'),
        description: 'Initial deposit',
        referenceNumber: 'INIT-001',
        creditAmount: 500000,
        debitAmount: 0,
        transactionType: 'Deposit',
        isReconciled: true,
        reconciledDate: new Date('2024-01-16')
      },
      {
        transactionDate: new Date('2024-01-20'),
        description: 'Hotel revenue deposit',
        referenceNumber: 'REV-001',
        creditAmount: 150000,
        debitAmount: 0,
        transactionType: 'Deposit',
        isReconciled: true,
        reconciledDate: new Date('2024-01-21')
      },
      {
        transactionDate: new Date('2024-01-25'),
        description: 'Utility bill payment',
        referenceNumber: 'UTIL-001',
        creditAmount: 0,
        debitAmount: 25000,
        transactionType: 'Withdrawal',
        isReconciled: true,
        reconciledDate: new Date('2024-01-26')
      },
      {
        transactionDate: new Date('2024-02-01'),
        description: 'Staff salary payment',
        referenceNumber: 'SAL-001',
        creditAmount: 0,
        debitAmount: 180000,
        transactionType: 'Withdrawal',
        isReconciled: true,
        reconciledDate: new Date('2024-02-02')
      },
      {
        transactionDate: new Date('2024-02-05'),
        description: 'Guest payment received',
        referenceNumber: 'GUEST-001',
        creditAmount: 75000,
        debitAmount: 0,
        transactionType: 'Deposit',
        isReconciled: true,
        reconciledDate: new Date('2024-02-06')
      },
      {
        transactionDate: new Date('2024-02-10'),
        description: 'Maintenance expense',
        referenceNumber: 'MAINT-001',
        creditAmount: 0,
        debitAmount: 45000,
        transactionType: 'Withdrawal',
        isReconciled: true,
        reconciledDate: new Date('2024-02-11')
      },
      {
        transactionDate: new Date('2024-02-15'),
        description: 'Bank interest earned',
        referenceNumber: 'INT-001',
        creditAmount: 2500,
        debitAmount: 0,
        transactionType: 'Interest',
        isReconciled: true,
        reconciledDate: new Date('2024-02-16')
      },
      {
        transactionDate: new Date('2024-02-20'),
        description: 'Monthly bank charges',
        referenceNumber: 'FEE-001',
        creditAmount: 0,
        debitAmount: 500,
        transactionType: 'Fee',
        isReconciled: false
      },
      {
        transactionDate: new Date('2024-02-25'),
        description: 'Corporate booking payment',
        referenceNumber: 'CORP-001',
        creditAmount: 200000,
        debitAmount: 0,
        transactionType: 'Deposit',
        isReconciled: false
      },
      {
        transactionDate: new Date('2024-02-28'),
        description: 'Inventory purchase',
        referenceNumber: 'INV-001',
        creditAmount: 0,
        debitAmount: 35000,
        transactionType: 'Withdrawal',
        isReconciled: false
      }
    ];
    
    console.log('💰 Adding sample transactions...');
    
    // Add each transaction
    for (const transactionData of sampleTransactions) {
      const transaction = await bankAccount.addTransaction(transactionData);
      console.log(`  ✅ Added: ${transaction.description} - ₹${(transaction.creditAmount || transaction.debitAmount).toLocaleString()}`);
    }
    
    console.log('');
    console.log('📊 Final account summary:');
    console.log(`  Account: ${bankAccount.accountName}`);
    console.log(`  Final Balance: ₹${bankAccount.currentBalance.toLocaleString()}`);
    console.log(`  Total Transactions: ${bankAccount.transactions.length}`);
    console.log(`  Reconciled: ${bankAccount.transactions.filter(t => t.isReconciled).length}`);
    console.log(`  Pending: ${bankAccount.transactions.filter(t => !t.isReconciled).length}`);
    
    console.log('');
    console.log('🎯 Sample transactions created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating transactions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

const main = async () => {
  await createSampleTransactions();
};

main();
