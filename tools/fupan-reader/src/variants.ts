// 阅读页观感：中性灰底、品牌绿、小圆角、文件各自成卡、紧凑
export type Variant = { files: 'list' | 'cards'; base: 'neutral' | 'stone' | 'zinc'; brand: 'blue' | 'violet' | 'emerald' | 'orange'; radius: 'sm' | 'md' | 'lg'; density: 'compact' | 'cozy' }
export const V: Variant = { files: 'cards', base: 'neutral', brand: 'emerald', radius: 'sm', density: 'compact' }
export const RADIUS: Record<Variant['radius'], string> = { sm: '0.375rem', md: '0.625rem', lg: '1rem' }
