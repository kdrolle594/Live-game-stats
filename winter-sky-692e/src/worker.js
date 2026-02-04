/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing url parameter', { status: 400 });
    }

    // OPTIONAL: simple host allowlist to avoid becoming an open proxy
    // const allowed = ['cdn.nba.com', 'stats.nba.com'];
    // try {
    //   const parsed = new URL(target);
    //   if (!allowed.includes(parsed.hostname)) {
    //     return new Response('Host not allowed', { status: 403 });
    //   }
    // } catch (e) {
    //   return new Response('Invalid target url', { status: 400 });
    // }

    try {
      const resp = await fetch(target, {
        // Add a User-Agent to reduce chance of rejection
        // Add a User-Agent to reduce chance of rejection
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const body = await resp.arrayBuffer();

      const headers = new Headers(resp.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
      headers.set('Cache-Control', 'max-age=15');

      return new Response(body, {
        status: resp.status,
        headers
      });
    } catch (err) {
      return new Response('Proxy fetch failed: ' + String(err), { status: 502 });
    }
  }
};