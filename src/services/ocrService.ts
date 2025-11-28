// src/services/ocrService.ts
import { supabase } from '../supabaseClient'

export interface OcrResult {
  company?: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
}

export async function scanBusinessCard(file: File): Promise<OcrResult> {
  // Example: send to Supabase Edge Function 'scan-business-card'
  const arrayBuf = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))

  const { data, error } = await supabase.functions.invoke('scan-business-card', {
    body: { imageBase64: base64 },
  })

  if (error) throw error
  return (data || {}) as OcrResult
}
