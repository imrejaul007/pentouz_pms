/**
 * Document System Seed Data Script
 *
 * This script will:
 * 1. Check existing data in the database
 * 2. Create seed data for document requirements
 * 3. Create sample documents for testing
 * 4. Establish proper connections between models
 */

import mongoose from 'mongoose';

// MongoDB connection
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

console.log('🌱 Document System Seeding Script Starting...\n');

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function checkExistingData() {
  console.log('\n🔍 Checking existing data...');

  try {
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('📊 Available collections:', collectionNames.length);

    // Check users
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('👥 Users found:', users.length);

    const guestUser = users.find(u => u.email === 'john@example.com');
    const staffUser = users.find(u => u.email === 'staff@hotel.com');
    const adminUser = users.find(u => u.role === 'admin');

    console.log('  - Guest user (john@example.com):', guestUser ? '✅ Found' : '❌ Missing');
    console.log('  - Staff user (staff@hotel.com):', staffUser ? '✅ Found' : '❌ Missing');
    console.log('  - Admin user:', adminUser ? `✅ Found (${adminUser.email})` : '❌ Missing');

    // Check documents
    const documents = await mongoose.connection.db.collection('documents').find({}).toArray();
    console.log('📄 Existing documents:', documents.length);

    // Check document requirements
    const requirements = await mongoose.connection.db.collection('documentrequirements').find({}).toArray();
    console.log('📋 Document requirements:', requirements.length);

    // Check bookings (for linking documents)
    const bookings = await mongoose.connection.db.collection('bookings').find({}).toArray();
    console.log('🏨 Existing bookings:', bookings.length);

    // Check departments (for staff documents)
    const departments = await mongoose.connection.db.collection('departments').find({}).toArray();
    console.log('🏢 Departments:', departments.length);

    return {
      users,
      guestUser,
      staffUser,
      adminUser,
      documents,
      requirements,
      bookings,
      departments,
      collections: collectionNames
    };

  } catch (error) {
    console.error('❌ Error checking existing data:', error.message);
    return null;
  }
}

async function createDocumentRequirements(data) {
  console.log('\n📋 Creating Document Requirements...');

  try {
    // Clear existing requirements to avoid duplicates
    await mongoose.connection.db.collection('documentrequirements').deleteMany({});

    const requirements = [
      // Guest Document Requirements
      {
        userType: 'guest',
        category: 'identity_proof',
        documentType: 'passport',
        name: 'Passport Verification',
        description: 'Valid passport for identity verification and international bookings',
        required: true,
        maxSizeMB: 5,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        expiryMonths: 60,
        applicableConditions: {
          bookingTypes: ['international', 'luxury'],
          minimumStayDays: 1
        },
        isCurrentlyActive: true,
        viewableByRoles: ['guest', 'staff', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userType: 'guest',
        category: 'identity_proof',
        documentType: 'drivers_license',
        name: 'Driver\'s License',
        description: 'Valid driver\'s license for identity verification',
        required: false,
        maxSizeMB: 3,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        expiryMonths: 24,
        applicableConditions: {
          bookingTypes: ['domestic']
        },
        isCurrentlyActive: true,
        viewableByRoles: ['guest', 'staff', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userType: 'guest',
        category: 'address_proof',
        documentType: 'utility_bill',
        name: 'Address Proof',
        description: 'Utility bill or bank statement for address verification',
        required: false,
        maxSizeMB: 3,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        expiryMonths: 3,
        applicableConditions: {
          bookingTypes: ['extended_stay']
        },
        isCurrentlyActive: true,
        viewableByRoles: ['guest', 'staff', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userType: 'guest',
        category: 'visa',
        documentType: 'tourist_visa',
        name: 'Tourist Visa',
        description: 'Valid tourist visa for international guests',
        required: true,
        maxSizeMB: 5,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        expiryMonths: 12,
        applicableConditions: {
          bookingTypes: ['international']
        },
        isCurrentlyActive: true,
        viewableByRoles: ['guest', 'staff', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // Staff Document Requirements
      {
        userType: 'staff',
        category: 'employment_verification',
        documentType: 'employment_contract',
        name: 'Employment Contract',
        description: 'Signed employment contract with terms and conditions',
        required: true,
        maxSizeMB: 10,
        allowedFormats: ['pdf'],
        expiryMonths: null,
        applicableConditions: {
          roles: ['staff'],
          departments: data.departments.map(d => d._id)
        },
        isCurrentlyActive: true,
        viewableByRoles: ['staff', 'admin'],
        departmentAccess: data.departments.map(d => d._id),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userType: 'staff',
        category: 'id_proof',
        documentType: 'national_id',
        name: 'National ID Card',
        description: 'Government issued national ID card for staff verification',
        required: true,
        maxSizeMB: 5,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        expiryMonths: 60,
        applicableConditions: {
          roles: ['staff']
        },
        isCurrentlyActive: true,
        viewableByRoles: ['staff', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userType: 'staff',
        category: 'training_certificate',
        documentType: 'hospitality_certification',
        name: 'Hospitality Training Certificate',
        description: 'Professional hospitality training certification',
        required: false,
        maxSizeMB: 5,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        expiryMonths: 24,
        applicableConditions: {
          roles: ['staff'],
          departments: data.departments.filter(d => d.name?.includes('Guest') || d.name?.includes('Service')).map(d => d._id)
        },
        isCurrentlyActive: true,
        viewableByRoles: ['staff', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userType: 'staff',
        category: 'health_certificate',
        documentType: 'medical_checkup',
        name: 'Medical Fitness Certificate',
        description: 'Annual medical fitness certificate for staff',
        required: true,
        maxSizeMB: 5,
        allowedFormats: ['pdf'],
        expiryMonths: 12,
        applicableConditions: {
          roles: ['staff']
        },
        isCurrentlyActive: true,
        viewableByRoles: ['staff', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userType: 'staff',
        category: 'background_check',
        documentType: 'criminal_background',
        name: 'Criminal Background Check',
        description: 'Police clearance certificate for background verification',
        required: true,
        maxSizeMB: 5,
        allowedFormats: ['pdf'],
        expiryMonths: 24,
        applicableConditions: {
          roles: ['staff']
        },
        isCurrentlyActive: true,
        viewableByRoles: ['admin'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await mongoose.connection.db.collection('documentrequirements').insertMany(requirements);
    console.log(`✅ Created ${result.insertedCount} document requirements`);

    return requirements;

  } catch (error) {
    console.error('❌ Error creating document requirements:', error.message);
    return [];
  }
}

async function createSampleDocuments(data) {
  console.log('\n📄 Creating Sample Documents...');

  try {
    // Clear existing documents to avoid duplicates
    await mongoose.connection.db.collection('documents').deleteMany({});

    const documents = [];

    // Create guest documents if guest user exists
    if (data.guestUser) {
      const guestDocs = [
        {
          originalName: 'passport_john_doe.pdf',
          fileName: 'passport_john_doe_' + Date.now() + '.pdf',
          filePath: '/uploads/guest/2024/09/passport_john_doe_' + Date.now() + '.pdf',
          category: 'identity_proof',
          documentType: 'passport',
          status: 'verified',
          userType: 'guest',
          userId: data.guestUser._id,
          bookingId: data.bookings.length > 0 ? data.bookings[0]._id : null,
          notes: 'Passport verified for international booking',
          verifiedAt: new Date(),
          verifiedBy: data.adminUser?._id || null,
          expiresAt: new Date(Date.now() + (60 * 30 * 24 * 60 * 60 * 1000)), // 60 months
          viewableByRoles: ['guest', 'staff', 'admin'],
          metadata: {
            size: 2048000,
            mimeType: 'application/pdf',
            uploadedFrom: 'web_app'
          },
          auditLog: [
            {
              action: 'uploaded',
              performedBy: data.guestUser._id,
              timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
              details: { originalName: 'passport_john_doe.pdf' }
            },
            {
              action: 'verified',
              performedBy: data.adminUser?._id || null,
              timestamp: new Date(),
              details: { notes: 'Document verified successfully' }
            }
          ],
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          updatedAt: new Date()
        },
        {
          originalName: 'address_proof_john.pdf',
          fileName: 'address_proof_john_' + Date.now() + '.pdf',
          filePath: '/uploads/guest/2024/09/address_proof_john_' + Date.now() + '.pdf',
          category: 'address_proof',
          documentType: 'utility_bill',
          status: 'pending',
          userType: 'guest',
          userId: data.guestUser._id,
          bookingId: data.bookings.length > 0 ? data.bookings[0]._id : null,
          notes: 'Address proof for extended stay booking',
          viewableByRoles: ['guest', 'staff', 'admin'],
          metadata: {
            size: 1536000,
            mimeType: 'application/pdf',
            uploadedFrom: 'web_app'
          },
          auditLog: [
            {
              action: 'uploaded',
              performedBy: data.guestUser._id,
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
              details: { originalName: 'address_proof_john.pdf' }
            }
          ],
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        }
      ];

      documents.push(...guestDocs);
    }

    // Create staff documents if staff user exists
    if (data.staffUser) {
      const staffDocs = [
        {
          originalName: 'employment_contract_staff.pdf',
          fileName: 'employment_contract_staff_' + Date.now() + '.pdf',
          filePath: '/uploads/staff/2024/09/employment_contract_staff_' + Date.now() + '.pdf',
          category: 'employment_verification',
          documentType: 'employment_contract',
          status: 'verified',
          userType: 'staff',
          userId: data.staffUser._id,
          departmentId: data.staffUser.departmentId || (data.departments.length > 0 ? data.departments[0]._id : null),
          notes: 'Employment contract verified for new staff member',
          verifiedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
          verifiedBy: data.adminUser?._id || null,
          viewableByRoles: ['staff', 'admin'],
          departmentAccess: [data.staffUser.departmentId || (data.departments.length > 0 ? data.departments[0]._id : null)],
          metadata: {
            size: 3072000,
            mimeType: 'application/pdf',
            uploadedFrom: 'staff_portal'
          },
          auditLog: [
            {
              action: 'uploaded',
              performedBy: data.staffUser._id,
              timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
              details: { originalName: 'employment_contract_staff.pdf' }
            },
            {
              action: 'verified',
              performedBy: data.adminUser?._id || null,
              timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
              details: { notes: 'Contract verified by HR' }
            }
          ],
          createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
        },
        {
          originalName: 'national_id_staff.jpg',
          fileName: 'national_id_staff_' + Date.now() + '.jpg',
          filePath: '/uploads/staff/2024/09/national_id_staff_' + Date.now() + '.jpg',
          category: 'id_proof',
          documentType: 'national_id',
          status: 'pending',
          userType: 'staff',
          userId: data.staffUser._id,
          departmentId: data.staffUser.departmentId || (data.departments.length > 0 ? data.departments[0]._id : null),
          notes: 'National ID for staff verification',
          viewableByRoles: ['staff', 'admin'],
          departmentAccess: [data.staffUser.departmentId || (data.departments.length > 0 ? data.departments[0]._id : null)],
          metadata: {
            size: 1024000,
            mimeType: 'image/jpeg',
            uploadedFrom: 'staff_portal',
            dimensions: { width: 1200, height: 800 }
          },
          auditLog: [
            {
              action: 'uploaded',
              performedBy: data.staffUser._id,
              timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
              details: { originalName: 'national_id_staff.jpg' }
            }
          ],
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
        },
        {
          originalName: 'medical_certificate_2024.pdf',
          fileName: 'medical_certificate_2024_' + Date.now() + '.pdf',
          filePath: '/uploads/staff/2024/09/medical_certificate_2024_' + Date.now() + '.pdf',
          category: 'health_certificate',
          documentType: 'medical_checkup',
          status: 'expired',
          userType: 'staff',
          userId: data.staffUser._id,
          departmentId: data.staffUser.departmentId || (data.departments.length > 0 ? data.departments[0]._id : null),
          notes: 'Annual medical checkup - needs renewal',
          verifiedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
          verifiedBy: data.adminUser?._id || null,
          expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
          viewableByRoles: ['staff', 'admin'],
          departmentAccess: [data.staffUser.departmentId || (data.departments.length > 0 ? data.departments[0]._id : null)],
          metadata: {
            size: 2560000,
            mimeType: 'application/pdf',
            uploadedFrom: 'staff_portal'
          },
          auditLog: [
            {
              action: 'uploaded',
              performedBy: data.staffUser._id,
              timestamp: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
              details: { originalName: 'medical_certificate_2024.pdf' }
            },
            {
              action: 'verified',
              performedBy: data.adminUser?._id || null,
              timestamp: new Date(Date.now() - 395 * 24 * 60 * 60 * 1000),
              details: { notes: 'Medical certificate approved', expiryMonths: 12 }
            },
            {
              action: 'expired',
              performedBy: null,
              timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              details: { reason: 'Document expired', autoAction: true }
            }
          ],
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      ];

      documents.push(...staffDocs);
    }

    if (documents.length > 0) {
      const result = await mongoose.connection.db.collection('documents').insertMany(documents);
      console.log(`✅ Created ${result.insertedCount} sample documents`);

      // Show summary
      const statusCounts = documents.reduce((acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      }, {});

      console.log('📊 Document status summary:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`);
      });
    }

    return documents;

  } catch (error) {
    console.error('❌ Error creating sample documents:', error.message);
    return [];
  }
}

async function createDefaultDepartmentsIfNeeded(data) {
  console.log('\n🏢 Checking Departments...');

  if (data.departments.length === 0) {
    console.log('Creating default departments...');

    const defaultDepartments = [
      {
        name: 'Front Office',
        description: 'Guest check-in, check-out, and front desk operations',
        code: 'FO',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Housekeeping',
        description: 'Room cleaning and maintenance services',
        code: 'HK',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Guest Services',
        description: 'Concierge and guest assistance services',
        code: 'GS',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Food & Beverage',
        description: 'Restaurant and catering services',
        code: 'FB',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Maintenance',
        description: 'Technical and facility maintenance',
        code: 'MT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await mongoose.connection.db.collection('departments').insertMany(defaultDepartments);
    console.log(`✅ Created ${result.insertedCount} default departments`);

    return defaultDepartments;
  } else {
    console.log(`✅ Found ${data.departments.length} existing departments`);
    return data.departments;
  }
}

async function updateModelConnections(data) {
  console.log('\n🔗 Updating Model Connections...');

  try {
    // Update staff user with department if not already assigned
    if (data.staffUser && !data.staffUser.departmentId && data.departments.length > 0) {
      await mongoose.connection.db.collection('users').updateOne(
        { _id: data.staffUser._id },
        {
          $set: {
            departmentId: data.departments[0]._id,
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ Assigned department to staff user');
    }

    // Create indexes for better performance
    await createIndexes();

    console.log('✅ Model connections updated successfully');

  } catch (error) {
    console.error('❌ Error updating model connections:', error.message);
  }
}

async function createIndexes() {
  console.log('\n📊 Creating Database Indexes...');

  try {
    // Document indexes
    await mongoose.connection.db.collection('documents').createIndex({ userId: 1, userType: 1 });
    await mongoose.connection.db.collection('documents').createIndex({ status: 1 });
    await mongoose.connection.db.collection('documents').createIndex({ category: 1, documentType: 1 });
    await mongoose.connection.db.collection('documents').createIndex({ departmentId: 1 });
    await mongoose.connection.db.collection('documents').createIndex({ bookingId: 1 });
    await mongoose.connection.db.collection('documents').createIndex({ expiresAt: 1 });
    await mongoose.connection.db.collection('documents').createIndex({ createdAt: -1 });

    // DocumentRequirement indexes
    await mongoose.connection.db.collection('documentrequirements').createIndex({ userType: 1, isCurrentlyActive: 1 });
    await mongoose.connection.db.collection('documentrequirements').createIndex({ category: 1, documentType: 1 });

    console.log('✅ Database indexes created');

  } catch (error) {
    console.log('⚠️ Some indexes might already exist:', error.message);
  }
}

async function generateSummaryReport(data, requirements, documents) {
  console.log('\n📊 DOCUMENT SYSTEM SEED SUMMARY:');
  console.log('=' * 50);

  console.log('\n📁 Database Collections:');
  console.log(`  - Total collections: ${data.collections.length}`);
  console.log(`  - Documents collection: ${data.collections.includes('documents') ? '✅' : '❌'}`);
  console.log(`  - DocumentRequirements collection: ${data.collections.includes('documentrequirements') ? '✅' : '❌'}`);

  console.log('\n👥 Users:');
  console.log(`  - Total users: ${data.users.length}`);
  console.log(`  - Guest user: ${data.guestUser ? '✅' : '❌'}`);
  console.log(`  - Staff user: ${data.staffUser ? '✅' : '❌'}`);
  console.log(`  - Admin user: ${data.adminUser ? '✅' : '❌'}`);

  console.log('\n📋 Document Requirements:');
  console.log(`  - Total requirements: ${requirements.length}`);
  const guestReqs = requirements.filter(r => r.userType === 'guest');
  const staffReqs = requirements.filter(r => r.userType === 'staff');
  console.log(`  - Guest requirements: ${guestReqs.length}`);
  console.log(`  - Staff requirements: ${staffReqs.length}`);

  console.log('\n📄 Sample Documents:');
  console.log(`  - Total documents: ${documents.length}`);
  const guestDocs = documents.filter(d => d.userType === 'guest');
  const staffDocs = documents.filter(d => d.userType === 'staff');
  console.log(`  - Guest documents: ${guestDocs.length}`);
  console.log(`  - Staff documents: ${staffDocs.length}`);

  const statusCounts = documents.reduce((acc, doc) => {
    acc[doc.status] = (acc[doc.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Document Status Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });

  console.log('\n🏢 Departments:');
  console.log(`  - Total departments: ${data.departments.length}`);

  console.log('\n🏨 Bookings:');
  console.log(`  - Total bookings: ${data.bookings.length}`);

  console.log('\n🎯 SYSTEM STATUS: READY FOR TESTING!');
  console.log('\n📋 Next Steps:');
  console.log('1. ✅ Database seeded with sample data');
  console.log('2. ✅ Document requirements configured');
  console.log('3. ✅ Sample documents created for testing');
  console.log('4. ✅ Model connections established');
  console.log('5. 🚀 Ready for frontend testing!');

  console.log('\n🧪 Test the system with:');
  console.log('- Guest Login: john@example.com / guest123');
  console.log('- Staff Login: staff@hotel.com / staff123');
  console.log('- Navigate to Documents section in each interface');
  console.log('- Test document upload and management features');
}

async function main() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      process.exit(1);
    }

    // Check existing data
    const data = await checkExistingData();
    if (!data) {
      process.exit(1);
    }

    // Create departments if needed
    data.departments = await createDefaultDepartmentsIfNeeded(data);

    // Create document requirements
    const requirements = await createDocumentRequirements(data);

    // Create sample documents
    const documents = await createSampleDocuments(data);

    // Update model connections
    await updateModelConnections(data);

    // Generate summary report
    await generateSummaryReport(data, requirements, documents);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the seeding script
main();