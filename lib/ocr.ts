export type ExtractedLabValue = {
  test_name: string
  value: number
  unit: string
  reference_low: number | null
  reference_high: number | null
  is_flagged: boolean
}

export type OCRResult = {
  lab_facility: string
  record_date: string
  values: ExtractedLabValue[]
}

// Mock dataset — 4 timepoints telling Janah's clinical story
const MOCK_RECORDS: Record<string, OCRResult> = {

  // ── APRIL 2025 — First consult, Diane-35 just started ──────────────────
  '2025-04': {
    lab_facility: 'Makati Medical Center',
    record_date: '2025-04-10',
    values: [
      // CBC
      { test_name: 'RBC Count', value: 4.92, unit: '10^12/L', reference_low: 3.80, reference_high: 5.50, is_flagged: false },
      { test_name: 'Hemoglobin', value: 128, unit: 'g/L', reference_low: 115, reference_high: 165, is_flagged: false },
      { test_name: 'HCT', value: 0.40, unit: 'L/L', reference_low: 0.35, reference_high: 0.47, is_flagged: false },
      { test_name: 'MCV', value: 82, unit: 'fL', reference_low: 78, reference_high: 99, is_flagged: false },
      { test_name: 'MCH', value: 28, unit: 'pg', reference_low: 27, reference_high: 32, is_flagged: false },
      { test_name: 'MCHC', value: 320, unit: 'g/L', reference_low: 300, reference_high: 360, is_flagged: false },
      { test_name: 'RDW-CV', value: 13.2, unit: '%', reference_low: 11.0, reference_high: 15.0, is_flagged: false },
      { test_name: 'WBC Count', value: 6.10, unit: '10^9/L', reference_low: 4.00, reference_high: 11.00, is_flagged: false },
      { test_name: 'Platelet Count', value: 310, unit: '10^9/L', reference_low: 150, reference_high: 400, is_flagged: false },
      // Lipids — slightly elevated, early Diane-35 effect
      { test_name: 'Total Cholesterol', value: 198, unit: 'mg/dL', reference_low: null, reference_high: 200, is_flagged: false },
      { test_name: 'LDL Cholesterol', value: 128, unit: 'mg/dL', reference_low: null, reference_high: 100, is_flagged: true },
      { test_name: 'HDL Cholesterol', value: 48, unit: 'mg/dL', reference_low: 40, reference_high: null, is_flagged: false },
      { test_name: 'Non-HDL Cholesterol', value: 150, unit: 'mg/dL', reference_low: null, reference_high: 130, is_flagged: true },
      { test_name: 'Triglycerides', value: 112, unit: 'mg/dL', reference_low: null, reference_high: 150, is_flagged: false },
      { test_name: 'LDL Cholesterol', value: 128, unit: 'mg/dL', reference_low: null, reference_high: 100, is_flagged: true },
      { test_name: 'Total Cholesterol/HDL', value: 4.13, unit: 'ratio', reference_low: null, reference_high: 5.0, is_flagged: false },
      // Chemistry — normal
      { test_name: 'Glucose (Fasting)', value: 88, unit: 'mg/dL', reference_low: 70.09, reference_high: 105.04, is_flagged: false },
      { test_name: 'eGFR', value: 118, unit: 'mL/min/1.73m2', reference_low: 60, reference_high: null, is_flagged: false },
      { test_name: 'ALT (SGPT)', value: 14, unit: 'U/L', reference_low: null, reference_high: 55, is_flagged: false },
      { test_name: 'AST (SGOT)', value: 22, unit: 'U/L', reference_low: 5, reference_high: 34, is_flagged: false },
      // Hormones
      { test_name: 'Testosterone (Total)', value: 38.5, unit: 'ng/dL', reference_low: 13.84, reference_high: 53.35, is_flagged: false },
      { test_name: 'DHEA-Sulfate', value: 7.8, unit: 'umol/L', reference_low: 2.6, reference_high: 13.9, is_flagged: false },
    ],
  },

  // ── JULY 2025 — 3 months on Diane-35, appetite up, weight up ───────────
  '2025-07': {
    lab_facility: 'Makati Medical Center',
    record_date: '2025-07-15',
    values: [
      // CBC
      { test_name: 'RBC Count', value: 4.88, unit: '10^12/L', reference_low: 3.80, reference_high: 5.50, is_flagged: false },
      { test_name: 'Hemoglobin', value: 126, unit: 'g/L', reference_low: 115, reference_high: 165, is_flagged: false },
      { test_name: 'HCT', value: 0.39, unit: 'L/L', reference_low: 0.35, reference_high: 0.47, is_flagged: false },
      { test_name: 'MCV', value: 81, unit: 'fL', reference_low: 78, reference_high: 99, is_flagged: false },
      { test_name: 'MCH', value: 27, unit: 'pg', reference_low: 27, reference_high: 32, is_flagged: false },
      { test_name: 'MCHC', value: 318, unit: 'g/L', reference_low: 300, reference_high: 360, is_flagged: false },
      { test_name: 'RDW-CV', value: 13.8, unit: '%', reference_low: 11.0, reference_high: 15.0, is_flagged: false },
      { test_name: 'WBC Count', value: 6.50, unit: '10^9/L', reference_low: 4.00, reference_high: 11.00, is_flagged: false },
      { test_name: 'Platelet Count', value: 340, unit: '10^9/L', reference_low: 150, reference_high: 400, is_flagged: false },
      // Lipids — worsening, Diane-35 effect more pronounced
      { test_name: 'Total Cholesterol', value: 218, unit: 'mg/dL', reference_low: null, reference_high: 200, is_flagged: true },
      { test_name: 'LDL Cholesterol', value: 148, unit: 'mg/dL', reference_low: null, reference_high: 100, is_flagged: true },
      { test_name: 'HDL Cholesterol', value: 43, unit: 'mg/dL', reference_low: 40, reference_high: null, is_flagged: false },
      { test_name: 'Non-HDL Cholesterol', value: 175, unit: 'mg/dL', reference_low: null, reference_high: 130, is_flagged: true },
      { test_name: 'Triglycerides', value: 138, unit: 'mg/dL', reference_low: null, reference_high: 150, is_flagged: false },
      { test_name: 'Total Cholesterol/HDL', value: 5.07, unit: 'ratio', reference_low: null, reference_high: 5.0, is_flagged: true },
      // Chemistry — glucose creeping up
      { test_name: 'Glucose (Fasting)', value: 96, unit: 'mg/dL', reference_low: 70.09, reference_high: 105.04, is_flagged: false },
      { test_name: 'eGFR', value: 115, unit: 'mL/min/1.73m2', reference_low: 60, reference_high: null, is_flagged: false },
      { test_name: 'ALT (SGPT)', value: 18, unit: 'U/L', reference_low: null, reference_high: 55, is_flagged: false },
      { test_name: 'AST (SGOT)', value: 25, unit: 'U/L', reference_low: 5, reference_high: 34, is_flagged: false },
      // Hormones — Diane-35 suppressing androgens
      { test_name: 'Testosterone (Total)', value: 22.1, unit: 'ng/dL', reference_low: 13.84, reference_high: 53.35, is_flagged: false },
      { test_name: 'DHEA-Sulfate', value: 5.9, unit: 'umol/L', reference_low: 2.6, reference_high: 13.9, is_flagged: false },
    ],
  },

  // ── DECEMBER 2025 — Peak damage, worst lipids, still on pill ───────────
  '2025-12': {
    lab_facility: 'Singapore Diagnostics - Pasig',
    record_date: '2025-12-08',
    values: [
      // CBC — iron markers starting to drop
      { test_name: 'RBC Count', value: 4.80, unit: '10^12/L', reference_low: 3.80, reference_high: 5.50, is_flagged: false },
      { test_name: 'Hemoglobin', value: 121, unit: 'g/L', reference_low: 115, reference_high: 165, is_flagged: false },
      { test_name: 'HCT', value: 0.38, unit: 'L/L', reference_low: 0.35, reference_high: 0.47, is_flagged: false },
      { test_name: 'MCV', value: 80, unit: 'fL', reference_low: 78, reference_high: 99, is_flagged: false },
      { test_name: 'MCH', value: 26, unit: 'pg', reference_low: 27, reference_high: 32, is_flagged: true },
      { test_name: 'MCHC', value: 315, unit: 'g/L', reference_low: 300, reference_high: 360, is_flagged: false },
      { test_name: 'RDW-CV', value: 14.8, unit: '%', reference_low: 11.0, reference_high: 15.0, is_flagged: false },
      { test_name: 'WBC Count', value: 6.80, unit: '10^9/L', reference_low: 4.00, reference_high: 11.00, is_flagged: false },
      { test_name: 'Platelet Count', value: 398, unit: '10^9/L', reference_low: 150, reference_high: 400, is_flagged: false },
      // Lipids — worst reading
      { test_name: 'Total Cholesterol', value: 235, unit: 'mg/dL', reference_low: null, reference_high: 200, is_flagged: true },
      { test_name: 'LDL Cholesterol', value: 175, unit: 'mg/dL', reference_low: null, reference_high: 100, is_flagged: true },
      { test_name: 'HDL Cholesterol', value: 35, unit: 'mg/dL', reference_low: 40, reference_high: null, is_flagged: true },
      { test_name: 'Non-HDL Cholesterol', value: 200, unit: 'mg/dL', reference_low: null, reference_high: 130, is_flagged: true },
      { test_name: 'Triglycerides', value: 148, unit: 'mg/dL', reference_low: null, reference_high: 150, is_flagged: false },
      { test_name: 'Total Cholesterol/HDL', value: 6.71, unit: 'ratio', reference_low: null, reference_high: 5.0, is_flagged: true },
      // Chemistry — glucose borderline
      { test_name: 'Glucose (Fasting)', value: 102, unit: 'mg/dL', reference_low: 70.09, reference_high: 105.04, is_flagged: false },
      { test_name: 'eGFR', value: 112, unit: 'mL/min/1.73m2', reference_low: 60, reference_high: null, is_flagged: false },
      { test_name: 'ALT (SGPT)', value: 22, unit: 'U/L', reference_low: null, reference_high: 55, is_flagged: false },
      { test_name: 'AST (SGOT)', value: 27, unit: 'U/L', reference_low: 5, reference_high: 34, is_flagged: false },
      // Hormones
      { test_name: 'Testosterone (Total)', value: 18.2, unit: 'ng/dL', reference_low: 13.84, reference_high: 53.35, is_flagged: false },
      { test_name: 'DHEA-Sulfate', value: 5.2, unit: 'umol/L', reference_low: 2.6, reference_high: 13.9, is_flagged: false },
    ],
  },

  // ── APRIL 2026 — Off pill + diet changes, recovering ───────────────────
  '2026-04': {
    lab_facility: 'Singapore Diagnostics - Pasig',
    record_date: '2026-04-19',
    values: [
      { test_name: 'RBC Count', value: 4.84, unit: '10^12/L', reference_low: 3.80, reference_high: 5.50, is_flagged: false },
      { test_name: 'Hemoglobin', value: 120, unit: 'g/L', reference_low: 115, reference_high: 165, is_flagged: false },
      { test_name: 'HCT', value: 0.38, unit: 'L/L', reference_low: 0.35, reference_high: 0.47, is_flagged: false },
      { test_name: 'MCV', value: 79, unit: 'fL', reference_low: 78, reference_high: 99, is_flagged: false },
      { test_name: 'MCH', value: 25, unit: 'pg', reference_low: 27, reference_high: 32, is_flagged: true },
      { test_name: 'MCHC', value: 314, unit: 'g/L', reference_low: 300, reference_high: 360, is_flagged: false },
      { test_name: 'RDW-CV', value: 15.6, unit: '%', reference_low: 11.0, reference_high: 15.0, is_flagged: true },
      { test_name: 'WBC Count', value: 6.30, unit: '10^9/L', reference_low: 4.00, reference_high: 11.00, is_flagged: false },
      { test_name: 'Platelet Count', value: 438, unit: '10^9/L', reference_low: 150, reference_high: 400, is_flagged: true },
      { test_name: 'Total Cholesterol', value: 217, unit: 'mg/dL', reference_low: null, reference_high: 200, is_flagged: true },
      { test_name: 'LDL Cholesterol', value: 154, unit: 'mg/dL', reference_low: null, reference_high: 100, is_flagged: true },
      { test_name: 'HDL Cholesterol', value: 39, unit: 'mg/dL', reference_low: 40, reference_high: null, is_flagged: true },
      { test_name: 'Non-HDL Cholesterol', value: 179, unit: 'mg/dL', reference_low: null, reference_high: 130, is_flagged: true },
      { test_name: 'Triglycerides', value: 125, unit: 'mg/dL', reference_low: null, reference_high: 150, is_flagged: false },
      { test_name: 'Total Cholesterol/HDL', value: 5.53, unit: 'ratio', reference_low: null, reference_high: 5.0, is_flagged: true },
      { test_name: 'Glucose (Fasting)', value: 95.32, unit: 'mg/dL', reference_low: 70.09, reference_high: 105.04, is_flagged: false },
      { test_name: 'Creatinine', value: 0.765, unit: 'mg/dL', reference_low: 0.570, reference_high: 1.109, is_flagged: false },
      { test_name: 'eGFR', value: 110.4, unit: 'mL/min/1.73m2', reference_low: 60, reference_high: null, is_flagged: false },
      { test_name: 'ALT (SGPT)', value: 6, unit: 'U/L', reference_low: null, reference_high: 55, is_flagged: false },
      { test_name: 'AST (SGOT)', value: 28, unit: 'U/L', reference_low: 5, reference_high: 34, is_flagged: false },
      { test_name: 'Testosterone (Total)', value: 34.03, unit: 'ng/dL', reference_low: 13.84, reference_high: 53.35, is_flagged: false },
      { test_name: 'DHEA-Sulfate', value: 6.5, unit: 'umol/L', reference_low: 2.6, reference_high: 13.9, is_flagged: false },
    ],
  },
}

let uploadCount = 0

export async function extractLabValues(imageUri: string): Promise<OCRResult> {
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const keys = Object.keys(MOCK_RECORDS)
  const key = keys[uploadCount % keys.length]
  uploadCount++

  return MOCK_RECORDS[key]
}