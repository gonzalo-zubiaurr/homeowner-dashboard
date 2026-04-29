import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY
    const sheetId = process.env.GOOGLE_SHEET_ID

    if (!apiKey || !sheetId) {
      return NextResponse.json({ error: 'Google Sheets not configured' }, { status: 400 })
    }

    // Fetch from Google Sheets (expects columns: Name, Unit, Lease Start)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:C?key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Sheets API error: ${err}` }, { status: 500 })
    }

    const data = await res.json()
    const rows: string[][] = data.values || []

    // Skip header row
    const homeowners = rows.slice(1).filter(row => row[0]?.trim()).map(row => ({
      name: row[0]?.trim() || '',
      unit: row[1]?.trim() || null,
      lease_start: row[2]?.trim() || null,
    }))

    if (homeowners.length === 0) {
      return NextResponse.json({ message: 'No homeowners found in sheet', count: 0 })
    }

    // Upsert homeowners by name (won't overwrite existing)
    const { data: existing } = await supabase.from('homeowners').select('name')
    const existingNames = new Set((existing || []).map((h: { name: string }) => h.name))

    const newHomeowners = homeowners.filter(h => !existingNames.has(h.name))

    if (newHomeowners.length > 0) {
      const { error } = await supabase.from('homeowners').insert(newHomeowners)
      if (error) throw error
    }

    return NextResponse.json({
      message: `Sync complete. ${newHomeowners.length} new homeowners added.`,
      total: homeowners.length,
      added: newHomeowners.length,
    })
  } catch (err: unknown) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
