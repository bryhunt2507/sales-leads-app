// functions/api/places.js
// Very minimal Google Places API (New) - places:searchNearby

export async function onRequest(context) {
  const { request, env } = context

  const url = new URL(request.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')

  if (!lat || !lng) {
    return jsonResponse({ error: 'Missing lat/lng' }, 400)
  }

  const apiKey = env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return jsonResponse(
      { error: 'GOOGLE_PLACES_API_KEY not configured on Cloudflare' },
      500
    )
  }

  try {
    const endpoint = 'https://places.googleapis.com/v1/places:searchNearby'

    // 🔹 Minimal body: just location + radius, no includedTypes
    const body = {
      maxResultCount: 15,
      locationRestriction: {
        circle: {
          center: {
            latitude: Number(lat),
            longitude: Number(lng),
          },
          radius: 1500.0, // meters
        },
      },
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // 🔹 Very simple field mask; these are standard fields in the v1 Places response
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify(body),
    })

    const json = await res.json().catch(() => null)

    if (!res.ok || !json) {
      console.error('Google Places (New) error:', res.status, json)
      return jsonResponse(
        {
          error: 'Places API (New) error',
          status: res.status,
          details: json && json.error ? json.error : null,
        },
        res.status
      )
    }

    const places = Array.isArray(json.places) ? json.places : []

    const businesses = places.map(place => ({
      place_id: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      phone: null,
      website: null,
    }))

    return jsonResponse({ businesses })
  } catch (err) {
    console.error('Places function (New) error:', err)
    return jsonResponse(
      { error: 'Server error talking to Places API (New)' },
      500
    )
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
