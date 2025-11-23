// functions/api/ocr.js
export async function onRequestPost({ request, env }) {
  try {
    const { imageBase64 } = await request.json()

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64 in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Vision API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Call Google Vision API
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

    if (!visionRes.ok) {
      const txt = await visionRes.text()
      console.error('Vision error:', visionRes.status, txt)
      return new Response(
        JSON.stringify({ error: 'Vision API call failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const visionJson = await visionRes.json()
    const text =
      visionJson?.responses?.[0]?.fullTextAnnotation?.text ||
      visionJson?.responses?.[0]?.textAnnotations?.[0]?.description ||
      ''

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text detected on card' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const parsed = parseCardText(text)

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('OCR handler error:', err)
    return new Response(
      JSON.stringify({ error: 'Unexpected error in OCR endpoint' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Very simple parser – we can refine this as we test real cards
function parseCardText(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  const phoneRegex =
    /(\+?\d[\d\s().-]{7,}\d)/ // loose match for typical phone patterns

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

  // crude guess: first line is often person or company; second line the other
  if (lines.length > 0) {
    company = lines[0]
  }
  if (lines.length > 1) {
    contact = lines[1]
  }

  return {
    company,
    contact,
    email,
    phone,
    raw_text: rawText,
  }
}
