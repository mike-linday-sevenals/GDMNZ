// File: src/pages/Prizes.tsx
import { useEffect, useMemo, useState } from 'react'
import { fetchSettings, listSpecies } from '../services/api'
import {
  listPrizes,
  createPrizeRow,
  updatePrizeRow,
  deletePrizeRow,
  getNextRank,
  type PrizeRow,
  type Category,
} from '../services/prizes'
import { listCompetitionSponsors } from '@/services/sponsors'
import { supabase } from '@/services/db'

const cssId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

type Species = { id: number; name: string }
type PrizeMap = Record<number, Record<Category, PrizeRow[]>>
type CompSponsor = { id: string; sponsor_id: string; sponsor_name: string; level_label?: string | null; display_order?: number | null }

export default function Prizes() {
  const [settings, setSettings] = useState<any>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [prizes, setPrizes] = useState<PrizeMap>({})
  const [competitionId, setCompetitionId] = useState<string>('')
  const [compSponsors, setCompSponsors] = useState<CompSponsor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [st, sp, rows] = await Promise.all([
        fetchSettings(),
        listSpecies(),
        listPrizes(),
      ])
      setSettings(st);