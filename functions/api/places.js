// functions/api/places.js
// Google Places API (New) - places:searchNearby

export async function onRequest(context) {
  const { request, env } = context

  // handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }
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

    const body = {
      maxResultCount: 15,
      locationRestriction: {
        circle: {
          center: {
            latitude: Number(lat),
            longitude: Number(lng),
          },
          radius: 1500.0,
        },
      },
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.nationalPhoneNumber',
          'places.websiteUri',
          'places.rating',
          'places.userRatingCount',
          'places.primaryTypeDisplayName',
          'places.currentOpeningHours.openNow',
        ].join(','),
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
      phone: place.nationalPhoneNumber || null,
      website: place.websiteUri || null,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      rating: place.rating ?? null,
      ratingCount: place.userRatingCount ?? null,
      category: place.primaryTypeDisplayName?.text || null,
      openNow: place.currentOpeningHours?.openNow ?? null,
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
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders()),
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  }
}
