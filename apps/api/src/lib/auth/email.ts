// apps/api/src/lib/auth/email.ts
// TODO: Replace stub with Resend SDK when API key is available.
// Required env: RESEND_API_KEY
// npm install resend  (when ready)

export async function sendEmailOTP(email: string, otp: string): Promise<void> {
  console.log(`[AUTH STUB] Email OTP for ${email}: ${otp}`);
  // TODO:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'noreply@baari.pk',
  //   to: email,
  //   subject: 'Your Baari login code',
  //   html: `<p>Your code is: <strong>${otp}</strong> (expires in 10 minutes)</p>`,
  // });
}
