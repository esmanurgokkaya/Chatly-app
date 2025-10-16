"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
}

type Message = {
  id: number
  text: string
  sender: "me" | "other"
  time: string
  image?: string
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

  useEffect(() => {
    ;(async () => {
      // load user from server (authCheck) and fallback to localStorage
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
        // ignore and fallback to localStorage
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

      // load contacts and, if present, messages for the first contact
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

      // load chats
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
        console.debug("Logout API response:", result)  // Use debug instead of error
      }
    } catch (e) {
      console.debug("Logout error:", e)  // Use debug instead of error
    } finally {
      // Always clear local storage and redirect
      localStorage.removeItem("user")
      router.push("/")
    }
  }

  const handleSendMessage = async () => {
    if (!selectedContact) return
    
    // Require either text or file
    if (!(message?.trim() || selectedFile)) return

    // Keep a local reference to the current file
    const currentFile = selectedFile
    const currentText = message.trim()
    
    // Create optimistic message
    const tempId = -Date.now()
    const optimMsg: Message = {
      id: tempId,
      text: currentText,
      sender: "me",
      time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      image: previewUrl ?? undefined,
    }
    
    // Add optimistic message and clear input field
    setMessages(m => [...m, optimMsg])
    setMessage("")
    
    // Clear file states before sending to avoid double send
    if (currentFile) {
      clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
    }
    
    try {
      let resp
      
      if (currentFile) {
        // Dosyayı base64'e çevir ve mesajla birlikte gönder
        const messageData = await createMessageFormData(currentFile, message.trim())
        if (!messageData) {
          setErrorMessage("Dosya işlenirken hata oluştu")
          // Optimistik mesajı kaldır
          setMessages((prev) => prev.filter((m) => m.id !== tempId))
          return
        }
        
        // Durumları temizle
        clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
        
        // Mesajı gönder
        resp = await sendMessageToId(String(selectedContact.id), messageData)
      } else {
        // Sadece metin gönder
        resp = await sendMessageToId(String(selectedContact.id), { text: optimMsg.text })
      }

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
        
        // ensure we have authoritative currentUserId
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
        
        // replace optimistic message with server message
        setMessages((prev) => prev.map((m) => (m.id === tempId ? serverMsg : m)))
        
        // Clear file states after successful send
        if (selectedFile) {
          clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
        }
      } else {
        // remove optimistic if failed
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setErrorMessage(resp.error || "Mesaj gönderilemedi")
        
        // Clear file states on error too
        if (selectedFile) {
          clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
        }
      }
    } catch (err) {
      console.error(err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setErrorMessage("Mesaj gönderilirken hata oluştu")
      
      // Clear file states on error
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
      
      // Önce hata mesajını temizle
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
      
      // Önceki dosya durumlarını temizle
      clearFileStates(fileInputRef.current, setSelectedFile, setPreviewUrl)
      
      // Temel doğrulama
      if (!(file instanceof File)) {
        throw new Error("Geçersiz dosya seçildi")
      }
      
      // Dosya boyutu kontrolü (örn. max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size === 0 || file.size > maxSize) {
        throw new Error(`Dosya boyutu 0 veya ${maxSize / (1024 * 1024)}MB'dan büyük olamaz`)
      }
      
      // Dosya tipi kontrolü
      if (!file.type.startsWith('image/')) {
        throw new Error("Lütfen bir resim dosyası seçin")
      }
      
      // İzin verilen formatlar
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Sadece JPEG, PNG, GIF veya WEBP formatları desteklenir")
      }
      
      // Yeni dosyayı ayarla
      setSelectedFile(file)
      
      // Önizleme oluştur
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
    <div className="flex h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Profile Header */}
        <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {getInitials(user.fullname)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-foreground">{user.fullname}</h2>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          {errorMessage && <div className="text-xs text-destructive mt-2">{errorMessage}</div>}
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

            {(activeTab === "contacts" ? contacts : chats).map((contact) => (
              <button
                key={contact.id}
                onClick={async () => {
                  setSelectedContact(contact)
                  setActiveTab("chat")
                  setMessagesLoading(true)
                  try {
                    const resp = await getMessagesByUserId(String(contact.id))
                    if (resp.ok && resp.messages) {
                            const uid = currentUserId ?? (user as any)?.id ?? (user as any)?._id
                            const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/api\/?$/i, "")
                            const normalizeImage = (img: any) => {
                              if (!img) return undefined
                              const s = String(img)
                              if (s.startsWith("http://") || s.startsWith("https://")) return s
                              if (s.startsWith("/")) return `${apiBase}${s}`
                              return s
                            }
                            setMessages(
                              resp.messages.map((m: any, idx: number) => ({
                                id: idx + 1,
                                text: m.text || m.message || "",
                                image: normalizeImage(m.image ?? m.imageUrl ?? m.fileUrl ?? m.url ?? m.file),
                                sender: uid && (m.senderId?.toString ? m.senderId.toString() : m.senderId) === (uid?.toString ? uid.toString() : uid) ? "me" : "other",
                                time: m.createdAt
                                  ? new Date(m.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                                  : new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
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
                }}
                className={cn(
                  "w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent/50 transition-colors mb-1",
                  selectedContact?.id === contact.id && "bg-accent",
                )}
              >
                <div className="relative">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  {contact.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full ring-2 ring-card" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium text-sm text-foreground">{contact.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
                </div>
              </button>
            ))}
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
                <p className="text-xs text-muted-foreground">{selectedContact.online ? "Çevrimiçi" : "Çevrimdışı"}</p>
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
                          ? "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                          : "bg-card border border-border text-foreground",
                      )}
                    >
                      {msg.image && (
                        <img
                          src={msg.image || "/placeholder.svg"}
                          alt="Uploaded"
                          className="rounded-lg mb-2 max-w-full"
                        />
                      )}
                      {msg.text && <p className="text-sm">{msg.text}</p>}
                      <p
                        className={cn(
                          "text-xs mt-1",
                          msg.sender === "me" ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card space-y-4">
              {previewUrl && (
                <div className="relative w-48 h-48 mx-auto">
                  <img src={previewUrl} alt="preview" className="w-full h-full rounded-lg object-cover shadow-lg" />
                  <button
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
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
                    // Önce input'u sıfırla
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                      fileInputRef.current.click();
                    }
                  }}
                  className="text-muted-foreground hover:text-primary"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 h-11"
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  className="h-11 w-11 bg-gradient-to-r from-primary to-accent hover:opacity-90"
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

