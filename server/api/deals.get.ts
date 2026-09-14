import { listActiveDeals, lastRun } from '../utils/db'

export default defineEventHandler(() => {
  return {
    deals: listActiveDeals(),
    lastRun: lastRun() ?? null
  }
})
