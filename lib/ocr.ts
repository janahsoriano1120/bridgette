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

export async function extractLabValues(imageUri: string): Promise<OCRResult> {
  // Mock OCR using Janah's real Singapore Diagnostics lab results
  // April 19, 2026 — Lab No. M0260744651
  await new Promise((resolve) => setTimeout(resolve, 2000)) // simulate processing

  return {
    lab_facility: 'Singapore Diagnostics - Pasig',
    record_date: '2026-04-19',
    values: [
      // CBC - Hematology
      { test_name: 'RBC Count', value: 4.84, unit: '10^12/L', reference_low: 3.80, reference_high: 5.50, is_flagged: false },
      { test_name: 'Hemoglobin', value: 120, unit: 'g/L', reference_low: 115, reference_high: 165, is_flagged: false },
      { test_name: 'HCT', value: 0.38, unit: 'L/L', reference_low: 0.35, reference_high: 0.47, is_flagged: false },
      { test_name: 'MCV', value: 79, unit: 'fL', reference_low: 78, reference_high: 99, is_flagged: false },
      { test_name: 'MCH', value: 25, unit: 'pg', reference_low: 27, reference_high: 32, is_flagged: true },
      { test_name: 'MCHC', value: 314, unit: 'g/L', reference_low: 300, reference_high: 360, is_flagged: false },
      { test_name: 'RDW-CV', value: 15.6, unit: '%', reference_low: 11.0, reference_high: 15.0, is_flagged: true },
      { test_name: 'WBC Count', value: 6.30, unit: '10^9/L', reference_low: 4.00, reference_high: 11.00, is_flagged: false },
      { test_name: 'Neutrophils', value: 46.7, unit: '%', reference_low: 39.7, reference_high: 71.2, is_flagged: false },
      { test_name: 'Lymphocytes', value: 41.0, unit: '%', reference_low: 21.9, reference_high: 50.3, is_flagged: false },
      { test_name: 'Monocytes', value: 7.5, unit: '%', reference_low: 4.2, reference_high: 9.6, is_flagged: false },
      { test_name: 'Eosinophils', value: 4.0, unit: '%', reference_low: 0.6, reference_high: 4.9, is_flagged: false },
      { test_name: 'Basophils', value: 0.8, unit: '%', reference_low: 0.2, reference_high: 1.4, is_flagged: false },
      { test_name: 'Platelet Count', value: 438, unit: '10^9/L', reference_low: 150, reference_high: 400, is_flagged: true },
      // Clinical Chemistry
      { test_name: 'Glucose (Fasting)', value: 95.32, unit: 'mg/dL', reference_low: 70.09, reference_high: 105.04, is_flagged: false },
      { test_name: 'Creatinine', value: 0.765, unit: 'mg/dL', reference_low: 0.570, reference_high: 1.109, is_flagged: false },
      { test_name: 'eGFR', value: 110.4, unit: 'mL/min/1.73m2', reference_low: 60, reference_high: null, is_flagged: false },
      { test_name: 'ALT (SGPT)', value: 6, unit: 'U/L', reference_low: null, reference_high: 55, is_flagged: false },
      { test_name: 'AST (SGOT)', value: 28, unit: 'U/L', reference_low: 5, reference_high: 34, is_flagged: false },
      // Lipid Profile
      { test_name: 'Total Cholesterol', value: 217, unit: 'mg/dL', reference_low: null, reference_high: 200, is_flagged: true },
      { test_name: 'HDL Cholesterol', value: 39, unit: 'mg/dL', reference_low: 40, reference_high: null, is_flagged: true },
      { test_name: 'Non-HDL Cholesterol', value: 179, unit: 'mg/dL', reference_low: null, reference_high: 130, is_flagged: true },
      { test_name: 'Triglycerides', value: 125, unit: 'mg/dL', reference_low: null, reference_high: 150, is_flagged: false },
      { test_name: 'LDL Cholesterol', value: 154, unit: 'mg/dL', reference_low: null, reference_high: 100, is_flagged: true },
      { test_name: 'VLDL Cholesterol', value: 25, unit: 'mg/dL', reference_low: null, reference_high: 31, is_flagged: false },
      { test_name: 'Total Cholesterol/HDL', value: 5.53, unit: 'ratio', reference_low: null, reference_high: 5.0, is_flagged: true },
      // Immunology / Serology
      { test_name: 'Testosterone (Total)', value: 34.03, unit: 'ng/dL', reference_low: 13.84, reference_high: 53.35, is_flagged: false },
      { test_name: 'DHEA-Sulfate', value: 6.5, unit: 'umol/L', reference_low: 2.6, reference_high: 13.9, is_flagged: false },
    ],
  }
}