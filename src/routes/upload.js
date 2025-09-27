import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import { cloudinaryStorage, deleteCloudinaryImage } from '../config/cloudinary.js';

const router = express.Router();

// Ensure uploads directory exists
const createUploadDirectory = () => {
  const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
  if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
  }
};

createUploadDirectory();

// Use Cloudinary storage if configured, otherwise fallback to local storage
const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

const storage = useCloudinary ? cloudinaryStorage : multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'avatars'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user._id}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new ApplicationError('Only image files are allowed', 400));
    }
  }
});

// Apply authentication to all routes
router.use(authenticate);

// Upload avatar endpoint
router.post('/avatar', upload.single('avatar'), catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new ApplicationError('No file uploaded', 400));
  }

  // Generate URL for the uploaded file
  const avatarUrl = useCloudinary ? req.file.path : `/uploads/avatars/${req.file.filename}`;

  // Delete old avatar before updating
  if (req.user.avatar) {
    if (useCloudinary) {
      await deleteCloudinaryImage(req.user.avatar);
    } else if (req.user.avatar.startsWith('/uploads/avatars/')) {
      const oldAvatarPath = path.join(process.cwd(), req.user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }
  }

  // Update user's avatar in database
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: avatarUrl },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Avatar uploaded successfully',
    data: {
      avatarUrl,
      user
    }
  });
}));

// Delete avatar endpoint
router.delete('/avatar', catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user.avatar) {
    return next(new ApplicationError('No avatar to delete', 400));
  }

  // Delete avatar file
  if (useCloudinary) {
    await deleteCloudinaryImage(user.avatar);
  } else if (user.avatar.startsWith('/uploads/avatars/')) {
    const avatarPath = path.join(process.cwd(), user.avatar);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }
  }

  // Remove avatar from database
  user.avatar = null;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Avatar deleted successfully'
  });
}));

export default router;