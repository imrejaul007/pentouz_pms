import mongoose from 'mongoose';
import TapeChart from './src/models/TapeChart.js';
import Room from './src/models/Room.js';

async function setupTapeChart() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // Check existing data
    const views = await TapeChart.TapeChartView.find({});
    console.log('📊 Existing TapeChart Views:', views.length);

    const configs = await TapeChart.RoomConfiguration.find({});
    console.log('🏠 Existing Room Configurations:', configs.length);

    const rooms = await Room.find({ isActive: true });
    console.log('🏨 Active Rooms:', rooms.length);

    // Create default view if none exists
    if (views.length === 0) {
      console.log('🆕 Creating default tape chart view...');
      const defaultView = new TapeChart.TapeChartView({
        viewName: 'Default 7-Day View',
        viewType: 'daily',
        dateRange: {
          defaultDays: 7
        },
        displaySettings: {
          showWeekends: true,
          colorCoding: {
            available: '#10B981',
            occupied: '#EF4444',
            reserved: '#F59E0B',
            maintenance: '#8B5CF6',
            out_of_order: '#6B7280',
            dirty: '#F97316',
            clean: '#3B82F6'
          },
          roomSorting: 'room_number',
          showGuestNames: true,
          showRoomTypes: true,
          showRates: false,
          compactView: false
        },
        filters: {},
        isSystemDefault: true,
        createdBy: new mongoose.Types.ObjectId()
      });

      await defaultView.save();
      console.log('✅ Default view created with ID:', defaultView._id);
    } else {
      console.log('✅ Views already exist');
    }

    // Test chart data generation with first view
    const firstView = await TapeChart.TapeChartView.findOne({});
    if (firstView) {
      console.log('🧪 Testing chart data generation...');
      const TapeChartService = (await import('./src/services/tapeChartService.js')).default;
      const service = new TapeChartService();

      const today = new Date();
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      try {
        const chartData = await service.generateTapeChartData(firstView._id, {
          startDate: today.toISOString().split('T')[0],
          endDate: weekFromNow.toISOString().split('T')[0]
        });

        console.log('✅ Chart data generated successfully');
        console.log('📈 Rooms in chart:', chartData.rooms.length);
        console.log('📊 Summary:', chartData.summary);

        if (chartData.rooms.length > 0) {
          console.log('🏠 First room example:', {
            roomNumber: chartData.rooms[0].config.roomNumber,
            currentStatus: chartData.rooms[0].currentStatus,
            timelineLength: chartData.rooms[0].timeline.length
          });
        }
      } catch (error) {
        console.error('❌ Chart data generation failed:', error.message);
      }
    }

    await mongoose.disconnect();
    console.log('✅ Test completed');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupTapeChart();