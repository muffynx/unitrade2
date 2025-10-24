
import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User';
import Product from '../models/Product';
import Message from '../models/Message';

dotenv.config();
const router = express.Router();

// ==========
// Auth Middleware
// ==========
const authenticateToken = async (req: any, res: any, next: any) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// ========================================================
// !!! COUNT & ACTIVE-COUNT Routes MUST be at the top !!!
// ========================================================

// User count: count ALL users
router.get('/count', async (req, res) => {
  try {
    const count = await User.countDocuments({});
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Active user count: count users with status "active"
router.get('/active-count', async (req, res) => {
  try {
    const count = await User.countDocuments({ status: "active" });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ==========
// Authenticated User Info
// ==========
router.get('/me', authenticateToken, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    // If no profile image, create default
    if (!user.profileImage) {
      user.profileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=128`;
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Profile
router.get('/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.profileImage) {
      user.profileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=128`;
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========
// Update Profile
// ==========
router.put('/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const { name, username, email, phone, university, studentId, profileImage } = req.body;
    // Validate required fields
    if (!name || !email || !username) {
      return res.status(400).json({ message: 'Name, email, and username are required' });
    }

    // Check username existence (except current)
    if (username !== req.user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (usernameExists) return res.status(400).json({ message: 'Username already exists' });
    }
    // Check email
    if (email !== req.user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (emailExists) return res.status(400).json({ message: 'Email already exists' });
    }
    // Check studentId
    if (studentId && studentId !== req.user.studentId) {
      const studentIdExists = await User.findOne({ studentId, _id: { $ne: req.user._id } });
      if (studentIdExists) return res.status(400).json({ message: 'Student ID already exists' });
    }

    // build update object
    const updateData: any = {
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : '',
      university: university ? university.trim() : ''
    };
    if (profileImage) updateData.profileImage = profileImage;
    if (studentId && studentId.trim() !== req.user.studentId) {
      updateData.studentId = studentId.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, updateData, { new: true, runValidators: true }
    ).select('-password');
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error: any) {
    console.error('Update profile error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === 'studentId') return res.status(400).json({ message: 'Student ID already exists' });
      if (field === 'email')    return res.status(400).json({ message: 'Email already exists' });
      if (field === 'username') return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==========
// Alternate update (optional)
// ==========
router.put('/update', authenticateToken, async (req: any, res: any) => {
  try {
    const { name, username, email, phone, university, studentId, profileImage } = req.body;
    if (!name || !email || !username) {
      return res.status(400).json({ message: 'Name, email, and username are required' });
    }

    if (username !== req.user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (usernameExists) return res.status(400).json({ message: 'Username already exists' });
    }
    if (email !== req.user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (emailExists) return res.status(400).json({ message: 'Email already exists' });
    }
    if (studentId && studentId !== req.user.studentId) {
      const studentIdExists = await User.findOne({ studentId, _id: { $ne: req.user._id } });
      if (studentIdExists) return res.status(400).json({ message: 'Student ID already exists' });
    }

    const updateData: any = {
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : '',
      university: university ? university.trim() : ''
    };
    if (profileImage) updateData.profileImage = profileImage;
    if (studentId && studentId.trim() !== req.user.studentId) {
      updateData.studentId = studentId.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, updateData, { new: true, runValidators: true }
    ).select('-password');
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error: any) {
    console.error('Update user error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === 'studentId') return res.status(400).json({ message: 'Student ID already exists' });
      if (field === 'email')    return res.status(400).json({ message: 'Email already exists' });
      if (field === 'username') return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========
// Change password
// ==========
router.put('/change-password', authenticateToken, async (req: any, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password (alternate endpoint)
router.put('/password', authenticateToken, async (req: any, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST method change password
router.post('/change-password', authenticateToken, async (req: any, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==========
// GET USER BY ID (This route must be LAST!!)
// ==========
router.get('/:id', async (req: any, res: any) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.profileImage) {
      user.profileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=128`;
    }
    const products = await Product.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20);
    const messages = await Message.find({ user: req.params.id, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ user, products, messages });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;