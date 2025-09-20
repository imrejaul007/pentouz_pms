console.log('Testing problematic imports...');

try {
  console.log('1. Testing ChannelManager...');
  const { Channel, InventorySync, ReservationMapping, RatePurityLog, ChannelPerformance, OverbookingRule } = await import('./src/models/ChannelManager.js');
  console.log('✓ ChannelManager imported');
} catch (err) {
  console.log('❌ ChannelManager failed:', err.message);
}

try {
  console.log('2. Testing CompetitorMonitoring...');
  const { CompetitorRate, Competitor, CompetitorAlert } = await import('./src/models/CompetitorMonitoring.js');
  console.log('✓ CompetitorMonitoring imported');
} catch (err) {
  console.log('❌ CompetitorMonitoring failed:', err.message);
}

try {
  console.log('3. Testing BookingEngine...');
  const { LoyaltyProgram, LandingPage } = await import('./src/models/BookingEngine.js');
  console.log('✓ BookingEngine imported');
} catch (err) {
  console.log('❌ BookingEngine failed:', err.message);
}

try {
  console.log('4. Testing DataWarehouse...');
  const { FactBookings, FactRevenue, DimDate, DimGuest, MonthlyRevenueAggregate, DataWarehouseHelpers } = await import('./src/models/analytics/DataWarehouse.js');
  console.log('✓ DataWarehouse imported');
} catch (err) {
  console.log('❌ DataWarehouse failed:', err.message);
}

try {
  console.log('5. Testing RateManagement...');
  const { RatePlan, RateOverride, SeasonalRate, DynamicPricing, YieldManagement, Package } = await import('./src/models/RateManagement.js');
  console.log('✓ RateManagement imported');
} catch (err) {
  console.log('❌ RateManagement failed:', err.message);
}

console.log('Import test completed!');