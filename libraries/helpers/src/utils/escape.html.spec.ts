import { escapeHtml } from './escape.html';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  it('keeps already-encoded HTML inert when escaped again', () => {
    expect(escapeHtml('&lt;img src=x onerror=alert(1)&gt;')).toBe(
      '&amp;lt;img src=x onerror=alert(1)&amp;gt;'
    );
  });
});
