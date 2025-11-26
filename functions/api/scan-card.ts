// /functions/api/scan-card.ts
interface Env {
  GOOGLE_VISION_API_KEY: string
}

type ParsedCard = {
  company: string
  contact: string
  contactTitle: string
  email: string
  phone: string
  website: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context
    const { imageBase64 } = await request.json<any>()

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return jsonResponse({ error: 'imageBase64 is required' }, 400)
    }

    // --- 1) Call Google Vision ---
    const visionEndpoint =
      `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_API_KEY}`

    const visionPayload = {
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['en'] },
        },
      ],
    }

    const visionRes = await fetch(visionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionPayload),
    })

    if (!visionRes.ok) {
      const text = await visionRes.text()
      console.error('Vision error:', text)
      return jsonResponse({ error: 'Vision API failed' }, 500)
    }

    const visionJson: any = await visionRes.json()
    const fullText =
      visionJson?.responses?.[0]?.fullTextAnnotation?.text ?? ''

    if (!fullText) {
      return jsonResponse(
        { error: 'No text detected on card' },
        422
      )
    }

    // --- 2) Parse card text (ported from your GAS parseCardText) ---
    const parsed = parseCardText(fullText)

    const result: ParsedCard = {
      company: parsed.company || '',
      contact: parsed.contact || '',
      contactTitle: parsed.contactTitle || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      website: parsed.website || '',
    }

    return jsonResponse({ ok: true, rawText: fullText, data: result })
  } catch (err: any) {
    console.error('scan-card error:', err)
    return jsonResponse(
      { error: 'Unexpected server error' },
      500
    )
  }
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Very close to your GAS parseCardText, trimmed a bit.
 * Feel free to tweak heuristics later.
 */
function parseCardText(raw: string) {
  let text = String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .trim()

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const unique = (arr: string[]) =>
    Array.from(new Set(arr.filter(Boolean)))

  // Emails
  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  const emails = unique(text.match(emailRe) || [])
  const email = emails[0] || ''

  // Phones
  const phoneRe =
    /(?:\+?1[\s\-\.]?)?(?:\(\d{3}\)|\d{3})[\s\-\.]?\d{3}[\s\-\.]?\d{4}/g
  const phonesRaw = text.match(phoneRe) || []
  const normalizePhone = (p: string) => {
    const d = p.replace(/[^\d+]/g, '')
    if (d.length === 10) {
      return d.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
    }
    return p
  }
  const phones = unique(phonesRaw.map(normalizePhone))
  const phone = phones[0] || ''

  // Website
  const siteRe =
    /\b((?:https?:\/\/)?(?:www\.)?[A-Z0-9.-]+\.[A-Z]{2,}(?:\/\S*)?)\b/gi
  const sites = text.match(siteRe) || []
  let website = sites[0] || ''
  if (website && !/^https?:\/\//i.test(website)) {
    website = 'http://' + website
  }

  // Company & contact name
  let company = ''
  let contact = ''
  let contactTitle = ''

  // Contact: line that looks like "Firstname Lastname"
  const nameRe =
    /^(?:[A-Z][a-zA-Z'’.-]+)\s+(?:[A-Z][a-zA-Z'’.-]+)(?:\s+[A-Z][a-zA-Z'’.-]+)?$/
  const titleWords =
    /\b(Manager|Director|Owner|President|CEO|CFO|HR|Recruiter|Sales|Consultant|Engineer|Coordinator|Lead|Supervisor|VP)\b/i

  for (const l of lines) {
    if (l.length > 40) continue
    if (/[0-9@]/.test(l)) continue
    if (titleWords.test(l)) continue
    if (nameRe.test(l)) {
      contact = l
      break
    }
  }

  // Company: first reasonable non-email/phone line
  for (const l of lines) {
    if (l === contact) continue
    if (/[0-9@]/.test(l)) continue
    if (l.length < 2) continue
    if (titleWords.test(l)) continue
    company = l
    break
  }

  // Title: line after contact or any line with title keywords
  if (contact) {
    const idx = lines.indexOf(contact)
    const after = lines[idx + 1]
    if (
      after &&
      !after.match(emailRe) &&
      !after.match(phoneRe) &&
      !/www|http|linkedin|@/i.test(after) &&
      after.length < 40
    ) {
      contactTitle = after
    }
  }
  if (!contactTitle) {
    for (const l of lines) {
      if (titleWords.test(l) && l.length < 60) {
        contactTitle = l
        break
      }
    }
  }

  return {
    company,
    contact,
    contactTitle,
    email,
    emails,
    phone,
    phones,
    website,
  }
}
