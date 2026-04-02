import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
}

export interface UploadResult {
  url: string | null
  error: string | null
}

export async function compressAndUpload(
  file: File,
  bucket: string,
  folder: string
): Promise<UploadResult> {
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

    if (error) {
      return { url: null, error: `Storage: ${error.message}` }
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return { url: data.publicUrl, error: null }
  } catch (err: any) {
    return { url: null, error: err?.message || 'Unknown upload error' }
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
