export default async function handler(req, res) {
  try {
    const { slug, ...restQuery } = req.query
    const path = '/api/' + (Array.isArray(slug) ? slug.join('/') : slug || '')
    const qString = new URLSearchParams(restQuery).toString()
   const backendUrl = process.env.BACKEND_URL || 'https://web-production-93e78d.up.railway.app'
  const target = backendUrl + path + (qString ? '?' + qString : '')

    const auth = req.headers['authorization'] || req.headers['x-fingoh-auth'] || ''
    const headers = { 'content-type': 'application/json', 'x-fingoh-auth': auth }
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {})

    const upstream = await fetch(target, { method: req.method, headers, body, redirect: 'manual' })

    if (upstream.status === 307 || upstream.status === 308) {
      const location = upstream.headers.get('location')
      const httpsLocation = location.replace('http://', 'https://')
      const upstream2 = await fetch(httpsLocation, { method: req.method, headers, body })
      const data2 = await upstream2.text()
      return res.status(upstream2.status).setHeader('content-type', 'application/json').send(data2)
    }

    const data = await upstream.text()
    res.status(upstream.status).setHeader('content-type', 'application/json').send(data)
  } catch (err) {
    res.status(500).json({ detail: 'Proxy error: ' + err.message })
  }
}

export const config = { api: { bodyParser: true } }
