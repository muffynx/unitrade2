import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { FaSearch, FaUser, FaEnvelope, FaTrash, FaCircle, FaWifi, FaPaperPlane, FaSync } from "react-icons/fa";
import AdminLayout from "../../layouts/AdminLayout";

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string; // role เป็น optional เพราะ user ปกติอาจไม่มี
}

interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: {
    content: string;
    sender: User;
    createdAt: string;
  };
  isAdminChat: boolean;
  userId: string;
  adminId: string;
  unreadCount: Map<string, number>;
  createdAt: string;
  updatedAt: string;
  userInfo?: User; // สำหรับกรณีที่ backend ส่งข้อมูล user มาให้แล้ว
}

interface Message {
  _id: string;
  sender: User;
  content: string;
  createdAt: string;
  isAdminMessage: boolean;
  messageType?: string;
  attachments?: {
    url: string;
    filename: string;
    fileType: string;
    fileSize: number;
  }[];
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

// Custom Hook สำหรับ Real-time Messages (แบบง่าย)
const useConversationStream = (conversationId: string | null, token: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!conversationId || !token) {
      setIsConnected(false);
      return;
    }

    // ปิดการเชื่อมต่อเก่าถ้ามี
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const API_URL = import.meta.env.VITE_API_URL || "https://unitrade-yrd9.onrender.com";
    const url = new URL(`${API_URL}/api/conversations/${conversationId}/stream`);
    url.searchParams.set('token', token);

    try {
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ Connected to real-time chat');
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          if (event.data === ': heartbeat' || event.data === ': ping') {
            return;
          }

          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            return;
          }

          // รับข้อความใหม่
          if (data._id && data.content && data.sender) {
            setMessages(prev => {
              // หลีกเลี่ยงข้อความซ้ำ
              if (prev.some(msg => msg._id === data._id)) {
                return prev;
              }
              return [...prev, data];
            });
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);
      };

    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setIsConnected(false);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [conversationId, token]);

  const addMessage = (message: Message) => {
    setMessages(prev => {
      if (prev.some(msg => msg._id === message._id)) {
        return prev;
      }
      return [...prev, message];
    });
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return { 
    messages, 
    setMessages, 
    addMessage, 
    clearMessages,
    isConnected
  };
};

export default function AdminMessageCenter() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [streamToken, setStreamToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || "https://unitrade-yrd9.onrender.com";
  const token = localStorage.getItem("adminToken");

  // ใช้ custom hook สำหรับ real-time messages
  const { 
    messages, 
    setMessages, 
    addMessage, 
    clearMessages,
    isConnected
  } = useConversationStream(
    selectedConversation?._id || null,
    streamToken
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Toast Notification
  const showToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: Toast = { id, message, type };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // โหลดรายการ conversations
  const fetchConversations = async () => {
    try {
      // ลองใช้ endpoint admin ก่อน
      try {
        const res = await axios.get(`${API_URL}/api/conversations/admin/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversations(res.data);
      } catch (adminErr) {
        // Fallback: ใช้ endpoint ปกติแล้ว filter เอง
        console.log('Using fallback endpoint');
        const res = await axios.get(`${API_URL}/api/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const adminConversations = res.data.filter((conv: Conversation) => conv.isAdminChat);
        setConversations(adminConversations);
      }
    } catch (err: any) {
      console.error("Fetch conversations error:", err);
      showToast("ไม่สามารถโหลดรายการการสนทนาได้", "error");
    } finally {
      setLoading(false);
    }
  };

  // โหลด messages และ token สำหรับ real-time
  const fetchMessagesAndToken = async (conversationId: string) => {
    try {
      // โหลดข้อความเดิม
      const messagesRes = await axios.get(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(messagesRes.data);

      // ขอ token สำหรับ real-time connection
      try {
        const tokenRes = await axios.get(`${API_URL}/api/conversations/${conversationId}/token`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStreamToken(tokenRes.data.token);
      } catch (tokenErr) {
        console.log('Token endpoint not available, using basic token');
        setStreamToken(token); // ใช้ token ปกติเป็น fallback
      }

    } catch (err: any) {
      console.error("Fetch messages/token error:", err);
      showToast("ไม่สามารถโหลดข้อความได้", "error");
    }
  };

  // ส่งข้อความใหม่
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      // ลองใช้ admin-messages endpoint ก่อน
      let res;
      try {
        res = await axios.post(
          `${API_URL}/api/conversations/${selectedConversation._id}/admin-messages`,
          { content: newMessage },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (adminMsgErr) {
        // Fallback: ใช้ endpoint ปกติ
        res = await axios.post(
          `${API_URL}/api/conversations/${selectedConversation._id}/messages`,
          { content: newMessage },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      // เพิ่มข้อความใหม่เข้าไปใน list
      addMessage(res.data);
      setNewMessage("");

      // อัพเดท last message ใน conversations list
      setConversations(prev => 
        prev.map(conv => 
          conv._id === selectedConversation._id 
            ? {
                ...conv,
                lastMessage: {
                  content: newMessage,
                  sender: res.data.sender,
                  createdAt: new Date().toISOString()
                }
              }
            : conv
        )
      );

    } catch (err: any) {
      console.error("Send message error:", err);
      showToast("ส่งข้อความไม่สำเร็จ", "error");
    } finally {
      setSending(false);
    }
  };

  // ลบ conversation
  const deleteConversation = async (conversationId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบการสนทนานี้?")) return;

    try {
      await axios.delete(`${API_URL}/api/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
        clearMessages();
        setStreamToken(null);
      }

      showToast("ลบการสนทนาสำเร็จ", "success");
    } catch (err: any) {
      console.error("Delete conversation error:", err);
      showToast("ลบการสนทนาไม่สำเร็จ", "error");
    }
  };

  // หา user ที่ไม่ใช่ admin (user ปกติ)
  const getOtherUser = (conversation: Conversation): User | null => {
    // ใช้ userInfo ที่ backend ส่งมา (ถ้ามี)
    if (conversation.userInfo) {
      return conversation.userInfo;
    }
    
    // หาจาก participants โดยหา user ที่ไม่มี role หรือ role ไม่ใช่ admin
    const user = conversation.participants.find(p => !p.role || p.role !== "admin");
    
    // Fallback: ใช้ userId field
    if (!user && conversation.userId) {
      return conversation.participants.find(p => p._id === conversation.userId) || null;
    }
    
    // Fallback สุดท้าย: ใช้ participant คนแรกที่ไม่ใช่ admin
    return user || conversation.participants[0] || null;
  };

  // ค้นหา conversations
  const filteredConversations = conversations.filter(conv => {
    const user = getOtherUser(conv);
    return (
      user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lastMessage.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Format วันที่
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return "เมื่อวาน";
    } else if (days < 7) {
      return `${days} วันที่แล้ว`;
    } else {
      return date.toLocaleDateString("th-TH", { day: '2-digit', month: 'short' });
    }
  };

  // Format วันที่สำหรับข้อความ
  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("th-TH", { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // เมื่อเลือก conversation ใหม่
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    clearMessages();
    setStreamToken(null);
    fetchMessagesAndToken(conversation._id);
  };

  // Refresh conversations list
  const handleRefresh = () => {
    setLoading(true);
    fetchConversations();
  };

  // Handle key press for sending message
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <AdminLayout>
      <div className="flex h-screen bg-white">
        {/* Sidebar - Conversations List */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-800">ศูนย์ข้อความ</h1>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRefresh}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="รีเฟรช"
                >
                  <FaSync className={loading ? "animate-spin" : ""} />
                </button>
                <div className="flex items-center space-x-2 text-sm">
                  <FaWifi className={isConnected ? "text-green-500" : "text-gray-400"} />
                  <span className={isConnected ? "text-green-600" : "text-gray-500"}>
                    {isConnected ? "ออนไลน์" : "ออฟไลน์"}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Search Box */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาผู้ใช้หรือข้อความ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FaEnvelope className="mx-auto text-4xl mb-2 text-gray-300" />
                <p>ไม่มีการสนทนา</p>
                {searchTerm && (
                  <p className="text-sm mt-1">ไม่พบผลลัพธ์สำหรับ "{searchTerm}"</p>
                )}
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const user = getOtherUser(conversation);
                const isSelected = selectedConversation?._id === conversation._id;
                
                return (
                  <div
                    key={conversation._id}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50 border-blue-200" : ""
                    }`}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <FaUser className="text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-800 truncate">
                            {user?.name || "ไม่ระบุชื่อ"}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conversation._id);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                        title="ลบการสนทนา"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 truncate flex-1 mr-2">
                        {conversation.lastMessage.content}
                      </p>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatDate(conversation.lastMessage.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Content - Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <FaUser className="text-green-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-800">
                        {getOtherUser(selectedConversation)?.name || "ไม่ระบุชื่อ"}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {getOtherUser(selectedConversation)?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <FaCircle className={isConnected ? "text-green-500" : "text-gray-400"} size={8} />
                    <span>{isConnected ? "ออนไลน์" : "กำลังเชื่อมต่อ..."}</span>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 bg-white">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FaEnvelope className="mx-auto text-4xl mb-2 text-gray-300" />
                    <p>ยังไม่มีข้อความ</p>
                    <p className="text-sm text-gray-400 mt-1">เริ่มการสนทนาด้วยการส่งข้อความแรก</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isAdmin = message.isAdminMessage;
                      const hasImage = message.attachments && message.attachments.some(att => 
                        att.fileType.startsWith('image/')
                      );
                      const imageAttachment = hasImage ? message.attachments![0] : null;

                      if (hasImage && imageAttachment) {
                        return (
                          <div
                            key={message._id}
                            className={`flex ${isAdmin ? "justify-end" : "justify-start"} mb-3`}
                          >
                            <div className="max-w-xs lg:max-w-md">
                              <div className="relative">
                                <img 
                                  src={imageAttachment.url} 
                                  alt="Attached image"
                                  className="max-w-full h-auto rounded-xl cursor-pointer hover:opacity-95 transition-opacity shadow-sm"
                                  onClick={() => window.open(imageAttachment.url, '_blank')}
                                />
                              </div>
                              
                              {message.content && message.content !== "ส่งรูปภาพ" && message.content !== "ส่งไฟล์" && (
                                <div className={`mt-2 px-3 py-2 rounded-lg max-w-full ${
                                  isAdmin 
                                    ? "bg-blue-500 text-white" 
                                    : "bg-gray-100 text-gray-800"
                                }`}>
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {message.content}
                                  </p>
                                </div>
                              )}
                              
                              <div className={`text-xs mt-1 px-1 ${isAdmin ? "text-blue-600 text-right" : "text-gray-500"}`}>
                                {formatMessageTime(message.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={message._id}
                          className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                              isAdmin
                                ? "bg-blue-500 text-white rounded-br-none"
                                : "bg-gray-100 text-gray-800 rounded-bl-none"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                            <div className={`text-xs mt-1 ${isAdmin ? "text-blue-100" : "text-gray-500"}`}>
                              {formatMessageTime(message.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex space-x-4">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="พิมพ์ข้อความ..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                      disabled={sending || !isConnected}
                    />
                    {newMessage && (
                      <button
                        onClick={() => setNewMessage('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending || !isConnected}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors font-medium flex items-center space-x-2"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <FaPaperPlane size={14} />
                    )}
                    <span>{sending ? "กำลังส่ง..." : "ส่ง"}</span>
                  </button>
                </div>
                {!isConnected && (
                  <p className="text-xs text-orange-600 mt-2 flex items-center space-x-1">
                    <FaCircle className="text-orange-500" size={8} />
                    <span>กำลังเชื่อมต่อระบบเรียลไทม์... อาจมีการดีเลย์ในการรับข้อความ</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center bg-white">
              <div className="text-center">
                <FaEnvelope className="mx-auto text-6xl text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">เลือกการสนทนา</h3>
                <p className="text-gray-500 max-w-md">
                  เลือกการสนทนาจากรายการด้านข้างเพื่อเริ่มการสนทนากับผู้ใช้
                </p>
                {conversations.length === 0 && !loading && (
                  <p className="text-sm text-gray-400 mt-2">
                    ยังไม่มีการสนทนาใดๆ เมื่อมีผู้ใช้ส่งข้อความถึงผู้ดูแลระบบ การสนทนาจะปรากฏที่นี่
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-6 py-3 rounded-lg shadow-lg text-white font-medium min-w-80 transform transition-all duration-300 ${
              toast.type === "success" 
                ? "bg-green-500 hover:bg-green-600" 
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{toast.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-4 text-white hover:text-gray-200 text-lg"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}