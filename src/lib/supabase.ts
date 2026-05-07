import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    flowType: 'implicit',
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  },
})

export type Lease = {
  lease_id: string
  lease_link: string
  home_id: string
  address: string
  concierge: string
  homeowner_name: string
  homeowner_id: string | null
  homeowner_link: string | null
  lease_type: string
  payout_plan: string
  rent_amount: number
  rent_payout_status: string
  open_payable_count: number
  open_payable_balance: number
  first_open_payable_month: string
  last_open_payable_month: string
  first_open_payable_balance_id: string | null
  first_open_payable_balance_link: string | null
  last_open_payable_balance_id: string | null
  last_open_payable_balance_link: string | null
  first_open_payable_booked_on: string | null
  last_open_payable_booked_on: string | null
  lease_start_on: string
  lease_end_on: string
  terminated_on: string
  notice_type: string
  lease_status: string
  agreement_status: string
  manual_status: string | null
  notes: string | null
  intercom_link: string | null
  escalated: boolean
  escalation_slack_link: string | null
  last_note_at: string | null
  tags: string[] | null
  updated_at: string
}

export type LeaseNote = {
  id: string
  lease_id: string
  note: string
  author: string
  created_at: string
}

export type ChecklistItem = {
  id: string
  home_id: string
  item_key: string
  completed: boolean
  completed_at: string | null
  tags: string[] | null
  updated_at: string
}

export type ChecklistMap = Record<string, Record<string, boolean>>

export const CHECKLIST_ITEMS = [
  { key: 'insurance',       label: 'Insurance',              icon: '🛡️' },
  { key: 'w9',              label: 'W9',                     icon: '📄' },
  { key: 'dwolla_verified', label: 'Dwolla Verified',        icon: '✅' },
  { key: 'payment_method',  label: 'Payment Method on File', icon: '💳' },
  { key: 'id_verified',     label: 'ID Verified',            icon: '🪪' },
]

export type ComputedStatus = 'paid' | 'processing' | 'ready_to_initiate' | 'rent_failed' | 'setup_complete_future' | 'pending_setup_future'

export function computeStatus(lease: Lease, checklistDone: number): ComputedStatus {
  const allDone = checklistDone === CHECKLIST_ITEMS.length
  const csvPaid = lease.rent_payout_status?.toLowerCase() === 'paid'
  const isProcessing = lease.manual_status === 'processing'
  const now = new Date()
  const startDate = lease.lease_start_on ? new Date(lease.lease_start_on) : null
  const hasStarted = startDate ? startDate <= now : false

  if (csvPaid) return 'paid'
  if (isProcessing) return 'processing'
  if (allDone && hasStarted) return 'ready_to_initiate'
  if (allDone && !hasStarted) return 'setup_complete_future'
  if (!allDone && hasStarted) return 'rent_failed'
  return 'pending_setup_future'
}

export const STATUS_CONFIG: Record<ComputedStatus, { label: string; color: string; bg: string; priority: number; italic?: boolean; tooltip: string }> = {
  paid:                  { label: 'Rent Paid',         color: '#0A6B4A', bg: '#E8FBF5', priority: 1, tooltip: 'Payment confirmed by system' },
  processing:            { label: 'Processing',         color: '#06B6D4', bg: '#ECFEFF', priority: 2, tooltip: 'Team has initiated payment, awaiting confirmation' },
  ready_to_initiate:     { label: 'Ready to Initiate', color: '#2563EB', bg: '#EFF6FF', priority: 3, tooltip: 'Setup complete, rent is due — process now' },
  rent_failed:           { label: 'Rent Failed',        color: '#DC2626', bg: '#FEF2F2', priority: 4, tooltip: 'Rent is overdue and setup is incomplete' },
  setup_complete_future: { label: 'Setup Complete',     color: '#2DD4A0', bg: '#E8FBF5', priority: 5, italic: true, tooltip: 'Setup done, rent not yet due — no action needed' },
  pending_setup_future:  { label: 'Pending Setup',      color: '#F59E0B', bg: '#FFFBEB', priority: 6, italic: true, tooltip: 'Rent not yet due but setup is incomplete' },
}
