import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Lease = {
  lease_id: string
  lease_link: string
  home_id: string
  address: string
  concierge: string
  homeowner_name: string
  homeowner_id: string | null
  homeowner_link: string | null
  intercom_link: string | null
  lease_type: string
  payout_plan: string
  rent_amount: number
  rent_payout_status: string
  open_payable_count: number
  open_payable_balance: number
  first_open_payable_month: string
  last_open_payable_month: string
  lease_start_on: string
  lease_end_on: string
  terminated_on: string
  notice_type: string
  lease_status: string
  agreement_status: string
  manual_status: string | null
  notes: string | null
  escalated: boolean
  updated_at: string
}

export type ChecklistItem = {
  id: string
  home_id: string
  item_key: string
  completed: boolean
  completed_at: string | null
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

export type ComputedStatus = 'failed' | 'ready_to_process' | 'processing' | 'ready_to_pay' | 'pending' | 'paid'

export function computeStatus(lease: Lease, checklistDone: number): ComputedStatus {
  const allDone = checklistDone === CHECKLIST_ITEMS.length
  const csvPaid = lease.rent_payout_status?.toLowerCase() === 'paid'
  const csvFailed = lease.rent_payout_status?.toLowerCase() === 'failed'
  const isProcessing = lease.manual_status === 'processing'
  const now = new Date()
  const startDate = lease.lease_start_on ? new Date(lease.lease_start_on) : null
  const isPastDue = startDate ? startDate < now : false

  if (csvPaid) return 'paid'
  if (isProcessing) return 'processing'
  if (allDone && isPastDue) return 'ready_to_process'
  if (allDone) return 'ready_to_pay'
  if (csvFailed) return 'failed'
  return 'pending'
}

export const STATUS_CONFIG: Record<ComputedStatus, { label: string; color: string; bg: string; priority: number }> = {
  failed:           { label: 'Failed',            color: '#DC2626', bg: '#FEF2F2', priority: 1 },
  ready_to_process: { label: 'Ready to Process',  color: '#0891B2', bg: '#ECFEFF', priority: 2 },
  processing:       { label: 'Processing',         color: '#22D3EE', bg: '#F0FDFF', priority: 3 },
  ready_to_pay:     { label: 'Ready to Pay',       color: '#2DD4A0', bg: '#E8FBF5', priority: 4 },
  pending:          { label: 'Pending',             color: '#F59E0B', bg: '#FFFBEB', priority: 5 },
  paid:             { label: 'Paid',                color: '#2DD4A0', bg: '#E8FBF5', priority: 6 },
}
