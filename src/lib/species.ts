// Common Ohio freshwater bass + panfish species
// Harry can always type a custom species via the "Other" option
export const SPECIES = [
  'Largemouth Bass',
  'Smallmouth Bass',
  'Spotted Bass',
  'Bluegill',
  'Channel Catfish',
  'Crappie',
  'Saugeye',
  'Hybrid Striped Bass',
  'Carp',
  'Other',
] as const

export type Species = typeof SPECIES[number]
