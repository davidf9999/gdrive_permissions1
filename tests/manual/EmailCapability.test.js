/**
 * Optional integration test to verify real SMTP email delivery.
 *
 * This test is intentionally excluded from the standard `npm test` command to
 * avoid sending external emails during routine CI runs. To execute the test,
 * provide the required SMTP environment variables and run `npm run test:email`.
 */

const nodemailer = require('nodemailer');

const REQUIRED_ENV_VARS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'EMAIL_TO',
];

const missingEnvVars = REQUIRED_ENV_VARS.filter(name => !process.env[name]);

if (missingEnvVars.length > 0 || !process.env.RUN_EMAIL_TEST) {
  test.skip(
    `Email capability test skipped. Missing environment variables: ${missingEnvVars.join(
      ', '
    ) || 'None, but RUN_EMAIL_TEST not set.'}`,
    () => {}
  );
} else {
  describe('Email capability integration test', () => {
    jest.setTimeout(30000);

    let transporter;

    beforeAll(() => {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    });

    afterAll(async () => {
      if (transporter && typeof transporter.close === 'function') {
        try {
          transporter.close();
        } catch (error) {
          // Ignore close errors, as some transports (e.g., SMTP pools) may not support it.
        }
      }
    });

    test('sends an email to the configured recipient', async () => {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_TO,
        subject: 'GDrive Permissions Manager - Email Capability Test',
        text: 'This is a verification email triggered by the optional integration test.',
      });

      expect(Array.isArray(info.accepted) ? info.accepted : [info.accepted]).toContain(
        process.env.EMAIL_TO
      );
    });
  });
}
