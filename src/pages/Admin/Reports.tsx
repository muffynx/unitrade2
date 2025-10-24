// src/pages/Reports.tsx
import { useState, useEffect } from "react";
import AdminLayout from "../../layouts/AdminLayout";
import {
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  MessageSquare,
  Package,
  User as UserIcon,
  Calendar,
  Clock,
} from "lucide-react";

interface Report {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  type: string;
  targetId: string;
  reason: string;
  description: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: {
    _id: string;
    name: string;
  };
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  studentId?: string;
  university?: string;
  createdAt?: string;
}

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images?: string[];
}

type StatusFilter = "all" | "pending" | "reviewed" | "resolved" | "dismissed";
type TypeFilter = "all" | "PRODUCT" | "MESSAGE" | "USER" | "CHAT";

const getTargetLink = (report: Report) => {
  switch (report.type) {
    case "USER":
    case "PROFILE": // เพิ่มตรงนี้
      return `/profile-look/${report.targetId}`; // ใช้ route ที่มีอยู่
    case "PRODUCT":
      return `/product/${report.targetId}`;
    case "MESSAGE":
      return `/message/${report.targetId}`; // ใช้ route ที่มีอยู่
    case "CHAT":
      return `/chat/${report.targetId}`; // ใช้ route ที่มีอยู่
    default:
      return "#";
  }
};

export default function Reports() {
  const [activePage, setActivePage] = useState<
    "dashboard" | "users" | "reports"
  >("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const token = localStorage.getItem("adminToken");
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    if (!showDetailModal || !selectedReport) {
      setTargetProfile(null);
      setTargetProduct(null);
      return;
    }
    fetchTargetData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetailModal, selectedReport]);

  const fetchReports = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
      alert("ไม่สามารถดึงข้อมูลรายงานได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchTargetData = async () => {
    if (!selectedReport || !token) return;
    setLoadingTarget(true);
    try {
      if (selectedReport.type === "USER" || selectedReport.type === "PROFILE") {
        await fetchTargetProfile(selectedReport.targetId);
      } else if (selectedReport.type === "PRODUCT") {
        await fetchTargetProduct(selectedReport.targetId);
      }
    } catch (err) {
      console.error("Error fetching target data:", err);
    } finally {
      setLoadingTarget(false);
    }
  };

  const fetchTargetProfile = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch user profile");
      const data = await res.json();
      setTargetProfile(data.user || data);
      setTargetProduct(null);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setTargetProfile(null);
    }
  };

  const fetchTargetProduct = async (productId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch product");
      const data = await res.json();
      setTargetProduct(data.product || data);
      setTargetProfile(null);
    } catch (err) {
      console.error("Error fetching product:", err);
      setTargetProduct(null);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];
    if (statusFilter !== "all")
      filtered = filtered.filter((r) => r.status === statusFilter);
    if (typeFilter !== "all")
      filtered = filtered.filter((r) => r.type === typeFilter);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.userId.name.toLowerCase().includes(query) ||
          r.userId.email.toLowerCase().includes(query) ||
          r.reason.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.targetId.toLowerCase().includes(query)
      );
    }
    setFilteredReports(filtered);
  };

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        alert("อัปเดตสถานะสำเร็จ");
        fetchReports();
        setShowDetailModal(false);
      } else {
        const error = await res.json();
        alert(error.message || "ไม่สามารถอัปเดตสถานะได้");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "รอดำเนินการ";
      case "reviewed":
        return "กำลังตรวจสอบ";
      case "resolved":
        return "แก้ไขแล้ว";
      case "dismissed":
        return "ยกเลิก";
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "PRODUCT":
        return "สินค้า";
      case "MESSAGE":
        return "ข้อความ";
      case "USER":
        return "ผู้ใช้";
      case "CHAT":
        return "แชท";
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "PRODUCT":
        return <Package className="h-4 w-4" />;
      case "MESSAGE":
        return <MessageSquare className="h-4 w-4" />;
      case "USER":
        return <UserIcon className="h-4 w-4" />;
      case "CHAT":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "reviewed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "resolved":
        return "bg-green-100 text-green-800 border-green-200";
      case "dismissed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "PRODUCT":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "MESSAGE":
        return "bg-green-100 text-green-800 border-green-200";
      case "USER":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "CHAT":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "inappropriate_content":
        return "เนื้อหาไม่เหมาะสม";
      case "spam":
        return "สแปม";
      case "fake_information":
        return "ข้อมูลปลอม";
      case "scam":
        return "พยายามหลอกลวง";
      case "prohibited_items":
        return "สินค้าต้องห้าม";
      case "harassment":
        return "การกลั่นแกล้ง";
      case "other":
        return "อื่นๆ";
      default:
        return reason;
    }
  };

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    reviewed: reports.filter((r) => r.status === "reviewed").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    dismissed: reports.filter((r) => r.status === "dismissed").length,
  };

  return (
    <AdminLayout activePage={activePage} setActivePage={setActivePage}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              รายงานจากผู้ใช้
            </h1>
            <p className="text-gray-500 mt-1">
              จัดการและตรวจสอบรายงานต่างๆ จากผู้ใช้งาน
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">รายงานทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">รอดำเนินการ</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">กำลังตรวจสอบ</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.reviewed}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">แก้ไกกขแล้ว</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.resolved}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ยกเลิก</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.dismissed}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาตามชื่อผู้ใช้, อีเมล, เหตุผล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="reviewed">กำลังตรวจสอบ</option>
              <option value="resolved">แก้ไขแล้ว</option>
              <option value="dismissed">ยกเลิก</option>
            </select>
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ประเภททั้งหมด</option>
              <option value="PRODUCT">สินค้า</option>
              <option value="MESSAGE">ข้อความ</option>
              <option value="USER">ผู้ใช้</option>
              <option value="CHAT">แชท</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ผู้รายงาน
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ประเภท
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      เหตุผล
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      สถานะ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      วันที่รายงาน
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      การดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => (
                    <tr
                      key={report._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-gray-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {report.userId.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {report.userId.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(
                            report.type
                          )}`}
                        >
                          {getTypeIcon(report.type)}
                          {getTypeLabel(report.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <div className="text-sm font-medium text-gray-900">
                            {getReasonLabel(report.reason)}
                          </div>
                          <div className="text-sm text-gray-500 line-clamp-2">
                            {report.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            report.status
                          )}`}
                        >
                          {getStatusLabel(report.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          {new Date(report.createdAt).toLocaleDateString(
                            "th-TH",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(report.createdAt).toLocaleTimeString(
                            "th-TH",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setShowDetailModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredReports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertTriangle className="h-12 w-12 text-gray-400 mb-3" />
                          <p className="text-gray-500 text-lg font-medium">
                            ไม่พบรายงาน
                          </p>
                          <p className="text-gray-400 text-sm mt-1">
                            ลองเปลี่ยนตัวกรองหรือคำค้นหา
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal รายละเอียด */}
      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                รายละเอียดรายงาน
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* ข้อมูลรายงาน */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    ผู้รายงาน
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedReport.userId.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selectedReport.userId.email}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      ประเภท
                    </label>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(
                          selectedReport.type
                        )}`}
                      >
                        {getTypeIcon(selectedReport.type)}
                        {getTypeLabel(selectedReport.type)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      สถานะปัจจุบัน
                    </label>
                    <div className="mt-2">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                          selectedReport.status
                        )}`}
                      >
                        {getStatusLabel(selectedReport.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    เหตุผล
                  </label>
                  <p className="mt-2 text-gray-900 font-medium">
                    {getReasonLabel(selectedReport.reason)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    รายละเอียด
                  </label>
                  <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                    {selectedReport.description}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    วันที่รายงาน
                  </label>
                  <p className="mt-2 text-gray-700">
                    {new Date(selectedReport.createdAt).toLocaleString(
                      "th-TH",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                </div>
                {selectedReport.reviewedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      วันที่ตรวจสอบ
                    </label>
                    <p className="mt-2 text-gray-700">
                      {new Date(selectedReport.reviewedAt).toLocaleString(
                        "th-TH",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* ข้อมูลเป้าหมายที่ถูกรายงาน */}
              {loadingTarget ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">กำลังโหลดข้อมูล...</span>
                </div>
              ) : (
                <>
                  {(selectedReport.type === "USER" ||
                    selectedReport.type === "PROFILE") &&
                    targetProfile && (
                      <div className="border-t pt-6 mt-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3">
                          โปรไฟล์ที่ถูกรายงาน
                        </h4>
                        <div className="space-y-2 text-sm text-gray-700">
                          <div>
                            <span className="font-medium">ชื่อ: </span>
                            {targetProfile.name}
                          </div>
                          <div>
                            <span className="font-medium">อีเมล: </span>
                            {targetProfile.email}
                          </div>
                          {targetProfile.studentId && (
                            <div>
                              <span className="font-medium">
                                รหัสนักศึกษา:{" "}
                              </span>
                              {targetProfile.studentId}
                            </div>
                          )}
                          {targetProfile.university && (
                            <div>
                              <span className="font-medium">มหาวิทยาลัย: </span>
                              {targetProfile.university}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">วันที่สมัคร: </span>
                            {new Date(
                              targetProfile.createdAt || ""
                            ).toLocaleString("th-TH")}
                          </div>
                          <a
                            href={getTargetLink(selectedReport)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 mt-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                            ดูโปรไฟล์
                          </a>
                        </div>
                      </div>
                    )}
                  {selectedReport.type === "PRODUCT" && targetProduct && (
                    <div className="border-t pt-6 mt-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        โพสต์สินค้าที่ถูกรายงาน
                      </h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        <div>
                          <span className="font-medium">ชื่อสินค้า: </span>
                          {targetProduct.name}
                        </div>
                        <div>
                          <span className="font-medium">รายละเอียด: </span>
                          {targetProduct.description}
                        </div>
                        <div>
                          <span className="font-medium">ราคา: </span>
                          {targetProduct.price} บาท
                        </div>
                        {targetProduct.images &&
                          targetProduct.images.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {targetProduct.images.map((img, idx) => (
                                <img
                                  key={idx}
                                  src={img}
                                  alt="product"
                                  className="h-16 w-16 object-cover rounded"
                                />
                              ))}
                            </div>
                          )}
                        <a
                          href={getTargetLink(selectedReport)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 mt-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          ดูสินค้า
                        </a>
                      </div>
                    </div>
                  )}
                  {/* fallback สำหรับ MESSAGE, CHAT หรืออื่นๆ */}
                  {(selectedReport.type === "MESSAGE" ||
                    selectedReport.type === "CHAT") && (
                    <div className="border-t pt-6 mt-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        สิ่งที่ถูกรายงาน
                      </h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        <div>
                          <span className="font-medium">ID: </span>
                          {selectedReport.targetId}
                        </div>
                        <div>
                          <span className="font-medium">ประเภท: </span>
                          {getTypeLabel(selectedReport.type)}
                        </div>
                        <a
                          href={getTargetLink(selectedReport)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 mt-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          ดูรายละเอียด
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* อัปเดตสถานะ */}
              <div className="border-t pt-6">
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  อัปเดตสถานะ
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {selectedReport.status !== "reviewed" && (
                    <button
                      onClick={() =>
                        handleStatusChange(selectedReport._id, "reviewed")
                      }
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      กำลังตรวจสอบ
                    </button>
                  )}
                  {selectedReport.status !== "resolved" && (
                    <button
                      onClick={() =>
                        handleStatusChange(selectedReport._id, "resolved")
                      }
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      แก้ไขแล้ว
                    </button>
                  )}
                  {selectedReport.status !== "dismissed" && (
                    <button
                      onClick={() =>
                        handleStatusChange(selectedReport._id, "dismissed")
                      }
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      ยกเลิก
                    </button>
                  )}
                  {selectedReport.status !== "pending" && (
                    <button
                      onClick={() =>
                        handleStatusChange(selectedReport._id, "pending")
                      }
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                    >
                      <Clock className="h-4 w-4" />
                      รอดำเนินการ
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
