import nodemailer from "nodemailer";

export interface OtpEmailSender {
  sendRegistrationOtp(input: { email: string; otp: string }): Promise<void>;
}

export interface SmtpOtpEmailSenderConfig {
  from: string;
  host: string;
  port: number;
}

export function createSmtpOtpEmailSender(config: SmtpOtpEmailSenderConfig): OtpEmailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
  });

  return {
    async sendRegistrationOtp({ email, otp }) {
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: "Your Link2CV verification code",
        text: `Your Link2CV verification code is ${otp}. It expires in 5 minutes.`,
        html: `<p>Your Link2CV verification code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
      });
    },
  };
}
