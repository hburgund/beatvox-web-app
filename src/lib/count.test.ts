import { describe, expect, it, vi } from 'vitest';
import { allowedEvent, eventHit, goatEvent, isBot, pageHit, sendHits } from './count';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const req = (url: string, headers: Record<string, string> = {}, method = 'GET') =>
  new Request(url, { method, headers: { 'user-agent': SAFARI, ...headers } });

describe('isBot', () => {
  it('lets browsers through and stops preview fetchers and scripts', () => {
    expect(isBot(SAFARI)).toBe(false);
    for (const ua of ['facebookexternalhit/1.1', 'Twitterbot/1.0', 'Slackbot-LinkExpanding 1.0', 'WhatsApp/2.23', 'Discordbot/2.0', 'curl/8.4', 'Mozilla/5.0 (compatible; Googlebot/2.1)', '', null])
      expect(isBot(ua)).toBe(true);
  });
});

describe('pageHit', () => {
  it('counts the pages, with campaign parameters and outside referrers only', () => {
    expect(pageHit(req('https://beatvox.app/studio?revox=12&utm_source=ig', { referer: 'https://www.instagram.com/' }), { ip: '1.2.3.4', country: 'US' })).toEqual({
      path: '/studio', title: 'Studio', ref: 'https://www.instagram.com/', query: '?utm_source=ig', user_agent: SAFARI, ip: '1.2.3.4', location: 'US',
    });
    expect(pageHit(req('https://beatvox.app/', { referer: 'https://beatvox.app/studio' }))).toMatchObject({ path: '/', title: 'Map', ref: undefined, query: undefined });
    expect(pageHit(req('https://beatvox.app/b/42/'))).toMatchObject({ path: '/b/42', title: 'Share page' });
    expect(pageHit(req('https://beatvox.app/about'))).toMatchObject({ title: 'About' });
  });
  it('skips bots, prefetches, other methods and other paths', () => {
    expect(pageHit(req('https://beatvox.app/b/42', { 'user-agent': 'Twitterbot/1.0' }))).toBeNull();
    expect(pageHit(req('https://beatvox.app/', { 'sec-purpose': 'prefetch;prerender' }))).toBeNull();
    expect(pageHit(req('https://beatvox.app/', {}, 'HEAD'))).toBeNull();
    expect(pageHit(req('https://beatvox.app/assets/x.js'))).toBeNull();
  });
});

describe('events', () => {
  it('names the Roundware events that are counted', () => {
    expect(goatEvent('end_record', 'seconds: 4.2')).toBe('voice-recorded');
    expect(goatEvent('save_loop')).toBe('8-bars-saved');
    expect(goatEvent('save_file', 'mp3 loop')).toBe('saved-mp3-loop');
    expect(goatEvent('save_file', 'video square')).toBe('saved-video-square');
    expect(goatEvent('share_video', 'video tall')).toBe('shared-video-tall');
    expect(goatEvent('share_map', 'url: https://beatvox.app/b/3 (share page, copied)')).toBe('shared-link-share-page-copied');
    expect(goatEvent('share_map', 'url: https://beatvox.app/b/3 (studio, share sheet)')).toBe('shared-link-studio-sheet');
    expect(goatEvent('send_to_map', 'asset_id:9 revox of 3')).toBe('sent-to-map-revox');
    expect(goatEvent('send_to_map', 'asset_id:9')).toBe('sent-to-map');
    expect(goatEvent('start_revox', 'asset_id:3')).toBe('revox-started');
    expect(goatEvent('play_stream', 'wander everywhere')).toBe('wander-started');
    expect(goatEvent('start_record')).toBeNull();
    expect(goatEvent('filter_stream')).toBeNull();
  });
  it('passes on only our own names, from people', () => {
    for (const n of ['voice-recorded', '8-bars-saved', 'saved-gif', 'shared-link-studio-sheet', 'sent-to-map-revox', 'revox-started', 'wander-started'])
      expect(allowedEvent(n)).toBe(true);
    for (const n of ['', '/studio', 'buy-now', 'saved-', 'saved-<script>', 'voice-recorded2']) expect(allowedEvent(n)).toBe(false);
    expect(eventHit(req('https://beatvox.app/api/count'), 'saved-gif', { country: 'NL' })).toEqual({ path: 'saved-gif', event: true, user_agent: SAFARI, ip: undefined, location: 'NL' });
    expect(eventHit(req('https://beatvox.app/api/count', { 'user-agent': 'curl/8' }), 'saved-gif')).toBeNull();
    expect(eventHit(req('https://beatvox.app/api/count'), 'nope')).toBeNull();
  });
});

describe('sendHits', () => {
  it('posts to the site with the key, and does nothing unconfigured', async () => {
    const f = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await sendHits({ site: 'roundware', token: 't' }, [{ path: '/' }], f)).toBe(true);
    expect(f).toHaveBeenCalledWith('https://roundware.goatcounter.com/api/v0/count', expect.objectContaining({ method: 'POST' }));
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer t');
    expect(JSON.parse(init.body as string)).toEqual({ no_sessions: true, hits: [{ path: '/' }] });
    expect(await sendHits({ site: 'roundware' }, [{ path: '/' }], f)).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('never throws', async () => {
    expect(await sendHits({ site: 's', token: 't' }, [{ path: '/' }], async () => { throw new Error('down'); })).toBe(false);
    expect(await sendHits({ site: 's', token: 't' }, [{ path: '/' }], async () => new Response(null, { status: 401 }))).toBe(false);
  });
});
