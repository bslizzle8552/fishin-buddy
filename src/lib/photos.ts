import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
}

export async function compressAndUpload(
  file: File,
  bucket: string,
  folder: string
): Promise<string | null> {
  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${folder}/${uuidv4()}.${ext}`

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, compressed, {
        contentType: compressed.type,
        upsert: false,
      })

    if (error) throw error

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.error('Photo upload failed:', err)
    return null
  }
}

export function capturePhoto(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'

    input.onchange = () => {
      const file = input.files?.[0] || null
      resolve(file)
    }

    input.oncancel = () => resolve(null)
    input.click()
  })
}
