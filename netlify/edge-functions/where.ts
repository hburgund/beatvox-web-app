// /api/where: roughly where the visitor is (their city, more or less),
// worked out by Netlify from their connection. For WHERE I AM when the
// browser can't find them: a laptop's location can take longer than anyone
// will wait. Nothing is logged or stored; only the visitor sees the answer.

interface Context {
  geo?: { city?: string; latitude?: number; longitude?: number };
}

export default (req: Request, context: Context) => {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (req.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  const { latitude, longitude, city } = context.geo ?? {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || (latitude === 0 && longitude === 0)) {
    return new Response('null', { headers });
  }
  return new Response(JSON.stringify({ latitude, longitude, city: city ?? null }), { headers });
};

export const config = { path: '/api/where' };
