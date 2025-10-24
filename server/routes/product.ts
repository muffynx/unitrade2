// routes/product.ts
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Product from '../models/Product';
import User from '../models/User';
import dotenv from 'dotenv';
import { cloudinary } from '../config/cloudinary';
import multer from 'multer';
import { UploadApiResponse } from 'cloudinary';

dotenv.config();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// AuthRequest interface รองรับ multer files ทั้งแบบ array และ object
interface AuthRequest extends Request {
  user?: any;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

// Auth middleware
const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// ---------------------------- GET ALL PRODUCTS ----------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const category = req.query.category as string | undefined;
    const q = (req.query.q as string | undefined)?.trim();
    const minPrice = req.query.minPrice as string | undefined;
    const maxPrice = req.query.maxPrice as string | undefined;
    const location = req.query.location as string | undefined;
    const condition = req.query.condition as string | undefined;
    const soldParam = req.query.sold as string | undefined;

    let query: any = {};

    if (userId && userId === 'current') {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ message: 'No token provided' });

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
        query.user = decoded.id;
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      if (soldParam === 'true') query.sold = true;
      else if (soldParam === 'false') query.sold = false;
    } else if (userId) {
      query.user = userId;
      if (soldParam === 'true') query.sold = true;
      else if (soldParam === 'false') query.sold = false;
    } else if (category) {
      query.category = category;
      if (soldParam === 'false') query.sold = false;
    }

    if (location) query.location = { $regex: location, $options: 'i' };
    if (condition) query.condition = condition;

    if (minPrice || maxPrice) {
      const priceQuery: any = {};
      if (minPrice && !isNaN(Number(minPrice))) priceQuery.$gte = Number(minPrice);
      if (maxPrice && !isNaN(Number(maxPrice))) priceQuery.$lte = Number(maxPrice);
      query.price = priceQuery;
    }

    if (q && q.length > 0) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { title: regex },
        { description: regex },
        { category: regex },
        { location: regex },
      ];
    }

    const products = await Product.find(query)
      .populate('user', 'name profileImage email studentId')
      .sort({ createdAt: -1 });

    res.status(200).json(products);
  } catch (err: any) {
    console.error('Fetch products error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ---------------------------- COUNT ----------------------------
router.get('/count', async (_req: Request, res: Response) => {
  try {
    const totalCount = await Product.countDocuments();
    const availableCount = await Product.countDocuments({ sold: false });
    const soldCount = await Product.countDocuments({ sold: true });

    res.json({
      count: totalCount,
      available: availableCount,
      sold: soldCount
    });
  } catch (err: any) {
    console.error('Count products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------- LOCATIONS ----------------------------
router.get('/locations', async (_req: Request, res: Response) => {
  try {
    const locations = await Product.distinct('location', { 
      location: { $exists: true, $ne: '' },
      sold: false 
    });
    const cleaned = (locations as string[])
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v) => v.length > 0)
      .sort((a, b) => a.localeCompare(b));
    res.status(200).json({ locations: cleaned });
  } catch (err: any) {
    console.error('Fetch locations error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ---------------------------- GET PRODUCT BY ID ----------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('user', 'name profileImage email studentId');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(product);
  } catch (err: any) {
    console.error('Fetch product error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ---------------------------- CREATE PRODUCT ----------------------------
router.post('/create', authMiddleware, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[]; // ✅ cast
  const { title, price, category, description, condition, location } = req.body;

  if (!title || !price || !category || !description || !condition || !location) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: 'Invalid price' });
    }

    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ message: `Image ${file.originalname} exceeds 10MB` });
        }
        const result: UploadApiResponse = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          { folder: 'products', resource_type: 'image' }
        );
        imageUrls.push(result.secure_url);
      }
    }

    const product = new Product({
      title,
      price: parsedPrice,
      category,
      description,
      condition,
      location,
      images: imageUrls,
      user: req.user!._id,
      sellerId: req.user!._id,
      views: 0,
      favorites: [],
      sold: false
    });

    await product.save();
    res.status(201).json({ message: 'Product created successfully', product });
  } catch (err: any) {
    console.error('Product creation error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ---------------------------- UPDATE PRODUCT ----------------------------
router.put('/:id', authMiddleware, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[]; // ✅ cast
  const { title, price, category, description, condition, location, existingImages, imagesToDelete, sold } = req.body;

  if (!title || !price || !category || !description || !condition || !location) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.user.toString() !== req.user!._id.toString()) return res.status(403).json({ message: 'Unauthorized' });

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ message: 'Invalid price' });

    if (sold !== undefined) product.sold = sold === 'true';

    let updatedImages = JSON.parse(existingImages || '[]') as string[];
    let imagesToDeleteArray: string[] = [];
    try { imagesToDeleteArray = JSON.parse(imagesToDelete || '[]'); } catch {}
    
    // Delete images from cloudinary
    for (const img of imagesToDeleteArray) {
      try {
        const parts = img.split('/');
        const index = parts.findIndex(p => p === 'products') + 1;
        const publicId = parts.slice(index).join('/').split('.')[0];
        await cloudinary.uploader.destroy(`products/${publicId}`, { invalidate: true });
        updatedImages = updatedImages.filter(u => u !== img);
      } catch (err) { console.error('Error deleting image:', err); }
    }

    // Upload new files
    if (files && files.length > 0) {
      for (const file of files) {
        const result: UploadApiResponse = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          { folder: 'products', resource_type: 'image' }
        );
        updatedImages.push(result.secure_url);
      }
    }

    if (updatedImages.length > 10) return res.status(400).json({ message: 'Maximum 10 images allowed' });

    product.title = title;
    product.price = parsedPrice;
    product.category = category;
    product.description = description;
    product.condition = condition;
    product.location = location;
    product.images = updatedImages;

    await product.save();
    res.status(200).json({ message: 'Product updated successfully', product });
  } catch (err: any) {
    console.error('Product update error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ---------------------------- MARK AS SOLD ----------------------------
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { sold } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.user.toString() !== req.user!._id.toString()) return res.status(403).json({ message: 'Unauthorized' });

    if (!product.sellerId) product.sellerId = req.user!._id;
    product.sold = sold === true || sold === 'true';
    await product.save();

    res.status(200).json({ message: `Product ${product.sold ? 'marked as sold' : 'marked as available'} successfully`, product });
  } catch (err: any) {
    console.error('Mark as sold error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ---------------------------- DELETE PRODUCT ----------------------------
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.user.toString() !== req.user!._id.toString()) return res.status(403).json({ message: 'Unauthorized' });

    // Delete images from cloudinary
    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        try {
          const parts = img.split('/');
          const index = parts.findIndex(p => p === 'products') + 1;
          const publicId = parts.slice(index).join('/').split('.')[0];
          await cloudinary.uploader.destroy(`products/${publicId}`, { invalidate: true });
        } catch (err) { console.error('Error deleting image:', err); }
      }
    }

    await Product.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err: any) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

export default router;
