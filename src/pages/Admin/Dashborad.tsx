import { useEffect, useState } from "react";
import { FaUser, FaExclamationTriangle, FaBox } from "react-icons/fa";
import AdminLayout from "../../layouts/AdminLayout";

interface User {
  _id: string;
  name: string;
  email: string;
  studentId: string;
  role?: string;
}

interface Report {
  _id: string;
  reportedBy: string;
  type: string;
  message: string;
  status: string;
}

interface Product {
  _id: string;
  title: string;
  price: number;
}

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const token = localStorage.getItem("adminToken");
  const API_URL = import.meta.env.VITE_API_URL || "https://unitrade-blue.vercel.app:3000";

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReports = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchReports();
    fetchProducts();
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div className="bg-white shadow p-6 rounded-lg flex items-center justify-between hover:shadow-lg transition">
          <div>
            <p className="text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
          <FaUser size={40} className="text-blue-400" />
        </div>

        <div className="bg-white shadow p-6 rounded-lg flex items-center justify-between hover:shadow-lg transition">
          <div>
            <p className="text-gray-500">Total Reports</p>
            <p className="text-2xl font-bold">{reports.length}</p>
          </div>
          <FaExclamationTriangle size={40} className="text-yellow-400" />
        </div>

        <div className="bg-white shadow p-6 rounded-lg flex items-center justify-between hover:shadow-lg transition">
          <div>
            <p className="text-gray-500">Total Products</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </div>
          <FaBox size={40} className="text-green-400" />
        </div>
      </div>
    </AdminLayout>
  );
}
