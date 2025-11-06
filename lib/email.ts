import nodemailer from "nodemailer";

type Inviter = { name?: string | null; email?: string | null };

export async function sendInviteEmail(to: string, link: string, inviter?: Inviter) {
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

  const subject = "Interview Invitation – IntervYou";
  const html = `
  <div style="font-family: Arial, sans-serif; color: #111;">
    <p>Hello,</p>
    <p>You have been invited to a technical interview on <strong>IntervYou</strong>.</p>
    <p>
      <strong>Interviewer:</strong> ${inviterName}${inviterEmail}<br/>
    </p>
    <p>
      Please click the link below to join at the scheduled time.
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
    text: `You have been invited to a technical interview on IntervYou. Interviewer: ${inviterName}${inviterEmail}. Join: ${link}`,
    html,
  });

  return info;
}
