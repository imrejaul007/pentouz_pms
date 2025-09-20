import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RoomType from './src/models/RoomType.js';

dotenv.config();

async function updateRoomSettings() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const hotelId = '68bc094f80c86bfe258e172b';
    const roomTypes = await RoomType.find({ hotelId });

    console.log(`Found ${roomTypes.length} room types for hotel ${hotelId}`);

    // Update each room type with different overbooking settings
    const updates = [
      { 
        name: 'Standard Room',
        settings: { 
          allowOverbooking: true, 
          overbookingLimit: 4, 
          requiresApproval: false 
        }
      },
      { 
        name: 'Deluxe Room',
        settings: { 
          allowOverbooking: false, 
          overbookingLimit: 0, 
          requiresApproval: false 
        }
      },
      { 
        name: 'Executive Deluxe',
        settings: { 
          allowOverbooking: true, 
          overbookingLimit: 2, 
          requiresApproval: true 
        }
      },
      { 
        name: 'Premium Suite',
        settings: { 
          allowOverbooking: true, 
          overbookingLimit: 1, 
          requiresApproval: true 
        }
      }
    ];

    for (const update of updates) {
      const roomType = roomTypes.find(rt => rt.name === update.name);
      if (roomType) {
        roomType.settings = update.settings;
        await roomType.save();
        console.log(`Updated ${update.name} with settings:`, update.settings);
      } else {
        console.log(`Room type ${update.name} not found`);
      }
    }

    // Verify updates
    console.log('\n--- Verification ---');
    const updatedRoomTypes = await RoomType.find({ hotelId });
    updatedRoomTypes.forEach(rt => {
      console.log(`${rt.name}: ${JSON.stringify(rt.settings)}`);
    });

    console.log('\nRoom settings updated successfully!');
  } catch (error) {
    console.error('Error updating room settings:', error);
  } finally {
    mongoose.disconnect();
  }
}

updateRoomSettings();