import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

// Load environment variables
dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const createHousekeepingStaff = async () => {
  try {
    console.log('👥 Creating housekeeping staff users...');

    // Get hotel
    const hotel = await Hotel.findOne();
    if (!hotel) {
      console.error('❌ No hotel found in database');
      return;
    }
    console.log(`✅ Found hotel: ${hotel.name}`);

    // Create housekeeping staff members
    const housekeepingStaffData = [
      {
        name: 'Maria Gonzalez',
        email: 'maria.housekeeping@hotel.com',
        password: 'staff123',
        role: 'staff',
        department: 'Housekeeping',
        position: 'Senior Housekeeper',
        shift: 'morning',
        phoneNumber: '+1-555-0101',
        emergencyContact: {
          name: 'Carlos Gonzalez',
          phone: '+1-555-0102'
        }
      },
      {
        name: 'Jennifer Chen',
        email: 'jennifer.housekeeping@hotel.com',
        password: 'staff123',
        role: 'staff',
        department: 'Housekeeping',
        position: 'Room Attendant',
        shift: 'morning',
        phoneNumber: '+1-555-0103',
        emergencyContact: {
          name: 'David Chen',
          phone: '+1-555-0104'
        }
      },
      {
        name: 'Robert Johnson',
        email: 'robert.housekeeping@hotel.com',
        password: 'staff123',
        role: 'staff',
        department: 'Housekeeping',
        position: 'Room Attendant',
        shift: 'afternoon',
        phoneNumber: '+1-555-0105',
        emergencyContact: {
          name: 'Sarah Johnson',
          phone: '+1-555-0106'
        }
      },
      {
        name: 'Priya Patel',
        email: 'priya.housekeeping@hotel.com',
        password: 'staff123',
        role: 'staff',
        department: 'Housekeeping',
        position: 'Laundry Supervisor',
        shift: 'morning',
        phoneNumber: '+1-555-0107',
        emergencyContact: {
          name: 'Raj Patel',
          phone: '+1-555-0108'
        }
      },
      {
        name: 'Ahmed Hassan',
        email: 'ahmed.housekeeping@hotel.com',
        password: 'staff123',
        role: 'staff',
        department: 'Housekeeping',
        position: 'Room Attendant',
        shift: 'afternoon',
        phoneNumber: '+1-555-0109',
        emergencyContact: {
          name: 'Fatima Hassan',
          phone: '+1-555-0110'
        }
      },
      {
        name: 'Lisa Thompson',
        email: 'lisa.housekeeping@hotel.com',
        password: 'staff123',
        role: 'staff',
        department: 'Housekeeping',
        position: 'Inspector',
        shift: 'morning',
        phoneNumber: '+1-555-0111',
        emergencyContact: {
          name: 'Michael Thompson',
          phone: '+1-555-0112'
        }
      }
    ];

    // Remove existing housekeeping staff to avoid duplicates
    await User.deleteMany({
      hotelId: hotel._id,
      email: { $in: housekeepingStaffData.map(staff => staff.email) }
    });

    const createdStaff = [];

    for (const staffData of housekeepingStaffData) {
      // Hash password
      const hashedPassword = await bcrypt.hash(staffData.password, 12);

      const staffUser = new User({
        name: staffData.name,
        email: staffData.email,
        password: hashedPassword,
        role: staffData.role,
        hotelId: hotel._id,
        guestType: 'normal',
        isActive: true,
        department: staffData.department,
        position: staffData.position,
        shift: staffData.shift,
        phoneNumber: staffData.phoneNumber,
        emergencyContact: staffData.emergencyContact,
        employmentDetails: {
          startDate: new Date('2024-01-01'),
          employmentType: 'full-time',
          status: 'active'
        },
        preferences: {
          smokingAllowed: false,
          workingAreas: ['floors_1-5', 'suites'],
          maxRoomsPerDay: staffData.position === 'Senior Housekeeper' ? 15 :
                          staffData.position === 'Inspector' ? 20 : 12
        }
      });

      await staffUser.save();
      createdStaff.push(staffUser);
      console.log(`✅ Created staff: ${staffData.name} (${staffData.position})`);
    }

    console.log(`\n🎉 Successfully created ${createdStaff.length} housekeeping staff members!`);

    // Show staff summary
    console.log('\n👥 Housekeeping Staff Summary:');
    createdStaff.forEach(staff => {
      console.log(`   ${staff.name} - ${staff.position} (${staff.shift} shift)`);
    });

    console.log('\n💡 You can now regenerate daily check assignments with proper staff members.');

  } catch (error) {
    console.error('❌ Error creating housekeeping staff:', error.message);
    console.error(error.stack);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await createHousekeepingStaff();

  // Close database connection
  await mongoose.connection.close();
  console.log('📴 Database connection closed');
  process.exit(0);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Run the script
main();