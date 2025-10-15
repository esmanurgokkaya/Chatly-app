export async function createMessageFormData(file: File | null, text: string | null): Promise<FormData | null> {
  // Yeni bir FormData oluştur
  const fd = new FormData()
  
  // Önce dosyayı ekle (varsa)
  if (file && file instanceof File && file.size > 0) {
    try {
      // Dosyayı "image" adıyla ekle (backend'in beklediği parametre adı)
      fd.append("image", file)
      
      console.debug("Dosya ekleniyor:", {
        ad: file.name,
        boyut: file.size,
        tip: file.type
      })
    } catch (e) {
      console.error("Dosya eklenirken hata:", e)
      return null
    }
  }

  // Sonra mesaj metnini ekle (varsa)
  if (text?.trim()) {
    fd.append("text", text.trim())  // "text" olarak değiştirildi
  }

  // Son bir kontrol yap
  try {
    const kontrol = Array.from(fd.entries())
    console.debug("FormData içeriği:", kontrol.map(([k, v]) => {
      if (v instanceof File) return `${k}: dosya (${v.name})`
      return `${k}: ${v}`
    }))
  } catch (e) {
    console.error("FormData kontrol hatası:", e)
  }
  
  return fd
}

export function clearFileStates(
  fileInput: HTMLInputElement | null,
  setSelectedFile: (file: null) => void,
  setPreviewUrl: (url: null) => void
) {
  try {
    // Reset all states in a try-catch to ensure all get reset
    if (fileInput) {
      fileInput.value = ''
    }
    setSelectedFile(null)
    setPreviewUrl(null)
  } catch (e) {
    console.error('Error clearing file states:', e)
    // Try individual resets if batch reset failed
    try { fileInput && (fileInput.value = '') } catch (e) {}
    try { setSelectedFile(null) } catch (e) {}
    try { setPreviewUrl(null) } catch (e) {}
  }
}