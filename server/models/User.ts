import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  studentId: string;
  password: string;
  role?: string;
  googleId?: string;
  profileImage?: string;
  isEmailVerified?: boolean;
  status?: string;
  lastLogin?: Date;
  // ✅ เพิ่ม OTP fields
  otp?: string;
  otpExpiry?: Date;
  otpAttempts?: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted', 'pending'], // เพิ่ม 'pending'
    default: 'pending' // เปลี่ยนเป็น pending จนกว่าจะ verify
  },
  lastLogin: {
    type: Date
  },
  // ✅ OTP fields
  otp: {
    type: String
  },
  otpExpiry: {
    type: Date
  },
  otpAttempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Hash password ก่อน save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method สำหรับเปรียบเทียบ password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Index
userSchema.index({ email: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ status: 1 });
userSchema.index({ otpExpiry: 1 }); // ✅ เพิ่ม index สำหรับ OTP

export default mongoose.model<IUser>('User', userSchema);