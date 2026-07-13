import { buildReviewRequestMessages } from './notification-message.utils';

describe('buildReviewRequestMessages', () => {
  it('stores escaped safe HTML for in-app content and email', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const { inAppContent, emailHtml } = buildReviewRequestMessages({
      requesterName: payload,
      organizationName: payload,
      channelName: payload,
      providerName: payload,
      preview: payload,
      calendarLink: 'https://example.com/launches?x="onload"',
    });

    expect(inAppContent).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(inAppContent).toContain('<br />');
    expect(inAppContent).not.toContain('<img src=x');
    expect(inAppContent).not.toContain('<a ');
    expect(inAppContent).not.toContain('href=');
    expect(inAppContent).toContain(
      'https://example.com/launches?x=&quot;onload&quot;'
    );

    expect(emailHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(emailHtml).toContain(
      'href="https://example.com/launches?x=&quot;onload&quot;"'
    );
    expect(emailHtml).toContain(
      '<a href="https://example.com/launches?x=&quot;onload&quot;">https://example.com/launches?x=&quot;onload&quot;</a>'
    );
    expect((emailHtml.match(/<a /g) || []).length).toBe(1);
  });
});
