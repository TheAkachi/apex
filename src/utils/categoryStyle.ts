export interface CategoryTone {
  accent: string;
  bg: string;
  border: string;
}

const PRESET_TONES: Record<string, CategoryTone> = {
  estudo: {
    accent: '#e85002',
    bg: 'rgb(232 80 2 / 16%)',
    border: 'rgb(232 80 2 / 42%)',
  },
  trabalho: {
    accent: '#d9c3ab',
    bg: 'rgb(217 195 171 / 14%)',
    border: 'rgb(217 195 171 / 38%)',
  },
  família: {
    accent: '#f16001',
    bg: 'rgb(241 96 1 / 15%)',
    border: 'rgb(241 96 1 / 40%)',
  },
  familia: {
    accent: '#f16001',
    bg: 'rgb(241 96 1 / 15%)',
    border: 'rgb(241 96 1 / 40%)',
  },
  amigos: {
    accent: '#a7a7a7',
    bg: 'rgb(167 167 167 / 14%)',
    border: 'rgb(167 167 167 / 36%)',
  },
};

const CUSTOM_TONE: CategoryTone = {
  accent: '#f9f9f9',
  bg: 'rgb(249 249 249 / 11%)',
  border: 'rgb(249 249 249 / 30%)',
};

export function getCategoryTone(category?: string): CategoryTone {
  if (!category) return PRESET_TONES.estudo;
  const key = category.trim().toLowerCase();
  return PRESET_TONES[key] ?? CUSTOM_TONE;
}
