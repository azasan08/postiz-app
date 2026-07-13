import { escapeHtml } from '@gitroom/helpers/utils/escape.html';

export type ReviewRequestMessageParams = {
  requesterName: string;
  organizationName: string;
  channelName: string;
  providerName: string;
  preview: string;
  calendarLink: string;
};

export const buildReviewRequestMessages = ({
  requesterName,
  organizationName,
  channelName,
  providerName,
  preview,
  calendarLink,
}: ReviewRequestMessageParams) => {
  const previewHtml = preview
    ? `<br />Preview: &quot;${escapeHtml(preview)}&quot;`
    : '';

  const bodyPrefix =
    `${escapeHtml(
      requesterName
    )} requested a review for a draft post in ${escapeHtml(
      organizationName
    )}.` +
    `<br />Channel: ${escapeHtml(channelName)} (${escapeHtml(providerName)}).` +
    previewHtml;

  const inAppContent =
    bodyPrefix + `<br />Open the post in Postiz: ${escapeHtml(calendarLink)}`;

  const emailHtml =
    bodyPrefix +
    `<br />Open the post in Postiz: <a href="${escapeHtml(
      calendarLink
    )}">${escapeHtml(calendarLink)}</a>`;

  const subject = `Review requested for a draft post in ${organizationName}`;

  return { subject, inAppContent, emailHtml };
};
