export async function createMessageFormData(file: File | null, textMessage: string | null): Promise<{ text?: string; image?: string } | null> {
  try {
    if (file && file instanceof File && file.size > 0) {
      const fileType = file.type.toLowerCase()
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      
      if (!allowedTypes.includes(fileType)) {
        console.error("Desteklenmeyen dosya formatı:", fileType)
        throw new Error("Desteklenmeyen dosya formatı")
      }

      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        console.error("Dosya çok büyük:", file.size)
        throw new Error("Dosya boyutu 5MB'dan büyük olamaz")
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Data = reader.result as string
          const base64Content = base64Data.split(',')[1]
          
          console.debug("Base64 içeriği hazırlandı:", {
            textLength: textMessage?.length ?? 0,
            base64Length: base64Content.length
          })
          
          resolve({
            text: textMessage?.trim() || undefined,
            image: base64Content
          })
        }
        reader.onerror = () => {
          console.error("Dosya okuma hatası:", reader.error)
          reject(new Error("Dosya okunamadı"))
        }
        reader.readAsDataURL(file)
      })
    }

    if (textMessage?.trim()) {
      return { text: textMessage.trim() }
    }

    return null
  } catch (e) {
    console.error("Mesaj hazırlama hatası:", e)
    return null
  }
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