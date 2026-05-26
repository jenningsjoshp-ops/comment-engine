import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE = 'https://api.apify.com/v2/acts';

type Action = 'profile' | 'post' | 'hashtag';

interface ProfileParams  { handle: string; resultsLimit?: number }
interface PostParams     { url: string }
interface HashtagParams  { hashtag: string; resultsLimit?: number }

function buildApifyRequest(action: Action, params: ProfileParams | PostParams | HashtagParams) {
  switch (action) {
    case 'profile': {
      const { handle, resultsLimit = 10 } = params as ProfileParams;
      const profileUrl = `https://www.instagram.com/${handle.replace('@', '')}/`;
      return {
        actor: 'apify~instagram-scraper',
        body: { directUrls: [profileUrl], resultsType: 'posts', resultsLimit },
      };
    }
    case 'post': {
      const { url } = params as PostParams;
      return {
        actor: 'apify~instagram-scraper',
        body: { directUrls: [url], resultsType: 'posts', resultsLimit: 1 },
      };
    }
    case 'hashtag': {
      const { hashtag, resultsLimit = 50 } = params as HashtagParams;
      return {
        actor: 'apify~instagram-hashtag-scraper',
        body: { hashtags: [hashtag], resultsLimit },
      };
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { action, params } = await req.json();

    if (!action || !params) {
      return new Response(JSON.stringify({ error: 'action and params are required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const token = Deno.env.get('APIFY_API_TOKEN') ?? '';
    const { actor, body } = buildApifyRequest(action as Action, params);
    const apifyUrl = `${APIFY_BASE}/${actor}/run-sync-get-dataset-items?token=${token}`;

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await apifyRes.json();

    if (!apifyRes.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: apifyRes.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
