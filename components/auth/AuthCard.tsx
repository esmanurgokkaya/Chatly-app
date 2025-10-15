"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authLogin, authSignup } from "@/lib/api"

type FormData = {
  fullname: string
  email: string
  password: string
}

export default function AuthCard() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState<FormData>({ fullname: "", email: "", password: "" })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const run = async () => {
      try {
        const resp = isLogin
          ? await authLogin(formData.email, formData.password)
          : await authSignup(formData.fullname, formData.email, formData.password)

        if (!resp.ok) {
          setError(resp.error || "Authentication failed")
          setLoading(false)
          return
        }

        // store user locally (for demo). Replace with real auth flow later.
        if (resp.user) localStorage.setItem("user", JSON.stringify(resp.user))
        router.push("/chat")
      } catch (err) {
        setError("Network error. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    void run()
  }

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Chatly
          </CardTitle>
          <CardDescription className="text-center text-base">
            {isLogin ? "Hesabınıza giriş yapın" : "Yeni hesap oluşturun"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullname">Ad Soyad</Label>
                <Input
                  id="fullname"
                  type="text"
                  placeholder="Adınız ve soyadınız"
                  value={formData.fullname}
                  onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                  required
                  className="h-11"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
              {loading ? (isLogin ? "Giriş yapılıyor..." : "Kayıt olunuyor...") : isLogin ? "Giriş Yap" : "Kayıt Ol"}
            </Button>
            {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
          </form>
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? (
                <>
                  Hesabınız yok mu? <span className="font-semibold text-primary">Kayıt olun</span>
                </>
              ) : (
                <>
                  Zaten hesabınız var mı? <span className="font-semibold text-primary">Giriş yapın</span>
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
