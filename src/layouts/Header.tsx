import React, { useState, useRef, useEffect } from "react";
import { FaComment, FaBell, FaUser, FaCog, FaSignOutAlt, FaSearch, FaTachometerAlt, FaBars, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useTranslation } from 'react-i18next';
import '../i18n';

interface StoredUser { 
  name: string; 
  email: string; 
  _id?: string; 
  id?: string;
  avatar?: string;
  profileImage?: string;
}

type NotificationItem = {
  id: string;
  type: 'chat' | 'comment';
  title: string;
  body: string;
  time: string;
  onClick: () => void;
  meta?: any;
};

const MAX_ITEMS_CAP = 100;
const PAGE_SIZE = 10;


// Helper function to get avatar URL 
const getAvatarUrl = (user: StoredUser | null) => {
  if (!user) return null;
  return user.profileImage || user.avatar || 
         `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=128`;
};

const Header = () => {
  const { t, i18n } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
  
  const [userData, setUserData] = useState<StoredUser | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [adminNotificationCount, setAdminNotificationCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [unreadChatConvs, setUnreadChatConvs] = useState<string[]>([]);
  const [clearedAt, setClearedAt] = useState<number>(() => {
    const v = localStorage.getItem('notifClearedAt');
    return v ? Number(v) : 0;
  });
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // [EFFECT LOGIC] (ไม่เปลี่ยนแปลง)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");

    if (token) {
      setIsLoggedIn(true);

      if (user) { 
        try { 
          const parsedUser = JSON.parse(user);
          setUserData(parsedUser);
        } catch (err) {
          console.error("Failed to parse user data:", err);
        }
      }

      const fetchFavoritesCount = async () => {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          const response = await axios.get(`${API_URL}/api/favorites`, { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          setFavoritesCount(response.data.favorites?.length || 0);
        } catch (err) {
          console.error("Failed to fetch favorites:", err);
          setFavoritesCount(0);
        }
      };

      const buildNotifications = async () => {
        if (!token) return;
        setLoadingNotifs(true);
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          const headers = { Authorization: `Bearer ${token}` };
          const items: NotificationItem[] = [];
          const unreadConvIds: string[] = [];

          // Fetch admin notifications
          try {
            const adminNotifResp = await axios.get(`${API_URL}/api/notifications`, { headers });
            const adminNotifs = adminNotifResp.data.notifications || [];
            setAdminNotifications(adminNotifs);
            setAdminNotificationCount(adminNotifResp.data.unreadCount || 0);
            
            // Add admin notifications to items
            adminNotifs.forEach((notif: any) => {
              if (notif.status !== 'read') {
                items.push({
                  id: `admin_notif_${notif._id}`,
                  type: 'comment',
                  title: notif.title,
                  body: notif.message,
                  time: notif.createdAt,
                  onClick: () => navigate('/chat'),
                  meta: { notificationId: notif._id }
                });
              }
            });
          } catch (adminErr) {
            console.log('Admin notifications not available:', adminErr);
          }

          // Conversations
          const convResp = await axios.get(`${API_URL}/api/conversations`, { headers });
          const conversations = Array.isArray(convResp.data) ? convResp.data : [];
          conversations.forEach((c: any) => {
            const unread = c.unreadCount || 0;
            if (unread > 0 && c.lastMessage) {
              unreadConvIds.push(c._id);
              items.push({
                id: `chat_${c._id}`,
                type: 'chat',
                title: `${c.participants?.map((p: any) => p.name).join(', ') || 'แชทใหม่'} (${unread})`,
                body: c.lastMessage.content || '',
                time: c.lastMessage.createdAt || c.updatedAt || new Date().toISOString(),
                onClick: () => navigate('/chat'),
                meta: { conversationId: c._id, unread }
              });
            }
          });

          // Comments on my posts
          const meResp = await axios.get(`${API_URL}/api/messages`, { 
            headers, 
            params: { userId: 'current' } 
          });
          const myMessages = Array.isArray(meResp.data) ? meResp.data : [];
          const myUser = localStorage.getItem('user');
          let myUserId: string | undefined = undefined;
          if (myUser) { 
            try { 
              const parsed = JSON.parse(myUser); 
              myUserId = parsed._id || parsed.id; 
            } catch (err) {
              console.error("Failed to parse user ID:", err);
            }
          }

          const messageIdToComments: Record<string, { 
            title: string; 
            latestAt: string; 
            count: number; 
            latestText: string; 
          }> = {};

          myMessages.forEach((m: any) => {
            if (Array.isArray(m.comments)) {
              const commentsReadAt = m.commentsReadAt ? new Date(m.commentsReadAt).getTime() : 0;
              
              m.comments.forEach((cm: any) => {
                const commentTime = new Date(cm.createdAt || m.updatedAt).getTime();
                
                if ((!myUserId || cm.user?._id !== myUserId) && commentTime > commentsReadAt) {
                  const bucket = messageIdToComments[m._id] || { 
                    title: m.title, 
                    latestAt: m.createdAt, 
                    count: 0, 
                    latestText: '' 
                  };
                  bucket.count += 1;
                  const ts = cm.createdAt || m.updatedAt || new Date().toISOString();
                  if (new Date(ts).getTime() > new Date(bucket.latestAt).getTime()) {
                    bucket.latestAt = ts;
                    bucket.latestText = cm.text || '';
                  }
                  messageIdToComments[m._id] = bucket;
                }
              });
            }
          });

          Object.entries(messageIdToComments).forEach(([messageId, agg]) => {
            items.push({ 
              id: `comment_${messageId}`, 
              type: 'comment', 
              title: `ความคิดเห็นใหม่ใน: ${agg.title} (${agg.count})`, 
              body: agg.latestText, 
              time: agg.latestAt, 
              onClick: () => navigate(`/message/${messageId}`) 
            });
          });

          const filtered = items.filter((n) => new Date(n.time).getTime() > clearedAt);
          filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
          const capped = filtered.slice(0, MAX_ITEMS_CAP);
          
          setNotifications(capped);
          setNotificationsCount(capped.length + adminNotificationCount);
          setUnreadChatConvs(unreadConvIds);
          setVisibleCount(PAGE_SIZE);
        } catch (err) {
          console.error('Failed to build notifications:', err);
          setNotifications([]);
          setNotificationsCount(0);
          setUnreadChatConvs([]);
        } finally { 
          setLoadingNotifs(false); 
        }
      };

      fetchFavoritesCount();
      buildNotifications();

      const interval = setInterval(buildNotifications, 20000);
      const onVisibility = () => { 
        if (document.visibilityState === 'visible') buildNotifications(); 
      };
      document.addEventListener('visibilitychange', onVisibility);
      
      return () => { 
        clearInterval(interval); 
        document.removeEventListener('visibilitychange', onVisibility); 
      };
    } else {
      setIsLoggedIn(false);
      setUserData(null);
      setFavoritesCount(0);
      setNotifications([]);
      setNotificationsCount(0);
      setUnreadChatConvs([]);
    }
  }, [clearedAt, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Allow closing profile/notif only if mobile menu is closed
      if (!isMobileMenuOpen) {
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
          setIsProfileOpen(false);
        }
        if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
          setIsNotifOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileMenuOpen]); 
  // [END EFFECT LOGIC]

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("cartItems");
    localStorage.removeItem("favorites");
    setIsLoggedIn(false);
    setUserData(null);
    setFavoritesCount(0);
    setNotifications([]);
    setNotificationsCount(0);
    setUnreadChatConvs([]);
    setIsProfileOpen(false);
    alert(t("logged_out"));
    navigate("/browse");
  };

  const handleFavoritesClick = () => navigate("/chat");

  const changeLanguage = (lng: string) => i18n.changeLanguage(lng);

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || unreadChatConvs.length === 0) return;
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      for (let i = 0; i < unreadChatConvs.length; i += 20) {
        const chunk = unreadChatConvs.slice(i, i + 20);
        await Promise.all(
          chunk.map((id) => 
            axios.patch(
              `${API_URL}/api/conversations/${id}/read`, 
              {}, 
              { headers: { Authorization: `Bearer ${token}` } }
            )
          )
        );
      }
      
      setUnreadChatConvs([]);
      setNotifications((prev) => prev.filter((n) => n.type !== 'chat'));
      setNotificationsCount((prev) => Math.max(0, prev - unreadChatConvs.length));
    } catch (err) { 
      console.error('Mark all read failed:', err); 
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    setNotifications((prev) => prev.filter((it) => it.id !== n.id));
    setNotificationsCount((prev) => Math.max(0, prev - 1));
    
    if (n.type === 'chat' && n.meta?.conversationId) {
      setUnreadChatConvs((prev) => prev.filter((id) => id !== n.meta.conversationId));
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const headers = { Authorization: `Bearer ${token}` };
      
      if (n.type === 'chat' && n.meta?.conversationId) {
        axios.patch(
          `${API_URL}/api/conversations/${n.meta.conversationId}/read`,
          {},
          { headers }
        ).catch((err) => console.error('Failed to mark chat as read:', err));
      }
      
      if (n.type === 'comment' && n.id.startsWith('comment_')) {
        const messageId = n.id.replace('comment_', '');
        axios.patch(
          `${API_URL}/api/messages/${messageId}/mark-comments-read`,
          {},
          { headers }
        ).catch((err) => console.error('Failed to mark comments as read:', err));
      }
      
      if (n.id.startsWith('admin_notif_')) {
        const notificationId = n.meta?.notificationId;
        if (notificationId) {
          axios.patch(
            `${API_URL}/api/notifications/${notificationId}/read`,
            {},
            { headers }
          ).catch((err) => console.error('Failed to mark notification as read:', err));
        }
      }
    }
    
    setIsNotifOpen(false);
    setIsMobileMenuOpen(false);
    n.onClick();
  };

  const avatarUrl = getAvatarUrl(userData);

  // Helper function to render avatar logic
  const renderAvatar = (size: 'sm' | 'lg', includeName: boolean = false) => {
    const avatarClasses = size === 'sm' ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";
    
    return (
      <div className={`relative flex items-center ${includeName ? 'gap-2' : ''}`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userData?.name || "User"}
            className={`rounded-full object-cover border-2 border-blue-500 ${avatarClasses}`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`rounded-full bg-blue-500 items-center justify-center text-white font-bold ${avatarUrl ? 'hidden' : 'flex'} ${avatarClasses} flex-shrink-0`} 
        >
          {userData ? (userData.name ? userData.name.charAt(0).toUpperCase() : "U") : "U"}
        </div>
        {includeName && (
          <span className="text-sm text-gray-700 font-medium">{userData ? userData.name : "Username"}</span>
        )}
      </div>
    );
  };
  
  return (
    <header
      className="flex items-center justify-between px-4 py-3 lg:px-8 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50"
    >
      
      {/* 1. Left Container (Brand + Search + Nav Links on Desktop) */}
      <div className="flex items-center w-full lg:w-auto">
    
    {/* Brand */}
    <a 
      href="/browse" 
      className="text-2xl lg:text-3xl font-bold text-gray-900 no-underline whitespace-nowrap mr-6" 
    >
      Uni<span className="text-blue-500">Trade</span>
    </a>

    {/* Navigation Links (Desktop Only - New Position) */}
    <nav className="hidden lg:flex items-center space-x-6 mr-6"> {/* <--- เพิ่ม mr-6 ที่นี่ */}
        <a 
            href="/browse" 
            className="text-gray-700 text-base font-medium hover:text-blue-500 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
        >
            {t("browse")}
        </a>
        <a 
            href="/contact" 
            className="text-gray-700 text-base font-medium hover:text-blue-500 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
        >
            {t("contact")}
        </a>
    </nav>
    
    {/* Desktop Search Input (Visible only on Desktop) */}
    {/* สลับมาอยู่ด้านหลัง Nav Links และลบ mr-6 ออก */}
    <div className="hidden lg:block lg:w-[350px]"> 
        <div className="relative">
            <FaSearch 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-base" 
            />
            <input
                type="text"
                placeholder={t("search_products")}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 outline-none text-sm transition-all focus:border-blue-500"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = query.trim();
                      navigate(trimmed.length > 0 ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
                    }
                }}
            />
        </div>
    </div>
</div>

      
      {/* 2. Right Container (Mobile Icons + Controls + Hamburger) */}
      <div className="flex items-center space-x-3 lg:space-x-5">

        {/* Controls (Chat & Notification Icons for Desktop/Tablet) */}
        <div className="hidden md:flex items-center space-x-4 pr-4 border-r border-gray-200">
             {isLoggedIn ? (
                <>
                {/* Chat Icon */}
                <div 
                    className="relative cursor-pointer" 
                    onClick={handleFavoritesClick} 
                    title={t('browse')}
                >
                    <FaComment size={20} className="text-gray-600 hover:text-blue-500" />
                    {favoritesCount > 0 && (
                    <span 
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold px-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center"
                    >
                        {favoritesCount > 99 ? "99+" : favoritesCount}
                    </span>
                    )}
                </div>
                
                {/* Notifications popup */}
                <div ref={notifRef} className="relative">
                    <button 
                        className="relative p-1 focus:outline-none" 
                        onClick={() => setIsNotifOpen((v) => !v)} 
                        title="Notifications"
                    >
                        <FaBell size={20} className="text-gray-600 hover:text-blue-500" />
                        {notificationsCount > 0 && (
                        <span 
                            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold px-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center"
                        >
                            {notificationsCount > 99 ? '99+' : notificationsCount}
                        </span>
                        )}
                    </button>
                    {isNotifOpen && (
                        <div 
                            className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden"
                            style={{ maxHeight: 'calc(100vh - 80px)' }}
                        >
                            {/* Notification Content */}
                            <div className="flex items-center justify-between p-3 border-b border-gray-100 font-semibold text-gray-700">
                                <span>การแจ้งเตือน</span>
                                <button 
                                    onClick={markAllRead} 
                                    disabled={unreadChatConvs.length === 0} 
                                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${unreadChatConvs.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    อ่านแชททั้งหมด
                                </button>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {loadingNotifs ? (
                                    <div className="p-4 text-gray-500 text-center text-sm">กำลังโหลด...</div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-4 text-gray-500 text-center text-sm">ไม่มีการแจ้งเตือน</div>
                                ) : (
                                    notifications.slice(0, visibleCount).map((n) => (
                                        <button 
                                            key={n.id} 
                                            onClick={() => handleNotificationClick(n)}
                                            className="block w-full text-left p-3 border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                                        >
                                            <div className={`text-sm ${ n.type === 'chat' ? 'text-gray-800' : n.id.startsWith('admin_notif_') ? 'text-red-600' : 'text-gray-700'} font-semibold truncate`}>
                                                {n.type === 'chat' ? 'ข้อความใหม่' : n.id.startsWith('admin_notif_') ? 'การแจ้งเตือน' : 'ความคิดเห็นใหม่'}
                                            </div>
                                            <div className="text-sm text-gray-900 truncate">{n.title}</div>
                                            <div className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</div>
                                            <div className="text-xs text-gray-400 mt-1">{new Date(n.time).toLocaleString('th-TH')}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="flex gap-2 p-3 border-t border-gray-100 bg-gray-50">
                                {visibleCount < notifications.length && (
                                    <button 
                                        onClick={() => setVisibleCount((v) => Math.min(v + PAGE_SIZE, notifications.length))} 
                                        className="flex-1 py-2 px-3 rounded-lg bg-white text-gray-700 border border-gray-300 text-sm hover:bg-gray-100 transition-colors"
                                    >
                                        โหลดเพิ่มเติม
                                    </button>
                                )}
                                <button 
                                    onClick={() => { 
                                        setIsNotifOpen(false); 
                                        navigate('/chat'); 
                                    }} 
                                    className="flex-1 py-2 px-3 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors"
                                >
                                    ไปที่แชท
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                </>
             ) : (
                <div className="hidden md:flex gap-3">
                    <a 
                        href="/login" 
                        className="py-2 px-4 text-gray-700 text-sm font-medium rounded-lg transition-colors hover:bg-gray-100" 
                    >
                        {t("sign_in")}
                    </a>
                    <a 
                        href="/register" 
                        className="py-2 px-4 bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors hover:bg-blue-600" 
                    >
                        {t("sign_up")}
                    </a>
                </div>
            )}
        </div>

        {/* Language Switcher (Desktop/Tablet) */}
        <div 
          className="hidden md:flex gap-2 items-center pr-4 border-r border-gray-200 lg:pr-5"
        >
          <button 
            onClick={() => changeLanguage('en')} 
            className={`text-sm py-1 font-${i18n.language === 'en' ? "semibold" : "normal"} text-${i18n.language === 'en' ? "blue-500" : "gray-600"} hover:text-blue-500 transition-colors`}
          >
            EN
          </button>
          <span className="text-gray-400">|</span>
          <button 
            onClick={() => changeLanguage('th')} 
            className={`text-sm py-1 font-${i18n.language === 'th' ? "semibold" : "normal"} text-${i18n.language === 'th' ? "blue-500" : "gray-600"} hover:text-blue-500 transition-colors`}
          >
            TH
          </button>
        </div>

        {/* Profile menu (Desktop/Tablet) */}
        <div ref={profileRef} className="relative hidden md:block">
            {isLoggedIn && (
                <>
                    <button 
                        className={`flex items-center gap-2 p-2 px-3 rounded-full cursor-pointer transition-colors ${isProfileOpen ? "bg-blue-200" : "bg-blue-50 hover:bg-blue-100"}`} 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                    >
                        {renderAvatar('sm', true)}
                    </button>
                    
                    {/* Desktop Profile Dropdown */}
                    {isProfileOpen && (
                        <div 
                            className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl w-56 p-2 z-50 border border-gray-100"
                        >
                            <div className="flex items-center gap-3 p-3 border-b border-gray-100 mb-2">
                                {renderAvatar('lg', false)}
                                <div className="truncate">
                                    <div className="font-semibold text-sm text-gray-800 truncate">
                                        {userData ? userData.name : "Username"}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {userData ? userData.email : "user@example.com"}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                {[
                                    { href: "/profile", label: t("profile"), icon: FaUser },
                                    { href: "/dashboard", label: t("dashboard"), icon: FaTachometerAlt },
                                    { href: "/settings", label: t("settings"), icon: FaCog },
                                ].map(({ href, label, icon: Icon }) => (
                                    <a 
                                        key={href}
                                        href={href} 
                                        className="flex items-center gap-3 p-2 text-gray-700 text-sm no-underline rounded-md hover:bg-gray-100 transition-colors"
                                        onClick={() => setIsProfileOpen(false)}
                                    >
                                        <Icon size={14} />
                                        <span>{label}</span>
                                    </a>
                                ))}
                            </div>
                            
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <button 
                                    onClick={handleLogout} 
                                    className="flex items-center gap-3 p-2 text-red-500 text-sm w-full border-none background-transparent cursor-pointer text-left rounded-md hover:bg-red-50 transition-colors"
                                >
                                    <FaSignOutAlt size={14} />
                                    <span>{t("logout")}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>


        {/* Mobile Menu Icon (Hamburger - Visible on Mobile/Tablet only) */}
        <button 
          className="lg:hidden text-gray-600 p-2"
          onClick={() => {
            setIsMobileMenuOpen(!isMobileMenuOpen);
            setIsProfileOpen(false); // Close desktop dropdowns when opening mobile menu
            setIsNotifOpen(false);
          }}
        >
          {isMobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
      </div>

      
      {/* 3. Mobile Menu Overlay (Visible only when isMobileMenuOpen is true) */}
      <nav 
        className={`absolute top-full left-0 w-full bg-white border-t border-gray-200 shadow-xl lg:hidden 
        ${isMobileMenuOpen ? 'flex flex-col p-4 space-y-4' : 'hidden'}`}
      >
        
        <div className="flex flex-col space-y-1 border-b border-gray-100 pb-4">
    <h4 className="text-xs font-semibold uppercase text-gray-500 px-3 pb-1 pt-2">Navigation</h4>
    <a 
        href="/browse" 
        className="text-gray-700 text-base font-medium py-2 px-3 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => setIsMobileMenuOpen(false)}
    >
        {t("browse")}
    </a>
    <a 
        href="/contact" 
        className="text-gray-700 text-base font-medium py-2 px-3 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => setIsMobileMenuOpen(false)}
    >
        {t("contact")}
    </a>
</div>

{/* Search Input (Mobile/Tablet view) - ถูกเลื่อนมาอยู่ด้านล่าง */}
<div className="w-full">
    <div className="relative">
        <FaSearch 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-base" 
        />
        <input
            type="text"
            placeholder={t("search_products")}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 outline-none text-sm transition-all focus:border-blue-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = query.trim();
                  navigate(trimmed.length > 0 ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
                  setIsMobileMenuOpen(false);
                }
            }}
        />
    </div>
</div>
        
        {/* Account and Auth Links (Mobile) */}
        <div className="w-full space-y-1">
            {isLoggedIn ? (
                <>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 px-3 pb-1">Account</h4>
                    <a 
                        href="/profile" 
                        className="flex items-center gap-3 p-2 text-gray-700 text-sm no-underline rounded-lg hover:bg-gray-100 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <FaUser size={14} />
                        <span>{t("profile")}</span>
                    </a>
                    <a 
                        href="/dashboard" 
                        className="flex items-center gap-3 p-2 text-gray-700 text-sm no-underline rounded-lg hover:bg-gray-100 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <FaTachometerAlt size={14} />
                        <span>{t("dashboard")}</span>
                    </a>
                    <a 
                        href="/settings" 
                        className="flex items-center gap-3 p-2 text-gray-700 text-sm no-underline rounded-lg hover:bg-gray-100 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <FaCog size={14} />
                        <span>{t("settings")}</span>
                    </a>
                    <button 
                        onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                        className="flex items-center gap-3 p-2 text-red-500 text-sm w-full border-none cursor-pointer text-left rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <FaSignOutAlt size={14} />
                        <span>{t("logout")}</span>
                    </button>
                </>
            ) : (
                <div className="flex gap-3 pt-2">
                    <a 
                        href="/login" 
                        className="flex-1 text-center py-2 px-4 text-gray-700 text-sm font-medium rounded-lg transition-colors border border-gray-300 hover:bg-gray-50" 
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        {t("sign_in")}
                    </a>
                    <a 
                        href="/register" 
                        className="flex-1 text-center py-2 px-4 bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors hover:bg-blue-600" 
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        {t("sign_up")}
                    </a>
                </div>
            )}
            
            {/* Language Switcher (Mobile Menu Bottom) */}
             <div className="flex gap-2 items-center justify-center pt-4 border-t border-gray-100 mt-4">
                <button 
                    onClick={() => changeLanguage('en')} 
                    className={`text-base py-1 font-${i18n.language === 'en' ? "semibold" : "normal"} text-${i18n.language === 'en' ? "blue-500" : "gray-600"} hover:text-blue-500 transition-colors`}
                >
                    EN
                </button>
                <span className="text-gray-400">|</span>
                <button 
                    onClick={() => changeLanguage('th')} 
                    className={`text-base py-1 font-${i18n.language === 'th' ? "semibold" : "normal"} text-${i18n.language === 'th' ? "blue-500" : "gray-600"} hover:text-blue-500 transition-colors`}
                >
                    TH
                </button>
            </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;