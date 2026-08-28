export interface WdcCallQualityOptions {
  decisionEntry: string
  openingAnchors: { es: string[]; ca: string[] }
}

export interface WdcCallQualityResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function evaluateWdcCall(script: unknown, options: WdcCallQualityOptions): WdcCallQualityResult
