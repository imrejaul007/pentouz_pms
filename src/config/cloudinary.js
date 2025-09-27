import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for multer
export const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hotel-avatars', // Folder in Cloudinary
    format: async (req, file) => {
      // Support multiple formats
      const allowedFormats = ['jpg', 'png', 'jpeg', 'webp'];
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      return allowedFormats.includes(fileExtension) ? fileExtension : 'jpg';
    },
    public_id: (req, file) => {
      // Generate unique filename with user ID
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      return `avatar-${req.user._id}-${timestamp}-${random}`;
    },
    transformation: [
      {
        width: 400,
        height: 400,
        crop: 'fill',
        quality: 'auto',
        format: 'auto'
      }
    ]
  }
});

// Helper function to delete old avatar from Cloudinary
export const deleteCloudinaryImage = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
      return; // Not a Cloudinary image
    }

    // Extract public ID from Cloudinary URL
    const urlParts = imageUrl.split('/');
    const fileWithExtension = urlParts[urlParts.length - 1];
    const publicId = `hotel-avatars/${fileWithExtension.split('.')[0]}`;

    const result = await cloudinary.uploader.destroy(publicId);
    console.log('Old avatar deleted from Cloudinary:', result);
    return result;
  } catch (error) {
    console.error('Error deleting old avatar from Cloudinary:', error);
  }
};

// Helper function to get optimized avatar URL
export const getOptimizedAvatarUrl = (publicId, options = {}) => {
  const defaultOptions = {
    width: 200,
    height: 200,
    crop: 'fill',
    quality: 'auto',
    format: 'auto'
  };

  const finalOptions = { ...defaultOptions, ...options };

  return cloudinary.url(publicId, finalOptions);
};

export default cloudinary;