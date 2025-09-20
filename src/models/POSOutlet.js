import mongoose from 'mongoose';

const posOutletSchema = new mongoose.Schema({
  outletId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['restaurant', 'bar', 'spa', 'gym', 'shop', 'room_service', 'minibar', 'banquet', 'parking'],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  operatingHours: {
    monday: { open: String, close: String, closed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
    friday: { open: String, close: String, closed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
    sunday: { open: String, close: String, closed: { type: Boolean, default: false } }
  },
  taxSettings: {
    defaultTaxRate: { type: Number, default: 0 },
    serviceTaxRate: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 }
  },
  paymentMethods: [{
    type: String,
    enum: ['cash', 'card', 'room_charge', 'voucher', 'comp']
  }],
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  staff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  settings: {
    allowRoomCharges: { type: Boolean, default: true },
    requireSignature: { type: Boolean, default: false },
    printReceipts: { type: Boolean, default: true },
    allowDiscounts: { type: Boolean, default: true },
    maxDiscountPercent: { type: Number, default: 20 }
  }
}, {
  timestamps: true
});

export default mongoose.model('POSOutlet', posOutletSchema);
