import { describe, expect, it } from 'vitest';

import { isGo, failures } from './gate.js';
import { checkProviderConfig } from './preflight-checks.js';

const severityOf = (text: string, name: string): string | undefined =>
  checkProviderConfig(text).checks.find((c) => c.name === name)?.severity;

describe('checkProviderConfig (bash parity)', () => {
  it('flags retired gemini CLI command values (case-insensitive) → NO-GO', () => {
    expect(severityOf('command = gemini-cli', 'legacy-gemini-cli')).toBe('fail');
    expect(severityOf('cli = GEMINI', 'legacy-gemini-cli')).toBe('fail');
    expect(severityOf('bin = /usr/local/bin/gemini', 'legacy-gemini-cli')).toBe('fail');
    expect(isGo(checkProviderConfig('command = gemini-cli'))).toBe(false);
  });

  it('allows Gemini model names, Antigravity URLs, and comments', () => {
    expect(severityOf('model = gemini-pro', 'legacy-gemini-cli')).toBe('ok');
    expect(severityOf('url = https://api.antigravity.example/v1', 'legacy-gemini-cli')).toBe('ok');
    expect(severityOf('# command = gemini-cli (disabled)', 'legacy-gemini-cli')).toBe('ok');
  });

  it('counts model lines and warns when there are none', () => {
    expect(severityOf('model = doubao\nmodel = glm', 'model-configured')).toBe('ok');
    expect(severityOf('url = https://x', 'model-configured')).toBe('warn');
  });

  it('fails on an empty model value (bare or quoted)', () => {
    expect(severityOf('model =', 'model-nonempty')).toBe('fail');
    expect(severityOf('model = ""', 'model-nonempty')).toBe('fail');
    expect(severityOf('model = doubao', 'model-nonempty')).toBe('ok');
  });

  it('a clean multi-agent config is GO', () => {
    const cfg = 'model = doubao\nmodel = glm\nurl = https://ark.example/v1';
    const result = checkProviderConfig(cfg);
    expect(failures(result)).toHaveLength(0);
    expect(isGo(result)).toBe(true);
  });
});
