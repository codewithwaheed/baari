// apps/api/src/lib/auth/sms.ts
// TODO: Replace stub with Twilio/Vonage SDK when credentials are available.
// Required env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
// or: VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_FROM_NUMBER

export async function sendOTP(phone: string, otp: string): Promise<void> {
  console.log(`[AUTH STUB] SMS OTP for ${phone}: ${otp}`);
  // TODO: await twilioClient.messages.create({ to: phone, from: FROM, body: `Your Baari code: ${otp}` });
}
