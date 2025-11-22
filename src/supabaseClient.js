import { createClient } from '@supabase/supabase-js'

// TODO: replace these with your real values from Supabase
const supabaseUrl = 'https://ycfeyxyoayvajudyusez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZmV5eHlvYXl2YWp1ZHl1c2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MzgxNDIsImV4cCI6MjA3OTQxNDE0Mn0.SZoH_sd19E0_eEWpSsYo4lIpaGoTwj48gGzysJqzAXc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
