// Satu-satunya config yang wajib diganti saat deploy ulang Apps Script.
export const GAS_URL =
  import.meta.env.VITE_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbwXTD5ipaX-OpMfOuEaMUET6nH9cTEnbhDvj_0QgFKvP4jLRoqiJ0r2RP2T25uHoZs5/exec'

export const CATEGORIES = [
  { key: 'Halal', icon: 'fa-leaf', cls: 'halal', label: 'Halal' },
  { key: 'FSSC', icon: 'fa-shield-halved', cls: 'fssc', label: 'FSSC' },
  { key: 'PRP', icon: 'fa-industry', cls: 'prp', label: 'PRP' },
  { key: 'PMR', icon: 'fa-wrench', cls: 'pmr', label: 'PMR' },
  { key: 'SMK3', icon: 'fa-helmet-safety', cls: 'smk3', label: 'SMK3' },
]
