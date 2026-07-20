import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export async function sendInviteEmail(
  to: string,
  data: { inviterName: string; familyName: string; inviteToken: string }
): Promise<void> {
  if (!config.email.host) {
    logger.warn(
      { to, inviteToken: data.inviteToken },
      'SMTP not configured — invite email skipped. Share this link manually:'
        + ` ${config.frontendUrl}/join?token=${data.inviteToken}`
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.pass },
  });

  const joinUrl = `${config.frontendUrl}/join?token=${data.inviteToken}`;

  await transporter.sendMail({
    from: config.email.from,
    to,
    subject: `${data.inviterName} added you to the ${data.familyName} family on RememberKin`,
    html: `
      <p>Hi there!</p>
      <p><strong>${data.inviterName}</strong> has added you to the
      <strong>${data.familyName}</strong> family on RememberKin — a platform for
      preserving family memories.</p>
      <p><a href="${joinUrl}">Click here to join the ${data.familyName} family</a></p>
      <p>Or copy this link: ${joinUrl}</p>
      <p>This invite link expires in 7 days.</p>
    `,
  });

  logger.info({ to, familyName: data.familyName }, 'Invite email sent');
}
