import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Clock,
  MapPin,
  Shield,
  Users,
  Eye,
} from "lucide-react";
// We import the centralized 'api' instance instead of raw 'axios'
import api from "../api/axios"; // Adjust this path if your api/axios.ts file is elsewhere
import { formatDistanceToNow } from "date-fns";
import { th, enUS } from "date-fns/locale";
import Modal from "../components/Modal";
import ProductCreate from "./ProductCreate";
import PostMessageModal from "./PostMessageModal";
import "../i18n";
import { useTranslation } from "react-i18next";

// ✅ UPDATED Interface with profileImage support
interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  condition: string;
  location: string;
  user: {
    _id?: string;
    name: string;
    avatar?: string;
    profileImage?: string;
    username?: string;
    studentId?: string;
  };
  createdAt: string;
  sold?: boolean;
}

interface Message {
  _id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  budget?: number;
  urgency: string;
  user: {
    _id: string;
    name: string;
    avatar?: string;
    profileImage?: string;
  };
  likes: string[];
  comments: any[];
  views: number;
  createdAt: string;
}

interface StatBoxProps {
  label: string;
  value: string | number;
}

interface FeatureBoxProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  desc: string;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value }) => (
  <div className="text-center">
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <p className="text-sm text-gray-500">{label}</p>
  </div>
);

const FeatureBox: React.FC<FeatureBoxProps> = ({
  icon,
  iconBg,
  label,
  desc,
}) => (
  <div className="text-center flex-1 min-w-[180px] max-w-[220px]">
    <div
      className={`w-16 h-16 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}
    >
      {icon}
    </div>
    <p className="text-lg font-bold text-gray-900 mb-2">{label}</p>
    <p className="text-sm text-gray-500">{desc}</p>
  </div>
);

const categoryKeyMap: Record<string, string> = {
  all: "category_all_items",
  electronics: "category_electronics",
  furniture: "category_furniture",
  textbooks: "category_textbooks",
  sports: "category_sports",
  unknown: "category_unknown",
};

const categories = [
  "category_all_items",
  "category_electronics",
  "category_furniture",
  "category_textbooks",
  "category_sports",
];

const categoryFilterMap: Record<string, string> = {
  category_all_items: "all",
  category_electronics: "electronics",
  category_furniture: "furniture",
  category_general: "general",
  category_textbooks: "textbooks",
  category_sports: "sports",
};

const Browse = () => {
  const { t, i18n } = useTranslation();

  const [listings, setListings] = useState<Listing[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProductCreateModalOpen, setIsProductCreateModalOpen] =
    useState(false);
  const [isPostMessageModalOpen, setIsPostMessageModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState("category_all_items");

  const navigate = useNavigate();

  const handleAuthenticatedAction = (action: () => void) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert(t("auth_required_message"));
      navigate("/login");
      return;
    }
    action();
  };

  const fetchListings = async () => {
    try {
      setLoading(true);
      // ✅ Use the centralized 'api' instance. No need to define API_URL here.
      const response = await api.get("/api/product");

      // ✅ แก้ไข mapping ให้รองรับ profileImage
      const products = response.data.map((product: any) => {
        // 🔍 Debug: ดูข้อมูล user ที่ได้รับ
        console.log("Product user data:", product.user);

        return {
          id: product._id,
          title: product.title,
          description: product.description,
          price: product.price,
          category: product.category?.toLowerCase() || "unknown",
          images: product.images || [],
          condition: product.condition,
          location: product.location,
          user: {
            _id: product.user?._id,
            name: product.user?.name || "Unknown",
            // ✅ ลำดับความสำคัญ: profileImage -> avatar -> default
            avatar:
              product.user?.profileImage ||
              product.user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                product.user?.name || "User"
              )}&background=random&size=128`,
            profileImage: product.user?.profileImage,
            username:
              product.user?.username ||
              product.user?.studentId ||
              product.user?.email?.split("@")[0],
            studentId: product.user?.studentId,
          },
          createdAt: product.createdAt,
          sold: product.sold || false,
        };
      });

      console.log("Mapped products:", products[0]); // 🔍 Debug first product
      setListings(products);
    } catch (err: any) {
      setError(err.message || t("fetch_listings_error"));
      console.error("Fetch listings error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      // ✅ Use the centralized 'api' instance.
      const response = await api.get("/api/messages");

      const msgs = response.data.map((msg: any) => ({
        _id: msg._id,
        title: msg.title,
        description: msg.description,
        category: msg.category?.toLowerCase() || "unknown",
        location: msg.location,
        budget: msg.budget,
        urgency: msg.urgency,
        user: {
          _id: msg.user?._id,
          name: msg.user?.name || "Unknown",
          // ✅ ลำดับความสำคัญ: profileImage -> avatar -> default
          avatar:
            msg.user?.profileImage ||
            msg.user?.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              msg.user?.name || "User"
            )}&background=random&size=128`,
          profileImage: msg.user?.profileImage,
        },
        likes: msg.likes || [],
        comments: msg.comments || [],
        views: msg.views || 0,
        createdAt: msg.createdAt,
      }));
      setMessages(msgs);
    } catch (err: any) {
      setError(err.message || t("fetch_messages_error"));
      console.error("Fetch messages error:", err);
    }
  };

  useEffect(() => {
    fetchListings();
    fetchMessages();
  }, []);

  const handleProductCreated = () => {
    setIsProductCreateModalOpen(false);
    fetchListings();
  };

  const handleMessagePosted = () => {
    setIsPostMessageModalOpen(false);
    fetchMessages();
  };

  const goToProductDetail = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  const goToMessageDetail = (messageId: string) => {
    navigate(`/message/${messageId}`);
  };

  const studentCount = new Set(
    listings
      .filter((item) => item.user?.name !== "Admin")
      .map((item) => item.user?._id)
  ).size;

  const formatTime = (dateString: string) => {
    const locale = i18n.language === "th" ? th : enUS;
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: locale,
    });
  };

  const getDisplayCategory = (cat: string) => {
    const key = categoryKeyMap[cat] || `category_${cat}`;
    return t(key);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "electronics":
        return "bg-purple-500";
      case "textbooks":
        return "bg-green-500";
      case "furniture":
        case "general":
        return "bg-blue-400";
      case "unknown":
        return "bg-yellow-500";
      case "sports":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const filterValue =
    categoryFilterMap[selectedCategory] ||
    selectedCategory.toLowerCase().replace("category_", "");
  const filteredListings = listings.filter((item) => {
    const matchesCategory =
      filterValue === "all" || item.category === filterValue;
    const matchesSoldStatus = !item.sold;
    const isStudentProduct = item.user && item.user.name !== "Admin";
    return matchesCategory && matchesSoldStatus && isStudentProduct;
  });

  const features = [
    {
      icon: <Shield className="w-8 h-8 text-gray-700" />,
      iconBg: "bg-green-100",
      labelKey: "feature_verified_students_label",
      descKey: "feature_verified_students_desc",
    },
    {
      icon: <Clock className="w-8 h-8 text-gray-700" />,
      iconBg: "bg-blue-100",
      labelKey: "feature_quick_responses_label",
      descKey: "feature_quick_responses_desc",
    },
    {
      icon: <Users className="w-8 h-8 text-gray-700" />,
      iconBg: "bg-purple-100",
      labelKey: "feature_community_driven_label",
      descKey: "feature_community_driven_desc",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {t("hero_title_part1")}{" "}
          <span className="text-blue-600">{t("hero_title_part2")}</span>
        </h1>
        <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
          {t("hero_description")}
        </p>
        <div className="flex justify-center gap-6 mb-8">
          <button
            className="bg-blue-600 text-white py-3 px-8 rounded-full font-semibold hover:bg-blue-700 transition-colors"
            onClick={() =>
              handleAuthenticatedAction(() => setIsProductCreateModalOpen(true))
            }
          >
            {t("sell_something_button")}
          </button>
          <button
            className="bg-gray-200 text-blue-600 py-3 px-8 rounded-full font-semibold hover:bg-gray-300 transition-colors"
            onClick={() =>
              handleAuthenticatedAction(() => setIsPostMessageModalOpen(true))
            }
          >
            {t("start_looking_button")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-12 mb-12">
        <StatBox
          label={t("stat_active_listings")}
          value={filteredListings.length}
        />
        <StatBox label={t("stat_students")} value={studentCount} />
      </div>

      {/* Categories */}
      <div className="text-center mb-12">
        <h2 className="text-2xl font-semibold mb-6">
          {t("browse_categories_heading")}
        </h2>
        <div className="flex justify-center gap-4 flex-wrap">
          {categories.map((key) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-6 py-3 rounded-full font-medium transition-colors ${
                selectedCategory === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {/* Latest Listings */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {t("latest_listings_heading")}
            </h2>
            <p className="text-gray-500">{t("latest_listings_subtitle")}</p>
          </div>
          <span className="text-gray-400 text-sm">
            {filteredListings.length} {t("items_found_label")}
          </span>
        </div>

        {error && <p className="text-red-500 text-center mb-6">{error}</p>}
        {loading ? (
          <p className="text-center text-gray-500">
            {t("loading_listings_message")}
          </p>
        ) : filteredListings.length === 0 ? (
          <p className="text-center text-gray-500">
            {selectedCategory === "category_all_items"
              ? t("no_listings_found")
              : t("no_items_in_category", { category: t(selectedCategory) })}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.slice(0, 9).map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => goToProductDetail(item.id)}
                >
                  <div className="relative">
                    <img
                      src={
                        item.images[0] ||
                        "https://via.placeholder.com/400x300?text=No+Image"
                      }
                      alt={item.title}
                      className="w-full h-48 object-cover"
                    />
                    <span
                      className={`absolute top-2 left-2 px-3 py-1 text-xs rounded-full text-white ${getCategoryColor(
                        item.category
                      )}`}
                    >
                      {getDisplayCategory(item.category)}
                    </span>
                   </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {item.description}
                    </p>

                    <p className="text-lg font-bold text-blue-600 mb-3">
                      {item.price.toLocaleString()} {t("currency_unit")}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>{formatTime(item.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} />
                        <span className="truncate max-w-[100px]">
                  {item.location}
                        </span>
                      </div>
                    </div>

                    {/* ✅ แสดงรูป Avatar และชื่อผู้โพสต์ */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <img
                        src={
                          item.user?.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            item.user?.name || "User"
                          )}&background=random&size=128`
                        }
                        alt={item.user?.name || "User"}
                        className="w-7 h-7 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            item.user?.name || "User"
                          )}&background=random&size=128`;
                        }}
                      />
                      <span className="text-xs text-gray-600 font-medium truncate">
                        {item.user?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <Link
                to="/listings"
                className="px-6 py-2.5 bg-white border border-blue-600 text-blue-600 rounded-full font-medium hover:bg-blue-50 transition-colors"
              >
                {t("view_all_listings_button")}
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Recent Messages */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {t("recent_messages_heading")}
            </h2>
            <p className="text-gray-500">{t("recent_messages_subtitle")}</p>
          </div>
          <span className="text-gray-400 text-sm">
            {messages.length} {t("messages found")}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {messages.slice(0, 6).map((msg) => (
            <div
              key={msg._id}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => goToMessageDetail(msg._id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* ✅ แสดงรูป Avatar ของผู้โพสต์ข้อความ */}
                  <img
                    src={
                      msg.user?.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        msg.user?.name || "User"
                      )}&background=random&size=128`
                    }
                    alt={msg.user?.name || "User"}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                     e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          msg.user?.name || "User"
                        )}&background=random&size=128`;
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {msg.user?.name || "Unknown"}
                  </p>
                    <p className="text-xs text-gray-400">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 text-xs rounded-full text-white ${getCategoryColor(
                    msg.category
                  )}`}
                >
                  {getDisplayCategory(msg.category)}
         </span>
              </div>

              <h4 className="font-semibold text-gray-900 mb-1">{msg.title}</h4>
            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                {msg.description}
              </p>

       <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Heart size={14} />
                    <span>{msg.likes?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle size={14} />
                    <span>{msg.comments?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                <Eye size={14} />
                    <span>{msg.views ?? 0}</span>
                  </div>
                </div>
                <span className="text-blue-600 text-sm font-medium hover:underline">
            {t("view_detail_button")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View All Messages Button */}
      <div className="flex justify-center gap-4 mb-14">
        <Link
          to="/messages"
          className="px-6 py-2.5 bg-white border border-green-600 text-green-600 rounded-full font-medium hover:bg-green-50 transition-colors"
        >
          {t("view_all_messages_button")}
        </Link>
    </div>
      {/* Safe & Trusted Trading */}
      <div className="mb-16">
        <h2 className="text-2xl font-semibold text-center mb-8">
          {t("safe_trading_heading")}
        </h2>
        <div className="flex justify-center gap-8 flex-wrap">
          {features.map((f) => (
            <FeatureBox
              key={f.labelKey}
              icon={f.icon}
              iconBg={f.iconBg}
              label={t(f.labelKey)}
              desc={t(f.descKey)}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={isProductCreateModalOpen}
        onClose={() => setIsProductCreateModalOpen(false)}
        title={t("modal_post_new_item_title")}
      >
        <ProductCreate
          onClose={() => setIsProductCreateModalOpen(false)}
       onSuccess={handleProductCreated}
        />
      </Modal>

      <Modal
        isOpen={isPostMessageModalOpen}
        onClose={() => setIsPostMessageModalOpen(false)}
        title={t("modal_post_messages_title")}
      >
        <PostMessageModal
          onClose={() => setIsPostMessageModalOpen(false)}
          onSuccess={handleMessagePosted}
        />
      </Modal>
    </div>
  );
};

export default Browse;