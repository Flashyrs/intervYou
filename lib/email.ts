import nodemailer from "nodemailer";

type Inviter = { name?: string | null; email?: string | null };

interface InviteEmailOptions {
  to: string;
  link: string;
  inviter?: Inviter;
  scheduledFor?: Date;
  isScheduled?: boolean;
}

export async function sendInviteEmail(
  to: string,
  link: string,
  inviter?: Inviter,
  scheduledFor?: Date,
  isScheduled?: boolean
) {
  return sendInviteEmailWithOptions({ to, link, inviter, scheduledFor, isScheduled });
}

export async function sendInviteEmailWithOptions(options: InviteEmailOptions) {
  const { to, link, inviter, scheduledFor, isScheduled } = options;
  const user = process.env.EMAIL;
  const pass = process.env.APP_PASSWORD;
  if (!user || !pass) {
    console.log(`EMAIL/APP_PASSWORD not set. Invite email to ${to}: ${link}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user, pass },
  });

  const inviterName = inviter?.name || "Interview Organizer";
  const inviterEmail = inviter?.email ? ` (${inviter.email})` : "";

  const scheduledInfo = scheduledFor && isScheduled
    ? `
      <p>
        <strong>Scheduled Time:</strong> ${scheduledFor.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'UTC'
    })} UTC<br/>
        <em>Please convert to your local timezone</em>
      </p>
    `
    : "";

  const joinInstructions = isScheduled
    ? "Please click the link below to join at the scheduled time (you can join up to 5 minutes early)."
    : "Please click the link below to join the interview.";

  const subject = isScheduled
    ? `Scheduled Interview Invitation – IntervYou`
    : "Interview Invitation – IntervYou";

  const html = `
  <div style="font-family: Arial, sans-serif; color: #111;">
    <p>Hello,</p>
    <p>You have been invited to a technical interview on <strong>IntervYou</strong>.</p>
    <p>
      <strong>Interviewer:</strong> ${inviterName}${inviterEmail}<br/>
    </p>
    ${scheduledInfo}
    <p>
      ${joinInstructions}
    </p>
    <p>
      <a href="${link}" style="background:#000;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Join Interview</a>
    </p>
    <p>
      You may be asked to sign in with your Google account.
    </p>
    <p style="color:#555; font-size: 13px;">
      If you did not expect this invitation, you can safely ignore this email.
    </p>
    <p>Best regards,<br/>IntervYou Team</p>
  </div>`;

  const info = await transporter.sendMail({
    from: user,
    to,
    subject,
    text: `You have been invited to a technical interview on IntervYou. Interviewer: ${inviterName}${inviterEmail}. ${scheduledFor && isScheduled ? `Scheduled for: ${scheduledFor.toISOString()}. ` : ""}Join: ${link}`,
    html,
  });

  return info;
}

/**
 * Send reminder email 15 minutes before scheduled interview
 */
export async function sendScheduledReminderEmail(
  to: string[],
  link: string,
  scheduledFor: Date,
  inviter?: Inviter
) {
  const user = process.env.EMAIL;
  const pass = process.env.APP_PASSWORD;
  if (!user || !pass) {
    console.log(`EMAIL/APP_PASSWORD not set. Reminder email skipped.`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user, pass },
  });

  const inviterName = inviter?.name || "Interview Organizer";

  const subject = "Interview Reminder – Starting in 15 Minutes!";
  const html = `
  <div style="font-family: Arial, sans-serif; color: #111;">
    <p>Hello,</p>
    <p><strong>Your interview is starting in 15 minutes!</strong></p>
    <p>
      <strong>Interviewer:</strong> ${inviterName}<br/>
      <strong>Scheduled Time:</strong> ${scheduledFor.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC'
  })} UTC
    </p>
    <p>
      <a href="${link}" style="background:#000;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Join Interview Now</a>
    </p>
    <p>Best regards,<br/>IntervYou Team</p>
  </div>`;

  
  for (const recipient of to) {
    try {
      await transporter.sendMail({
        from: user,
        to: recipient,
        subject,
        text: `Your interview is starting in 15 minutes! Scheduled for: ${scheduledFor.toISOString()}. Join: ${link}`,
        html,
      });
    } catch (error) {
      console.error(`Failed to send reminder to ${recipient}:`, error);
    }
  }
}

/**
 * Send email notification when a session is archived/expired
 */
export async function sendSessionArchivedEmail(
  to: string[],
  sessionId: string,
  startedAt?: Date
) {
  const user = process.env.EMAIL;
  const pass = process.env.APP_PASSWORD;
  if (!user || !pass) {
    console.log(`EMAIL/APP_PASSWORD not set. Archive email skipped.`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user, pass },
  });

  const subject = "Interview Session Archived – IntervYou";
  const dateStr = startedAt ? startedAt.toLocaleDateString() : new Date().toLocaleDateString();

  const html = `
  <div style="font-family: Arial, sans-serif; color: #111;">
    <p>Hello,</p>
    <p>The interview session you participated in on ${dateStr} has been ended and archived.</p>
    <p>
      <strong>Session ID:</strong> ${sessionId}<br/>
    </p>
    <p>
      Thank you for using IntervYou.
    </p>
    <p>Best regards,<br/>IntervYou Team</p>
  </div>`;

  
  for (const recipient of to) {
    if (!recipient) continue;
    try {
      await transporter.sendMail({
        from: user,
        to: recipient,
        subject,
        text: `The interview session ${sessionId} on ${dateStr} has been archived.`,
        html,
      });
    } catch (error) {
      console.error(`Failed to send archive notification to ${recipient}:`, error);
    }
  }
}
