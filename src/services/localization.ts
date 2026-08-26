import type { Language, LocalizedText } from '../app/types'

export function resolveText(value: LocalizedText, language: Language): string {
  return typeof value === 'string' ? value : value[language]
}

export function allText(value: LocalizedText): string[] {
  return typeof value === 'string' ? [value] : [value.es, value.ca]
}
