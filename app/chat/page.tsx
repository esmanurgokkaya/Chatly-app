"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useSocket } from "@/context/socket-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LogOut, Send, ImageIcon, MessageCircle, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { getContacts, getMessagesByUserId, sendMessageToId, getChats } from "@/lib/chat"
import { authCheck, authLogout } from "@/lib/api"
import { createMessageFormData, clearFileStates } from "@/lib/upload"

type User = {
  id?: string
  fullname: string
  email: string
}

type Contact = {
  id: number
  name: string
  avatar: string
  lastMessage: string
  online: boolean
  isWriting?: boolean
}

type Message = {
  id: number
  text: string
  sender: "me" | "other"
  time: string
  image?: string
  status?: 'sent' | 'delivered' | 'read'
}

const emptyContacts: Contact[] = []

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"chat" | "contacts">("contacts")
  const [contacts, setContacts] = useState<Contact[]>(emptyContacts)
  const [chats, setChats] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const { socket, onlineUsers, typingUsers, sendTypingStatus } = useSocket()
  const [message, setMessage] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [loadingChats, setLoadingChats] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (socket) {
      socket.on('userTyping', ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
        setChats(prevChats => prevChats.map(chat => {
          if (String(chat.id) === String(userId)) {
            return { ...chat, isWriting: isTyping };
          }
          return chat;
        }));
      });

      socket.on('newMessage', async (message: any) => {
        console.log('Received new message:', message);
        
        setChats(prevChats => prevChats.map(chat => {
          if (String(chat.id) === String(message.senderId)) {
            return {
              ...chat,
              lastMessage: message.text || message.message || "",
              isWriting: false 
            };
          }
          return chat;
        }));

        if (selectedContact && String(message.senderId) === String(selectedContact.id)) {
          const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/api\/?$/i, "");
          const normalizeImage = (img: any) => {
            if (!img) return undefined;
            const s = String(img);
            if (s.startsWith("http://") || s.startsWith("https://")) return s;
            if (s.startsWith("/")) return `${apiBase}${s}`;
            return s;
          };

          const messageExists = messages.some(m => 
            m.id === message._id || 
            (m.text === message.text && m.time === message.time)
          );

          if (!messageExists) {
            setMessages(prev => [...prev, {
              id: message._id || Date.now(),
              text: message.text || message.message || "",
              image: normalizeImage(message.image ?? message.imageUrl ?? message.fileUrl ?? message.url ?? message.file),
              sender: "other",
              time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
              status: 'delivered'
            }]);

            socket.emit('messageRead', { 
              messageId: message._id, 
              senderId: message.senderId,
              recipientId: message.recipientId
            });

            socket.emit('messageReceived', {
              messageId: message._id,
              senderId: message.senderId,
              recipientId: message.recipientId
            });
          }
        }
      });

      socket.on('userStatus', ({ userId, status }: { userId: string, status: boolean }) => {
        if (selectedContact && String(selectedContact.id) === String(userId)) {
          setSelectedContact(prev => prev ? {...prev, online: status} : null);
        }

        setContacts(prev => prev.map(contact => 
          String(contact.id) === String(userId) ? {...contact, online: status} : contact
        ));

        setChats(prev => prev.map(chat => 
          String(chat.id) === String(userId) ? {...chat, online: status} : chat
        ));
      });

      socket.on('messageStatus', ({ messageId, status }: { messageId: string, status: 'delivered' | 'read' }) => {
        setMessages(prev => prev.map(msg => 
          msg.id.toString() === messageId ? { ...msg, status } : msg
        ));
      });

      return () => {
        socket.off('newMessage');
        socket.off('userStatus');
        socket.off('messageStatus');
        socket.off('userTyping');
      };
    }
  }, [socket, selectedContact]);

  useEffect(() => {
    if (socket) {
      socket.on('reconnect', () => {
        console.log('Socket reconnected, rejoining chat...');
        if (selectedContact) {
          socket.emit('join', { recipientId: String(selectedContact.id) });
        }
      });

      return () => {
        socket.off('reconnect');
      };
    }
  }, [socket, selectedContact]);

  useEffect(() => {
    ;(async () => {
      let parsedUser: any = null
      let authoritativeId: string | undefined = undefined
      try {
        const check = await authCheck()
        if (check.ok && check.user) {
          parsedUser = check.user
          localStorage.setItem("user", JSON.stringify(parsedUser))
          setUser(parsedUser)
          authoritativeId = parsedUser?.id ?? parsedUser?._id
          if (authoritativeId) setCurrentUserId(String(authoritativeId))
        }
      } catch (err) {
      }

      if (!parsedUser) {
        const userData = localStorage.getItem("user")
        if (!userData) {
          router.push("/")
          return
        }
        parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      }

      try {
        const resp = await getContacts()
        console.debug("getContacts response:", resp)
        if (resp.ok && resp.contacts) {
          const mapped = resp.contacts.map((c: any) => ({
            id: c._id ?? c.id ?? c.email ?? Math.random(),
            name: c.fullName ?? c.name ?? c.email ?? "Unknown",
            avatar: c.profilePic ?? c.avatar ?? "",
            lastMessage: c.lastMessage ?? "",
            online: c.online ?? false,
          }))
          setContacts(mapped)

          if (mapped.length > 0 && !selectedContact) {
            setSelectedContact(mapped[0])
            setMessagesLoading(true)
            try {
              const respMsgs = await getMessagesByUserId(String(mapped[0].id))
              if (respMsgs.ok && respMsgs.messages) {
                const uid = authoritativeId ?? (parsedUser?.id ?? parsedUser?._id)
                const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/api\/?$/i, "")
                const normalizeImage = (img: any) => {
                  if (!img) return undefined
                  const s = String(img)
                  if (s.startsWith("http://") || s.startsWith("https://")) return s
                  if (s.startsWith("/")) return `${apiBase}${s}`
                  return s
                }
                setMessages(
                  respMsgs.messages.map((m: any, idx: number) => ({
                    id: m._id ?? idx + 1,
                    text: m.text || m.message || "",
                    image: normalizeImage(m.image ?? m.imageUrl ?? m.fileUrl ?? m.url ?? m.file),
                    sender: uid && (m.senderId?.toString ? m.senderId.toString() : m.senderId) === (uid?.toString ? uid.toString() : uid) ? "me" : "other",
                    time: m.createdAt
                      ? new Date(m.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
                      : new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
                  })),
                )
              } else {
                setMessages([])
              }
            } catch (err) {
              console.error(err)
              setErrorMessage("Mesajlar yüklenirken hata oluştu")
            } finally {
              setMessagesLoading(false)
            }
          }
        }
      } catch (err) {
        console.error("Error loading contacts:", err)
        setErrorMessage("Kişiler yüklenirken hata oluştu")
      }

      try {
        const resp = await getChats()
        console.debug("getChats response:", resp)
        if (resp.ok && resp.chats) {
          const mapped = resp.chats.map((c: any) => ({
            id: c._id ?? c.id ?? Math.random(),
            name: c.name ?? c.fullName ?? c.participantName ?? "Unknown",
            avatar: c.avatar ?? c.profilePic ?? "",
            lastMessage: c.lastMessage ?? c.last?.text ?? "",
            online: c.online ?? false,
          }))
          setChats(mapped)
        }
      } catch (err) {
        console.error("Error loading chats:", err)
        setErrorMessage("Sohbetler yüklenirken hata oluştu")
      }
    })()
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleLogout = async () => {
    try {
      const result = await authLogout()
      if (!result.ok) {
        console.debug("Logout API response:", result)  
      }
    } catch (e) {
      console.debug("Logout error:", e)  
    } finally {
      localStorage.removeItem("user")
      router.push("/")
    }
  }

  const handleSendMessage = async () => {
    if (!selectedContact) return
    
    if (!(message?.trim() || selectedFile)) return

    const currentFile = selectedFile
    const currentText = message.trim()
    
    const tempId = -Date.now()
    const optimMsg: Message = {
      id: tempId,
      text: currentText,
      sender: "me",
      time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      image: previewUrl ?? undefined,
      status: 'sent',
    }
    
    setMessages(m => [...m, optimMsg])
    setMessage("")
    
    if (currentFile) {
      clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
    }
    
    try {
      let resp;
      let messageData;
      
      if (currentFile) {
        messageData = await createMessageFormData(currentFile, message.trim())
        if (!messageData) {
          setErrorMessage("Dosya işlenirken hata oluştu")
          setMessages((prev) => prev.filter((m) => m.id !== tempId))
          return
        }
        
        clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
      } else {
        messageData = { text: optimMsg.text }
      }

      if (socket && socket.connected) {
        socket.emit('sendMessage', {
          recipientId: String(selectedContact.id),
          senderId: currentUserId,
          ...messageData,
          createdAt: new Date().toISOString()
        });
      }

      resp = await sendMessageToId(String(selectedContact.id), messageData)

      if (resp.ok && resp.message) {
        const serverRaw = resp.message as any
        const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/api\/?$/i, "")
        const normalizeImage = (img: any) => {
          if (!img) return undefined
          const s = String(img)
          if (s.startsWith("http://") || s.startsWith("https://")) return s
          if (s.startsWith("/")) return `${apiBase}${s}`
          return s
        }
        
        let uid = currentUserId
        if (!uid) {
          const ac = await authCheck()
          if (ac.ok && ac.user && ac.user.id) {
            uid = String(ac.user.id)
            setCurrentUserId(uid)
          }
        }
        
        const senderSide = uid && (serverRaw.senderId?.toString ? serverRaw.senderId.toString() : serverRaw.senderId) === (uid?.toString ? uid.toString() : uid) ? "me" : "other"
        const serverMsg: Message = {
          id: serverRaw._id ?? Date.now(),
          text: serverRaw.text || serverRaw.message || "",
          image: normalizeImage(serverRaw.image ?? serverRaw.imageUrl ?? serverRaw.fileUrl ?? serverRaw.url ?? serverRaw.file),
          sender: senderSide,
          time: serverRaw.createdAt
            ? new Date(serverRaw.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
            : new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        }
        
        setMessages((prev) => prev.map((m) => (m.id === tempId ? serverMsg : m)))
        
        if (selectedFile) {
          clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
        }
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setErrorMessage(resp.error || "Mesaj gönderilemedi")
        
        if (selectedFile) {
          clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
        }
      }
    } catch (err) {
      console.error(err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setErrorMessage("Mesaj gönderilirken hata oluştu")
      
      if (selectedFile) {
        clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
      }
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      console.log('Dosya yükleme başladı', {
        files: e.target.files,
        fileCount: e.target.files?.length,
        inputValue: e.target.value
      });
      
      setErrorMessage(null)
      
      const file = e.target.files?.[0]
      console.log('Seçilen dosya:', {
        name: file?.name,
        type: file?.type,
        size: file?.size
      });
      
      if (!file) {
        console.log('Dosya seçilmedi veya seçim iptal edildi');
        return
      }
      
      clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
      
      if (!(file instanceof File)) {
        throw new Error("Geçersiz dosya seçildi")
      }
      
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size === 0 || file.size > maxSize) {
        throw new Error(`Dosya boyutu 0 veya ${maxSize / (1024 * 1024)}MB'dan büyük olamaz`)
      }
      
      if (!file.type.startsWith('image/')) {
        throw new Error("Lütfen bir resim dosyası seçin")
      }
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Sadece JPEG, PNG, GIF veya WEBP formatları desteklenir")
      }
      
      setSelectedFile(file)
      
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.onerror = () => {
        console.error('Önizleme oluşturma hatası:', reader.error)
        throw new Error("Resim önizleme oluşturulamadı")
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Dosya yükleme hatası:', error)
      setErrorMessage(error instanceof Error ? error.message : "Dosya yüklenirken bir hata oluştu")
      clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-card/50 backdrop-blur-sm border-r border-border flex flex-col">
        {/* Profile Header */}
        <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-primary/20 shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
                  {getInitials(user.fullname)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-foreground">{user.fullname}</h2>
                <p className="text-xs text-muted-foreground/80">{user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors duration-200"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          {errorMessage && <div className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded-md">{errorMessage}</div>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-muted/30">
          <button
            onClick={async () => {
              setErrorMessage(null)
              setLoadingChats(true)
              try {
                const resp = await getChats()
                console.debug("getChats onClick response:", resp)
                if (resp.ok && resp.chats) {
                  const mapped = resp.chats.map((c: any) => ({
                    id: c._id ?? c.id ?? Math.random(),
                    name: c.name ?? c.fullName ?? c.participantName ?? "Unknown",
                    avatar: c.avatar ?? c.profilePic ?? "",
                    lastMessage: c.lastMessage ?? c.last?.text ?? "",
                    online: c.online ?? false,
                  }))
                  setChats(mapped)
                } else {
                  setErrorMessage(resp.error || "Sohbetler yüklenemedi")
                }
              } catch (err) {
                console.error(err)
                setErrorMessage("Sohbetler yüklenirken hata oluştu")
              } finally {
                setLoadingChats(false)
                setActiveTab("chat")
              }
            }}
            className={cn(
              "flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2",
              activeTab === "chat"
                ? "text-primary border-b-2 border-primary bg-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageCircle className="h-4 w-4" />
            {loadingChats ? "Yükleniyor..." : "Sohbetler"}
          </button>
          <button
            onClick={async () => {
              setErrorMessage(null)
              setLoadingContacts(true)
              try {
                const resp = await getContacts()
                console.debug("getContacts onClick response:", resp)
                if (resp.ok && resp.contacts) {
                  const mapped = resp.contacts.map((c: any) => ({
                    id: c._id ?? c.id ?? c.email ?? Math.random(),
                    name: c.fullName ?? c.name ?? c.email ?? "Unknown",
                    avatar: c.profilePic ?? c.avatar ?? "",
                    lastMessage: c.lastMessage ?? "",
                    online: c.online ?? false,
                  }))
                  setContacts(mapped)
                } else {
                  setErrorMessage(resp.error || "Kişiler yüklenemedi")
                }
              } catch (err) {
                console.error(err)
                setErrorMessage("Kişiler yüklenirken hata oluştu")
              } finally {
                setLoadingContacts(false)
                setActiveTab("contacts")
              }
            }}
            className={cn(
              "flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2",
              activeTab === "contacts"
                ? "text-primary border-b-2 border-primary bg-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-4 w-4" />
            {loadingContacts ? "Yükleniyor..." : "Kişiler"}
          </button>
        </div>

        {/* Contacts / Chats List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {activeTab === "contacts" && contacts.length === 0 && (
              <div className="text-sm text-muted-foreground p-3">Kişi bulunamadı</div>
            )}

            {activeTab === "chat" && chats.length === 0 && (
              <div className="text-sm text-muted-foreground p-3">Sohbet bulunamadı</div>
            )}

            {(activeTab === "contacts" ? contacts : chats).map((contact) => {
              const isOnline = onlineUsers.includes(String(contact.id));
              return (
                <button
                  key={contact.id}
                  onClick={async () => {
                    setSelectedContact({...contact, online: isOnline});
                    setActiveTab("chat");
                    setMessagesLoading(true);
                    try {
                      const resp = await getMessagesByUserId(String(contact.id));
                      if (resp.ok && resp.messages) {
                        const uid = currentUserId ?? (user as any)?.id ?? (user as any)?._id;
                        const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/api\/?$/i, "");
                        const normalizeImage = (img: any) => {
                          if (!img) return undefined;
                          const s = String(img);
                          if (s.startsWith("http://") || s.startsWith("https://")) return s;
                          if (s.startsWith("/")) return `${apiBase}${s}`;
                          return s;
                        };
                        setMessages(
                          resp.messages.map((m: any, idx: number) => ({
                            id: idx + 1,
                            text: m.text || m.message || "",
                            image: normalizeImage(m.image ?? m.imageUrl ?? m.fileUrl ?? m.url ?? m.file),
                            sender: uid && (m.senderId?.toString ? m.senderId.toString() : m.senderId) === (uid?.toString ? uid.toString() : uid) ? "me" : "other",
                            time: m.createdAt
                              ? new Date(m.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                              : new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                          }))
                        );
                      } else {
                        setMessages([]);
                      }
                    } catch (err) {
                      console.error(err);
                      setErrorMessage("Mesajlar yüklenirken hata oluştu");
                    } finally {
                      setMessagesLoading(false);
                    }
                  }}
                  className={cn(
                    "w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-200 mb-1",
                    "hover:bg-accent/10 hover:scale-[0.99] active:scale-[0.97]",
                    selectedContact?.id === contact.id ? "bg-accent/15 shadow-sm" : "bg-transparent"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-11 w-11 ring-2 ring-border shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-medium">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 bg-[var(--online)] rounded-full ring-2 ring-background animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-sm text-foreground">{contact.name}</h3>
                    <p className={cn(
                      "text-xs truncate",
                      contact.isWriting 
                        ? "text-[var(--typing)] font-medium"
                        : "text-muted-foreground"
                    )}>
                      {contact.isWriting ? "Yazıyor..." : contact.lastMessage}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1.5">
                    <span className="text-xs text-muted-foreground/70">
                      {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {contact.online && (
                      <div className="px-1.5 py-0.5 bg-[var(--online)]/10 rounded-full">
                        <span className="text-[10px] text-[var(--online)]">çevrimiçi</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
  <div className="flex-1 flex flex-col min-h-0">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-border bg-card px-6 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {getInitials(selectedContact.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-foreground">{selectedContact.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {typingUsers.get(String(selectedContact.id)) 
                    ? "Yazıyor..." 
                    : selectedContact.online 
                      ? "Çevrimiçi" 
                      : "Çevrimdışı"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6 min-h-0">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.sender === "me" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2",
                        msg.sender === "me"
                          ? "bg-[var(--message-sent)] text-white shadow-[0_2px_8px_var(--message-sent-shadow)] ml-auto"
                          : "bg-[var(--message-received)] text-foreground shadow-[0_2px_8px_var(--message-received-shadow)]",
                        msg.image && "p-2"
                      )}
                    >
                      {msg.image && (
                        <img
                          src={msg.image || "/placeholder.svg"}
                          alt="Uploaded"
                          className="rounded-lg mb-2 max-w-full shadow-md hover:scale-[0.98] transition-transform duration-200 cursor-zoom-in"
                        />
                      )}
                      {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <p
                          className={cn(
                            "text-[11px]",
                            msg.sender === "me" ? "text-primary-foreground/80" : "text-muted-foreground/80",
                          )}
                        >
                          {msg.time}
                        </p>
                        {msg.sender === "me" && msg.status && (
                          <span className={cn(
                            "text-xs ml-1",
                            msg.status === 'read' ? "text-sky-400" : "text-primary-foreground/80"
                          )}>
                            {msg.status === 'sent' && "✓"}
                            {msg.status === 'delivered' && "✓✓"}
                            {msg.status === 'read' && "✓✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm space-y-4">
              {previewUrl && (
                <div className="relative w-48 h-48 mx-auto group">
                  <img src={previewUrl} alt="preview" className="w-full h-full rounded-lg object-cover shadow-lg transition-transform duration-200 group-hover:scale-[0.98]" />
                  <button
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-white transition-colors duration-200"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-background rounded-lg p-1 shadow-sm">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    console.log('onChange tetiklendi', e.target.files);
                    handleImageUpload(e);
                  }}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('Resim seçme butonu tıklandı');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                      fileInputRef.current.click();
                    }
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors duration-200"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <Input
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (selectedContact) {
                      if (!isTyping) {
                        setIsTyping(true);
                        sendTypingStatus(String(selectedContact.id), true);
                      }
                      
                      if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                      }
                      
                      typingTimeoutRef.current = setTimeout(() => {
                        setIsTyping(false);
                        sendTypingStatus(String(selectedContact.id), false);
                      }, 2000);
                    }
                  }}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 h-11 bg-transparent border-0 focus-visible:ring-0"
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  className={cn(
                    "h-11 w-11 bg-gradient-to-r from-primary to-accent text-white shadow-md",
                    "hover:opacity-90 transition-all duration-200",
                    "active:scale-95"
                  )}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Bir sohbet seçin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

