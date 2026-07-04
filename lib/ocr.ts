import * as FileSystem from 'expo-file-system/legacy'

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY

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
 
const PROMPT = `You are reading photos of a laboratory result document. The images are pages of the SAME lab result, in order.
 
Extract every lab test value across ALL pages and return ONLY a JSON object, no other text, no markdown fences, in exactly this shape:
 
{
  "lab_facility": "name of the lab or hospital as printed on the document",
  "record_date": "MM-DD-YYYY (the specimen or report date printed on the document)",
  "values": [
    {
      "test_name": "string",
      "value": number,
      "unit": "string",
      "reference_low": number or null,
      "reference_high": number or null,
      "is_flagged": true if the value is outside its reference range, else false
    }
  ]
}
 
Rules:
- Use these exact test names when the document contains them, even if the document spells them differently: RBC Count, Hemoglobin, HCT, MCV, MCH, MCHC, RDW-CV, WBC Count, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils, Platelet Count, Total Cholesterol, HDL Cholesterol, LDL Cholesterol, Non-HDL Cholesterol, VLDL Cholesterol, Triglycerides, Total Cholesterol/HDL, Glucose (Fasting), Creatinine, eGFR, ALT (SGPT), AST (SGOT), Testosterone (Total), DHEA-Sulfate.
- For any other test on the document, include it with its printed name.
- Each distinct test appears once. If the same test appears on multiple pages, keep the one with the clearest reading.
- value must be a number only. If a result is text like "Negative", skip it.
- If the reference range is one-sided (like "<200"), set the missing side to null.
- If the photos are not a lab result document, return {"lab_facility":"Unknown","record_date":"","values":[]}.`
 
export async function extractLabValues(imageUris: string[]): Promise<OCRResult> {
  const imageBlocks = []
  for (const uri of imageUris) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    })
    const mediaType = uri.toLowerCase().endsWith('.png')
      ? 'image/png'
      : 'image/jpeg'
    imageBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    })
  }
 
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: PROMPT }],
        },
      ],
    }),
  })
 
  const data = await response.json()
 
  if (data.type === 'error') {
    console.log('Lab reading API error:', JSON.stringify(data.error))
    throw new Error(data.error?.message ?? 'Lab reading failed')
  }
 
  const text =
    data.content?.find((block: any) => block.type === 'text')?.text ?? ''
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
 
  console.log(
    `Lab reading OK: ${parsed.values?.length ?? 0} values from ${parsed.lab_facility} (${imageUris.length} page${imageUris.length !== 1 ? 's' : ''})`
  )
 
  return {
    lab_facility: parsed.lab_facility || 'Unknown',
    record_date:
      parsed.record_date || new Date().toISOString().split('T')[0],
    values: Array.isArray(parsed.values) ? parsed.values : [],
  }
}