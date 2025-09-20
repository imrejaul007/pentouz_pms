import mongoose from "mongoose";

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI);

const roomSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, required: true },
  roomNumber: String,
  type: String,
  baseRate: Number,
  currentRate: Number,
  status: String,
  floor: Number,
  capacity: Number,
  amenities: [String],
  images: [String],
  description: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
});

const Room = mongoose.model("Room", roomSchema);

async function updateRoomFloors() {
  const hotelId = new mongoose.Types.ObjectId("68c7a39bc13a429a65a0e2c9");
  
  console.log("Updating room floor distribution...");
  
  const rooms = await Room.find({ hotelId, isActive: true }).sort({ roomNumber: 1 });
  console.log(`Found ${rooms.length} rooms to update`);
  
  const updates = [];
  
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const floor = Math.floor(i / 10) + 1;
    const roomOnFloor = (i % 10) + 1;
    const newRoomNumber = `${floor}${roomOnFloor.toString().padStart(2, "0")}`;
    
    let newStatus = "vacant";
    if (i % 15 === 0) newStatus = "occupied";
    else if (i % 12 === 0) newStatus = "maintenance";
    else if (i % 8 === 0) newStatus = "dirty";
    else if (i % 20 === 0) newStatus = "out_of_order";
    
    updates.push({
      updateOne: {
        filter: { _id: room._id },
        update: { 
          floor: floor, 
          roomNumber: newRoomNumber,
          status: newStatus
        }
      }
    });
  }
  
  if (updates.length > 0) {
    const result = await Room.bulkWrite(updates);
    console.log(`Updated ${result.modifiedCount} rooms`);
    
    const floorStats = await Room.aggregate([
      { $match: { hotelId, isActive: true } },
      { $group: { 
          _id: "$floor", 
          totalRooms: { $sum: 1 },
          statusBreakdown: { $push: "$status" }
        }},
      { $sort: { _id: 1 } }
    ]);
    
    console.log("\nFloor distribution:");
    floorStats.forEach(floor => {
      const statusCounts = floor.statusBreakdown.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      console.log(`Floor ${floor._id}: ${floor.totalRooms} rooms`, statusCounts);
    });
  }
  
  mongoose.disconnect();
}

updateRoomFloors().catch(console.error);
