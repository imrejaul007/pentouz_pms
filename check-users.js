import mongoose from 'mongoose';
import User from './src/models/User.js';
import 'dotenv/config';

async function checkUsers() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const users = await User.find({}, 'name email role isActive').lean();
        console.log('\n📋 All Users in System:');
        console.log('=' .repeat(50));

        users.forEach(user => {
            console.log(`${user.name} (${user.email}) - Role: ${user.role} - Active: ${user.isActive}`);
        });

        console.log('\n📊 User Statistics:');
        console.log(`Total Users: ${users.length}`);
        console.log(`Guest Users: ${users.filter(u => u.role === 'guest').length}`);
        console.log(`Staff Users: ${users.filter(u => u.role === 'staff').length}`);
        console.log(`Admin Users: ${users.filter(u => u.role === 'admin').length}`);
        console.log(`Manager Users: ${users.filter(u => u.role === 'manager').length}`);

        await mongoose.disconnect();
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

checkUsers();