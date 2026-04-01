import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Untyped client — we use our own interfaces for app-level typing
// This avoids strict generated-type mismatches with Supabase query shapes
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
