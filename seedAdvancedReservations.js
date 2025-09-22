import mongoose from 'mongoose';
import AdvancedReservation from './src/models/AdvancedReservation.js';
import RoomUpgrade from './src/models/RoomUpgrade.js';
import VIPGuest from './src/models/VIPGuest.js';
import WaitingList from './src/models/WaitingList.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';
const HOTEL_ID = '68cd01414419c17b5f6b4c12';

async function seedAdvancedReservations() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data for this hotel
    console.log('🧹 Clearing existing data...');
    await AdvancedReservation.deleteMany({ hotelId: HOTEL_ID });
    await RoomUpgrade.deleteMany({ hotelId: HOTEL_ID });
    await VIPGuest.deleteMany({ hotelId: HOTEL_ID });
    await WaitingList.deleteMany({ hotelId: HOTEL_ID });
    console.log('✅ Existing data cleared');

    // Create dummy user ID for createdBy fields
    const dummyUserId = new mongoose.Types.ObjectId();
    const vipGuestId = new mongoose.Types.ObjectId();

    // 1. CREATE VIP GUEST (1 record)
    console.log('👑 Creating VIP Guest...');
    const vipGuest = new VIPGuest({
      _id: vipGuestId,
      guestId: new mongoose.Types.ObjectId(),
      hotelId: HOTEL_ID,
      vipLevel: 'platinum',
      status: 'active',
      benefits: {
        roomUpgrade: true,
        lateCheckout: true,
        earlyCheckin: true,
        complimentaryBreakfast: true,
        spaAccess: true,
        conciergeService: true,
        priorityReservation: true,
        welcomeAmenities: true,
        airportTransfer: true,
        diningDiscount: 20,
        spaDiscount: 15
      },
      qualificationCriteria: {
        totalStays: 18,
        totalNights: 45,
        totalSpent: 85000,
        averageRating: 4.7,
        lastStayDate: new Date('2024-08-15')
      },
      loyaltyProgram: {
        currentTier: 'platinum',
        pointsBalance: 15000,
        pointsEarned: 25000,
        pointsRedeemed: 10000,
        membershipStartDate: new Date('2022-01-15')
      },
      recognition: {
        recognitionLevel: 'distinguished',
        recognitionScore: 92,
        lifetimeValue: 125000,
        averageRating: 4.7,
        feedbackCount: 15,
        complaintCount: 1,
        complimentCount: 8
      },
      createdBy: dummyUserId,
      notes: 'Platinum VIP member with exceptional loyalty. Prefers suites with ocean view.'
    });
    await vipGuest.save();
    console.log('✅ VIP Guest created');

    // 2. CREATE ADVANCED RESERVATIONS (5 total - 1 VIP)
    console.log('📅 Creating Advanced Reservations...');

    const bookingIds = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId()
    ];

    const advancedReservations = [
      // VIP Reservation
      {
        reservationId: `ADV${Date.now()}001`,
        bookingId: bookingIds[0],
        hotelId: HOTEL_ID,
        reservationType: 'vip',
        priority: 'vip',
        status: 'confirmed',
        roomPreferences: {
          preferredRooms: ['1201', '1202'],
          floor: 12,
          roomView: 'ocean',
          smokingPreference: 'non-smoking',
          bedType: 'king',
          quietRoom: true
        },
        guestProfile: {
          vipStatus: true,
          loyaltyTier: 'platinum',
          preferences: {
            temperature: 22,
            pillow: 'firm',
            newspaper: 'Financial Times',
            wakeupCall: true,
            turndownService: true,
            miniBarStocking: ['champagne', 'caviar', 'premium water']
          },
          allergies: ['shellfish'],
          specialNeeds: ['accessibility features'],
          dietaryRestrictions: ['gluten-free'],
          communicationPreferences: {
            language: 'en',
            contactMethod: 'email'
          }
        },
        specialRequests: [
          {
            type: 'celebration',
            description: 'Anniversary celebration setup with champagne and flowers',
            priority: 'high',
            status: 'confirmed',
            estimatedCost: 2500,
            assignedDepartment: 'concierge'
          },
          {
            type: 'dining',
            description: 'Private dinner reservation at rooftop restaurant',
            priority: 'medium',
            status: 'pending',
            estimatedCost: 8000,
            assignedDepartment: 'f&b'
          }
        ],
        upgrades: [
          {
            fromRoomType: 'Deluxe Suite',
            toRoomType: 'Presidential Suite',
            upgradeType: 'vip_courtesy',
            charges: 0,
            approval: 'approved',
            reason: 'VIP courtesy upgrade for anniversary celebration'
          }
        ],
        reservationFlags: {
          isVIP: true,
          requiresApproval: true,
          hasUpgrade: true,
          hasSpecialRequests: true,
          hasDietaryRestrictions: true,
          hasAccessibilityNeeds: true,
          hasAllergies: true,
          requiresConcierge: true
        },
        createdBy: dummyUserId
      },

      // Corporate Reservation with Upgrade
      {
        reservationId: `ADV${Date.now()}002`,
        bookingId: bookingIds[1],
        hotelId: HOTEL_ID,
        reservationType: 'corporate',
        priority: 'high',
        status: 'confirmed',
        roomPreferences: {
          floor: 8,
          roomView: 'city',
          smokingPreference: 'non-smoking',
          bedType: 'king'
        },
        guestProfile: {
          vipStatus: false,
          loyaltyTier: 'gold',
          preferences: {
            temperature: 21,
            pillow: 'medium',
            wakeupCall: true
          },
          communicationPreferences: {
            language: 'en',
            contactMethod: 'email'
          }
        },
        specialRequests: [
          {
            type: 'business',
            description: 'Business center access and meeting room booking',
            priority: 'medium',
            status: 'confirmed',
            estimatedCost: 1200,
            assignedDepartment: 'business_center'
          }
        ],
        upgrades: [
          {
            fromRoomType: 'Executive Room',
            toRoomType: 'Deluxe Suite',
            upgradeType: 'paid',
            charges: 3500,
            approval: 'approved',
            reason: 'Corporate client requested suite for important meetings'
          }
        ],
        reservationFlags: {
          isVIP: false,
          requiresApproval: true,
          hasUpgrade: true,
          hasSpecialRequests: true,
          isGroupBooking: false
        },
        createdBy: dummyUserId
      },

      // Group Booking
      {
        reservationId: `ADV${Date.now()}003`,
        bookingId: bookingIds[2],
        hotelId: HOTEL_ID,
        reservationType: 'group',
        priority: 'medium',
        status: 'pending',
        roomPreferences: {
          adjacentRooms: true,
          floor: 5,
          smokingPreference: 'non-smoking'
        },
        guestProfile: {
          vipStatus: false,
          loyaltyTier: 'silver',
          communicationPreferences: {
            language: 'en',
            contactMethod: 'phone'
          }
        },
        specialRequests: [
          {
            type: 'celebration',
            description: 'Wedding party accommodation with group dining arrangement',
            priority: 'high',
            status: 'pending',
            estimatedCost: 5000,
            assignedDepartment: 'f&b'
          }
        ],
        reservationFlags: {
          isVIP: false,
          requiresApproval: true,
          hasSpecialRequests: true,
          isGroupBooking: true
        },
        createdBy: dummyUserId
      },

      // Loyalty Reservation
      {
        reservationId: `ADV${Date.now()}004`,
        bookingId: bookingIds[3],
        hotelId: HOTEL_ID,
        reservationType: 'loyalty',
        priority: 'medium',
        status: 'confirmed',
        roomPreferences: {
          roomView: 'garden',
          smokingPreference: 'non-smoking',
          bedType: 'queen'
        },
        guestProfile: {
          vipStatus: false,
          loyaltyTier: 'gold',
          preferences: {
            temperature: 20,
            pillow: 'soft'
          },
          communicationPreferences: {
            language: 'en',
            contactMethod: 'sms'
          }
        },
        specialRequests: [
          {
            type: 'amenity',
            description: 'Welcome fruit basket and loyalty member amenities',
            priority: 'low',
            status: 'confirmed',
            estimatedCost: 500,
            assignedDepartment: 'housekeeping'
          }
        ],
        reservationFlags: {
          isVIP: false,
          hasSpecialRequests: true
        },
        createdBy: dummyUserId
      },

      // Standard Reservation
      {
        reservationId: `ADV${Date.now()}005`,
        bookingId: bookingIds[4],
        hotelId: HOTEL_ID,
        reservationType: 'standard',
        priority: 'medium',
        status: 'pending',
        roomPreferences: {
          smokingPreference: 'non-smoking',
          bedType: 'twin'
        },
        guestProfile: {
          vipStatus: false,
          loyaltyTier: 'member',
          communicationPreferences: {
            language: 'en',
            contactMethod: 'email'
          }
        },
        reservationFlags: {
          isVIP: false
        },
        createdBy: dummyUserId
      }
    ];

    const savedReservations = [];
    for (const reservation of advancedReservations) {
      const savedReservation = new AdvancedReservation(reservation);
      await savedReservation.save();
      savedReservations.push(savedReservation);
    }
    console.log('✅ 5 Advanced Reservations created');

    // 3. CREATE ROOM UPGRADES (2 total)
    console.log('⬆️ Creating Room Upgrades...');

    const roomUpgrades = [
      // VIP Complimentary Upgrade
      {
        upgradeId: `UPG${Date.now()}001`,
        bookingId: bookingIds[0],
        advancedReservationId: savedReservations[0]._id,
        hotelId: HOTEL_ID,
        fromRoomType: 'Deluxe Suite',
        toRoomType: 'Presidential Suite',
        fromRoomNumber: '1001',
        toRoomNumber: '1201',
        upgradeType: 'vip_courtesy',
        status: 'confirmed',
        eligibilityScore: 95,
        pricing: {
          originalRate: 15000,
          upgradedRate: 25000,
          upgradeCharge: 10000,
          discountApplied: 10000,
          finalCharge: 0,
          currency: 'INR'
        },
        approvalWorkflow: {
          requiresApproval: true,
          approvalLevel: 'manager',
          currentStage: 'completed',
          approvedBy: dummyUserId,
          approvedAt: new Date(),
          approvalComments: 'VIP courtesy upgrade approved for anniversary celebration'
        },
        availability: {
          isAvailable: true,
          availabilityCheckedAt: new Date()
        },
        analytics: {
          revenueImpact: 0,
          customerSatisfactionScore: 95,
          operationalComplexity: 40,
          conversionProbability: 100
        },
        createdBy: dummyUserId,
        reason: 'VIP anniversary celebration - complimentary presidential suite upgrade'
      },

      // Corporate Paid Upgrade
      {
        upgradeId: `UPG${Date.now()}002`,
        bookingId: bookingIds[1],
        advancedReservationId: savedReservations[1]._id,
        hotelId: HOTEL_ID,
        fromRoomType: 'Executive Room',
        toRoomType: 'Deluxe Suite',
        fromRoomNumber: '801',
        toRoomNumber: '805',
        upgradeType: 'paid',
        status: 'approved',
        eligibilityScore: 75,
        pricing: {
          originalRate: 8000,
          upgradedRate: 12000,
          upgradeCharge: 4000,
          discountApplied: 500,
          finalCharge: 3500,
          currency: 'INR'
        },
        approvalWorkflow: {
          requiresApproval: true,
          approvalLevel: 'supervisor',
          currentStage: 'completed',
          approvedBy: dummyUserId,
          approvedAt: new Date(),
          approvalComments: 'Corporate upgrade approved for meeting requirements'
        },
        availability: {
          isAvailable: true,
          availabilityCheckedAt: new Date()
        },
        analytics: {
          revenueImpact: 3500,
          customerSatisfactionScore: 80,
          operationalComplexity: 25,
          conversionProbability: 90
        },
        createdBy: dummyUserId,
        reason: 'Corporate client needs suite for business meetings'
      }
    ];

    for (const upgrade of roomUpgrades) {
      const savedUpgrade = new RoomUpgrade(upgrade);
      await savedUpgrade.save();
    }
    console.log('✅ 2 Room Upgrades created');

    // 4. CREATE WAITLIST ENTRIES (5 total)
    console.log('⏳ Creating Waitlist Entries...');

    const waitlistEntries = [
      {
        guestName: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+1-555-0123',
        roomType: 'Presidential Suite',
        hotelId: HOTEL_ID,
        preferredDates: {
          checkIn: new Date('2024-10-15'),
          checkOut: new Date('2024-10-18')
        },
        guests: 2,
        priority: 'high',
        vipStatus: true,
        loyaltyTier: 'Diamond',
        specialRequests: 'Anniversary suite with champagne service',
        maxRate: 30000,
        status: 'active',
        vipIntegration: {
          vipGuestId: vipGuestId,
          loyaltyPoints: 8500,
          totalStays: 12,
          totalSpent: 95000,
          memberSince: new Date('2022-03-15')
        },
        priority_score: 95,
        engagement_score: 85,
        analytics: {
          conversionProbability: 85,
          revenueValue: 76500,
          waitTimeToleranceScore: 90,
          competitorRisk: 'medium'
        }
      },

      {
        guestName: 'Michael Chen',
        email: 'michael.chen@corp.com',
        phone: '+1-555-0456',
        roomType: 'Deluxe Suite',
        hotelId: HOTEL_ID,
        preferredDates: {
          checkIn: new Date('2024-10-20'),
          checkOut: new Date('2024-10-23')
        },
        guests: 1,
        priority: 'medium',
        vipStatus: false,
        loyaltyTier: 'Platinum',
        specialRequests: 'Business traveler - needs workspace and late checkout',
        maxRate: 18000,
        status: 'active',
        vipIntegration: {
          loyaltyPoints: 5200,
          totalStays: 8,
          totalSpent: 45000,
          memberSince: new Date('2023-01-10')
        },
        priority_score: 72,
        engagement_score: 65,
        analytics: {
          conversionProbability: 75,
          revenueValue: 40500,
          waitTimeToleranceScore: 70,
          competitorRisk: 'low'
        }
      },

      {
        guestName: 'Emma Rodriguez',
        email: 'emma.rodriguez@email.com',
        phone: '+1-555-0789',
        roomType: 'Executive Room',
        hotelId: HOTEL_ID,
        preferredDates: {
          checkIn: new Date('2024-10-25'),
          checkOut: new Date('2024-10-27')
        },
        guests: 2,
        priority: 'medium',
        vipStatus: false,
        loyaltyTier: 'Gold',
        specialRequests: 'Quiet room with city view',
        maxRate: 12000,
        status: 'active',
        vipIntegration: {
          loyaltyPoints: 2800,
          totalStays: 5,
          totalSpent: 22000,
          memberSince: new Date('2023-06-01')
        },
        priority_score: 58,
        engagement_score: 55,
        analytics: {
          conversionProbability: 68,
          revenueValue: 16320,
          waitTimeToleranceScore: 60,
          competitorRisk: 'low'
        }
      },

      {
        guestName: 'David Kim',
        email: 'david.kim@email.com',
        phone: '+1-555-0321',
        roomType: 'Deluxe Room',
        hotelId: HOTEL_ID,
        preferredDates: {
          checkIn: new Date('2024-11-01'),
          checkOut: new Date('2024-11-03')
        },
        guests: 3,
        priority: 'low',
        vipStatus: false,
        loyaltyTier: 'Silver',
        specialRequests: 'Family room with extra bed',
        maxRate: 8000,
        status: 'active',
        vipIntegration: {
          loyaltyPoints: 1200,
          totalStays: 3,
          totalSpent: 12000,
          memberSince: new Date('2024-02-15')
        },
        priority_score: 42,
        engagement_score: 40,
        analytics: {
          conversionProbability: 55,
          revenueValue: 8800,
          waitTimeToleranceScore: 45,
          competitorRisk: 'medium'
        }
      },

      {
        guestName: 'Lisa Thompson',
        email: 'lisa.thompson@email.com',
        phone: '+1-555-0654',
        roomType: 'Standard Room',
        hotelId: HOTEL_ID,
        preferredDates: {
          checkIn: new Date('2024-11-05'),
          checkOut: new Date('2024-11-07')
        },
        guests: 1,
        priority: 'low',
        vipStatus: false,
        loyaltyTier: 'Bronze',
        specialRequests: 'Budget-conscious traveler',
        maxRate: 5000,
        status: 'active',
        vipIntegration: {
          loyaltyPoints: 500,
          totalStays: 2,
          totalSpent: 6000,
          memberSince: new Date('2024-05-01')
        },
        priority_score: 35,
        engagement_score: 30,
        analytics: {
          conversionProbability: 45,
          revenueValue: 4500,
          waitTimeToleranceScore: 40,
          competitorRisk: 'high'
        }
      }
    ];

    for (const entry of waitlistEntries) {
      const waitlistEntry = new WaitingList(entry);
      await waitlistEntry.save();
    }
    console.log('✅ 5 Waitlist entries created');

    // 5. VERIFICATION - Check counts match screenshot requirements
    console.log('\n🔍 VERIFICATION - Checking counts...');

    const reservationCount = await AdvancedReservation.countDocuments({ hotelId: HOTEL_ID });
    const upgradeCount = await RoomUpgrade.countDocuments({
      hotelId: HOTEL_ID,
      status: { $in: ['approved', 'confirmed'] }
    });
    const waitlistCount = await WaitingList.countDocuments({
      hotelId: HOTEL_ID,
      status: 'active'
    });
    const vipCount = await AdvancedReservation.countDocuments({
      hotelId: HOTEL_ID,
      'guestProfile.vipStatus': true
    });

    console.log('\n📊 FINAL COUNTS:');
    console.log(`✅ Total Reservations: ${reservationCount} (Expected: 5)`);
    console.log(`✅ Upgrades: ${upgradeCount} (Expected: 2)`);
    console.log(`✅ Waitlist: ${waitlistCount} (Expected: 5)`);
    console.log(`✅ VIP Reservations: ${vipCount} (Expected: 1)`);

    // Additional verification
    const vipGuestCount = await VIPGuest.countDocuments({ hotelId: HOTEL_ID, status: 'active' });
    console.log(`✅ VIP Guests: ${vipGuestCount} (Expected: 1)`);

    if (reservationCount === 5 && upgradeCount === 2 && waitlistCount === 5 && vipCount === 1) {
      console.log('\n🎉 SUCCESS! All counts match screenshot requirements perfectly!');
      console.log('\n📋 Summary:');
      console.log('   • 5 Advanced Reservations created (1 VIP, 1 Corporate, 1 Group, 1 Loyalty, 1 Standard)');
      console.log('   • 2 Room Upgrades created (1 VIP courtesy, 1 Corporate paid)');
      console.log('   • 5 Waitlist entries created (various priority levels)');
      console.log('   • 1 VIP Guest record created (Platinum tier)');
      console.log('\n🚀 Database is now ready! The Advanced Reservations page should show real data instead of mock data.');
    } else {
      console.log('\n❌ ERROR: Counts do not match requirements!');
    }

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding
seedAdvancedReservations();