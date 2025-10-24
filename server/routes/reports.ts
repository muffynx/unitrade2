import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import Report from "../models/Report";
import auth from "../middleware/auth";

const router = express.Router();

interface AuthRequest extends Request {
  user?: any;
}

// สร้างรายงานใหม่
router.post("/", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { type, targetId, reason, description } = req.body;
    const userId = req.user._id;

    if (!type || !targetId || !reason) {
      return res.status(400).json({ message: "ต้องระบุ type, targetId และ reason" });
    }

    // ตรวจสอบว่าไม่รายงานตัวเอง
    const existingReport = await Report.findOne({
      userId,
      type,
      targetId
    });

    if (existingReport) {
      return res.status(400).json({ message: "คุณได้รายงานรายการนี้ไปแล้ว" });
    }

    const report = new Report({
      userId,
      type: type.toUpperCase(),
      targetId,
      reason,
      description: description || `รายงาน${type === 'PRODUCT' ? 'สินค้า' : 'ข้อความ'}ที่ไม่เหมาะสม`,
      status: 'pending'
    });

    await report.save();

    res.status(201).json({ 
      message: "ส่งรายงานเรียบร้อยแล้ว", 
      report 
    });
  } catch (error: any) {
    console.error("Create report error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการสร้างรายงาน" });
  }
});

// ดึงรายงานทั้งหมด (สำหรับ admin)
router.get("/", async (req: Request, res: Response) => {
  try {
    const reports = await Report.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error: any) {
    console.error("Fetch reports error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงรายงาน" });
  }
});

// อัพเดทสถานะรายงาน (สำหรับ admin)
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
    }

    const report = await Report.findByIdAndUpdate(
      id,
      { status, reviewedAt: new Date() },
      { new: true }
    ).populate("userId", "name email");

    if (!report) {
      return res.status(404).json({ message: "ไม่พบรายงาน" });
    }

    res.json({ message: "อัพเดทสถานะเรียบร้อยแล้ว", report });
  } catch (error: any) {
    console.error("Update report status error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัพเดทสถานะ" });
  }
});

export default router;


