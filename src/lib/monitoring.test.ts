import { describe, expect, it } from 'vitest';
import { environment, IGNORE_ERRORS, isDeployPermalink, scrubUrl, startErrorReporting } from './monitoring';

describe('error reporting', () => {
  it('is off without a DSN', async () => {
    expect(await startErrorReporting()).toBe(false);
  });

  it('drops query strings and fragments from addresses', () => {
    expect(scrubUrl('https://beatvox.app/studio?revox=32809')).toBe('https://beatvox.app/studio');
    expect(scrubUrl('https://beatvox.app/b/32809#about-terms')).toBe('https://beatvox.app/b/32809');
    expect(scrubUrl('https://api.roundware.app/api/3/assets/?project_id=103&page=2')).toBe('https://api.roundware.app/api/3/assets/');
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it('tells the live site from previews', () => {
    expect(environment('beatvox.app')).toBe('live-site');
    expect(environment('deploy-preview-12--beatvox-lab.netlify.app')).toBe('preview');
    expect(environment('localhost')).toBe('other');
  });

  it("leaves out Netlify's deploy permalinks (its screenshot bot), not previews", () => {
    expect(isDeployPermalink('6afe37afeb0f8389f87a47cd--beatvox-lab.netlify.app')).toBe(true);
    expect(isDeployPermalink('deploy-preview-12--beatvox-lab.netlify.app')).toBe(false);
    expect(isDeployPermalink('beatvox.app')).toBe(false);
  });

  it("ignores a sound interrupted, and audio or the mic refused", () => {
    const ignored = (msg: string) => IGNORE_ERRORS.some((p) => (typeof p === 'string' ? msg.includes(p) : p.test(msg)));
    expect(ignored('AbortError: The play() request was interrupted by a call to pause()')).toBe(true);
    expect(ignored('NotAllowedError: Permission denied')).toBe(true);
    expect(ignored('TypeError: cannot read properties of undefined')).toBe(false);
  });
});
