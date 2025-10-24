import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import User from '../models/User';
import auth from '../middleware/auth';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ✅ Helper function: สร้าง secure random password
const generateSecurePassword = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// ✅ Helper function: สร้าง unique student ID
const generateUniqueStudentId = async (): Promise<string> => {
  let studentId: string = '';
  let exists = true;
  
  while (exists) {
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    studentId = `GOOGLE_${randomPart}`;
    const existingUser = await User.findOne({ studentId });
    exists = !!existingUser; // แก้จาก User.exists()
  }
  
  return studentId;
};

// ✅ Verify Google Token with enhanced security
const verifyGoogleToken = async (token: string) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    // ตรวจสอบเพิ่มเติม
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Invalid audience');
    }

    if (!payload.email_verified) {
      throw new Error('Email not verified by Google');
    }

    // ตรวจสอบ issuer
    if (payload.iss !== 'accounts.google.com' && 
        payload.iss !== 'https://accounts.google.com') {
      throw new Error('Invalid issuer');
    }

    // ตรวจสอบ expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw error;
  }
};

// ✅ Register
router.post('/register', async (req, res) => {
  const { name, email, studentId, password } = req.body;

  // Input validation
  if (!name || !email || !studentId || !password) {
    return res.status(400).json({ 
      message: 'All fields are required',
      field: !name ? 'name' : !email ? 'email' : !studentId ? 'studentId' : 'password'
    });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      message: 'Invalid email format',
      field: 'email'
    });
  }

  // Password strength validation
  if (password.length < 8) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters',
      field: 'password'
    });
  }

  try {
    const existingUser = await User.findOne({ 
      $or: [{ email }, { studentId }] 
    });
    
    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'studentId';
      return res.status(400).json({ 
        message: `${field === 'email' ? 'Email' : 'Student ID'} already exists`,
        field
      });
    }

    const user = new User({ 
      name: name.trim(), 
      email: email.toLowerCase().trim(), 
      studentId: studentId.trim(), 
      password 
    });
    
    await user.save();

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        name: user.name,
        email: user.email,
        studentId: user.studentId
      }
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    
    // Handle duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} already exists`,
        field
      });
    }
    
    res.status(500).json({ 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Login ปกติ
router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ 
      message: 'Login and password are required',
      field: !login ? 'login' : 'password'
    });
  }

  try {
    const user = await User.findOne({ 
      $or: [
        { email: login.toLowerCase().trim() }, 
        { studentId: login.trim() }
      ] 
    });

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email/student ID or password',
        field: 'login'
      });
    }

    // ตรวจสอบว่าเป็น Google user หรือไม่
    if (user.googleId && !user.password) {
      return res.status(400).json({ 
        message: 'This account uses Google Sign-In. Please use "Sign in with Google"',
        field: 'login',
        isGoogleAccount: true
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Invalid email/student ID or password',
        field: 'password'
      });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({ 
        message: 'Your account has been suspended. Please contact support.',
        field: 'account'
      });
    }

    if (user.status === 'deleted') {
      return res.status(403).json({ 
        message: 'This account has been deleted.',
        field: 'account'
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role || 'user' }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: '7d' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({ 
      token, 
      user: { 
        id: user._id,
        name: user.name, 
        email: user.email, 
        studentId: user.studentId,
        role: user.role || 'user',
        profileImage: user.profileImage
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? err : undefined
    });
  }
});

// ✅ Google Login - Enhanced version
router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        message: 'Google token is required',
        field: 'token'
      });
    }

    // Verify Google token with enhanced security
    let payload;
    try {
      payload = await verifyGoogleToken(token);
    } catch (verifyError: any) {
      console.error('Google token verification failed:', verifyError);
      return res.status(401).json({ 
        message: 'Invalid or expired Google token. Please try again.',
        field: 'google',
        error: verifyError.message
      });
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ 
        message: 'Invalid Google token payload',
        field: 'google'
      });
    }

    // ตรวจสอบว่า user มีอยู่แล้วหรือไม่
    let user = await User.findOne({ email: payload.email });

    if (!user) {
      // สร้าง user ใหม่ด้วย secure password และ unique student ID
      const securePassword = generateSecurePassword();
      const uniqueStudentId = await generateUniqueStudentId();

      user = new User({
        name: payload.name || 'Google User',
        email: payload.email,
        password: securePassword,
        googleId: payload.sub,
        profileImage: payload.picture,
        studentId: uniqueStudentId,
        isEmailVerified: true,
        role: 'user',
        status: 'active',
        lastLogin: new Date()
      });

      await user.save();
      console.log('✅ New Google user created:', user.email);
    } else {
      // อัพเดท Google info
      let needUpdate = false;

      if (!user.googleId) {
        user.googleId = payload.sub;
        needUpdate = true;
      }

      if (!user.profileImage && payload.picture) {
        user.profileImage = payload.picture;
        needUpdate = true;
      }

      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        needUpdate = true;
      }

      // Check account status
      if (user.status === 'suspended') {
        return res.status(403).json({ 
          message: 'Your account has been suspended. Please contact support.',
          field: 'account'
        });
      }

      if (user.status === 'deleted') {
        return res.status(403).json({ 
          message: 'This account has been deleted.',
          field: 'account'
        });
      }

      user.lastLogin = new Date();
      needUpdate = true;

      if (needUpdate) {
        await user.save();
        console.log('✅ Updated existing user with Google info:', user.email);
      }
    }

    // Create JWT token
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role || 'user' },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        role: user.role || 'user',
        profileImage: user.profileImage
      }
    });
  } catch (error: any) {
    console.error('❌ Google login error:', error);
    res.status(500).json({ 
      message: 'Server error during Google login. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ Get current user
router.get('/me', auth, async (req: any, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;