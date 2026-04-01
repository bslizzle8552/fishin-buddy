export interface Database {
  public: {
    Tables: {
      waters: {
        Row: Water
        Insert: Omit<Water, 'id' | 'created_at'>
        Update: Partial<Omit<Water, 'id'>>
      }
      spots: {
        Row: Spot
        Insert: Omit<Spot, 'id' | 'created_at'>
        Update: Partial<Omit<Spot, 'id'>>
      }
      lures: {
        Row: Lure
        Insert: Omit<Lure, 'id' | 'created_at' | 'catch_count'>
        Update: Partial<Omit<Lure, 'id'>>
      }
      catches: {
        Row: Catch
        Insert: Omit<Catch, 'id' | 'created_at'>
        Update: Partial<Omit<Catch, 'id'>>
      }
      skunk_logs: {
        Row: SkunkLog
        Insert: Omit<SkunkLog, 'id' | 'created_at'>
        Update: Partial<Omit<SkunkLog, 'id'>>
      }
    }
  }
}

export interface Water {
  id: string
  user_id: string
  name: string
  latitude: number
  longitude: number
  created_at: string
}

export interface Spot {
  id: string
  user_id: string
  water_id: string
  name: string
  latitude: number
  longitude: number
  created_at: string
}

export interface Lure {
  id: string
  user_id: string
  name: string
  photo_url: string
  catch_count: number
  created_at: string
}

export interface Catch {
  id: string
  user_id: string
  spot_id: string
  water_id: string
  lure_id: string
  species: string
  fish_photo_url: string | null
  quantity: number
  notes: string | null
  size_estimate: string | null
  // Weather data auto-captured
  temperature_f: number | null
  cloud_cover: string | null
  wind_speed_mph: number | null
  wind_direction: string | null
  barometric_pressure: number | null
  precipitation: string | null
  latitude: number
  longitude: number
  caught_at: string
  created_at: string
}

export interface SkunkLog {
  id: string
  user_id: string
  spot_id: string
  water_id: string
  notes: string | null
  lures_tried: string | null
  // Weather data auto-captured
  temperature_f: number | null
  cloud_cover: string | null
  wind_speed_mph: number | null
  wind_direction: string | null
  barometric_pressure: number | null
  precipitation: string | null
  logged_at: string
  created_at: string
}

export interface WeatherData {
  temperature_f: number | null
  cloud_cover: string | null
  wind_speed_mph: number | null
  wind_direction: string | null
  barometric_pressure: number | null
  precipitation: string | null
}
