import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Homeowner = {
  id: string
  name: string
  unit?: string
  lease_start?: string
  created_at: string
}

export type ChecklistItem = {
  id: string
  homeowner_id: string
  item_key: string
  completed: boolean
  completed_at?: string
  updated_at: string
}

export const CHECKLIST_ITEMS = [
  { key: 'insurance',       label: 'Insurance',             icon: '🛡️' },
  { key: 'w9',              label: 'W9',                    icon: '📄' },
  { key: 'dwolla_verified', label: 'Dwolla Verified',       icon: '✅' },
  { key: 'payment_method',  label: 'Payment Method on File',icon: '💳' },
  { key: 'id_verified',     label: 'ID Verified',           icon: '🪪' },
]
