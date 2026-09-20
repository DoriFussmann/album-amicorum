import type { APIRoute } from 'astro';
import { generateRobotsTxt } from 'seo-core';
import { SITE_URL } from '../config/site';

export const GET: APIRoute = () => {
  const body = generateRobotsTxt({
    siteUrl: SITE_URL,
    aiCrawlers: {
      GPTBot: 'allow',
      'ChatGPT-User': 'allow',
      'Google-Extended': 'allow',
      ClaudeBot: 'allow',
      'anthropic-ai': 'allow',
      PerplexityBot: 'allow',
      'Applebot-Extended': 'allow',
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
