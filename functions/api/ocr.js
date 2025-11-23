// functions/api/ocr.js
export async function onRequestPost({ request, env }) {
  try {
    const { imageBase64 } = await request.json()

    if (!imageBase64) {
      return jsonResponse(
        { error: 'Missing imageBase64 in request body' },
        400
      )
    }

    const apiKey = env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      return jsonResponse(
        { error: 'Vision API key not configured on server' },
        500
      )
    }

    const visionUrl =
      'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey

    const visionBody = {
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    }

    const visionRes = await fetch(visionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionBody),
    })

    const visionText = await visionRes.text()

    if (!visionRes.ok) {
      // Log full response to Cloudflare logs
      console.error('Vision error:', visionRes.status, visionText)

      // Return a safe, truncated error to the client
      return jsonResponse(
        {
          error: 'Vision API call failed',
          status: visionRes.status,
          details: visionText.slice(0, 400), // just first 400 chars
        },
        500
      )
    }

    const visionJson = JSON.parse(visionText)

    const text =
      visionJson?.responses?.[0]?.fullTextAnnotation?.text ||
      visionJson?.responses?.[0]?.textAnnotations?.[0]?.description ||
      ''

    if (!text) {
      return jsonResponse(
        { error: 'No text detected on card', text: '' },
        200
      )
    }

    const parsed = parseCardText(text)

    return jsonResponse(
      {
        ...parsed,
        // optional: include raw text for debugging
        raw_text: text,
      },
      200
    )
  } catch (err) {
    console.error('OCR handler error:', err)
    return jsonResponse(
      { error: 'Unexpected error in OCR endpoint', details: String(err) },
      500
    )
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Simple parser; we can refine based on real cards later
function parseCardText(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/

  let email = ''
  let phone = ''
  let contact = ''
  let company = ''

  for (const line of lines) {
    if (!email) {
      const m = line.match(emailRegex)
      if (m) email = m[0]
    }
    if (!phone) {
      const m = line.match(phoneRegex)
      if (m) phone = m[0]
    }
  }

  if (lines.length > 0) company = lines[0]
  if (lines.length > 1) contact = lines[1]

  return { company, contact, email, phone }
}
