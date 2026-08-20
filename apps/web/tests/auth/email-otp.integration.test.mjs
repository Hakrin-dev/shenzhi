import assert from "node:assert/strict";
import test from "node:test";

import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";

const TEST_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
const TEST_PASSWORD = "Password12345";

function createEmailOtpAuth(requireEmailVerification) {
  const database = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const sentOtps = [];
  const auth = betterAuth({
    secret: TEST_SECRET,
    baseURL: "http://localhost:3000",
    database: memoryAdapter(database),
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      autoSignInAfterVerification: requireEmailVerification,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        disableSignUp: true,
        sendVerificationOnSignUp: false,
        overrideDefaultEmailVerification: true,
        storeOTP: "hashed",
        async sendVerificationOTP(data) {
          sentOtps.push(data);
        },
      }),
    ],
  });

  return { auth, database, sentOtps };
}

async function signUp(auth, email) {
  return auth.api.signUpEmail({
    body: {
      name: "测试用户",
      email,
      password: TEST_PASSWORD,
    },
  });
}

test("unknown email cannot receive or use a sign-in OTP to create an account", async () => {
  const { auth, database, sentOtps } = createEmailOtpAuth(false);
  const email = "unknown@example.com";

  const sendResult = await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });

  assert.deepEqual(sendResult, { success: true });
  assert.equal(sentOtps.length, 0);
  assert.equal(database.verification?.length ?? 0, 0);

  // Exercise the sign-in endpoint independently from its protected sender.
  const otp = await auth.api.createVerificationOTP({
    body: { email, type: "sign-in" },
  });
  await assert.rejects(
    auth.api.signInEmailOTP({ body: { email, otp } }),
    (error) => error?.body?.code === "INVALID_OTP",
  );
  assert.equal(database.user?.length ?? 0, 0);
  assert.equal(database.session?.length ?? 0, 0);
});

test("registered email can still sign in with an OTP", async () => {
  const { auth, database, sentOtps } = createEmailOtpAuth(false);
  const email = "registered@example.com";
  await signUp(auth, email);
  const initialSessionToken = database.session[0].token;

  await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });
  const message = sentOtps.at(-1);
  assert.equal(message.type, "sign-in");

  const result = await auth.api.signInEmailOTP({
    body: { email, otp: message.otp },
  });

  assert.equal(result.user.email, email);
  assert.equal(database.user.length, 1);
  assert.equal(database.session.length, 1);
  assert.notEqual(database.session[0].token, initialSessionToken);
});

test("verification-disabled development sign-up creates a session without OTP", async () => {
  const { auth, database, sentOtps } = createEmailOtpAuth(false);
  const result = await signUp(auth, "development@example.com");

  assert.equal(typeof result.token, "string");
  assert.equal(result.user.emailVerified, false);
  assert.equal(sentOtps.length, 0);
  assert.equal(database.user.length, 1);
  assert.equal(database.session.length, 1);
});

test("verification-required sign-up sends OTP, rejects a wrong code, then verifies and signs in", async () => {
  const { auth, database, sentOtps } = createEmailOtpAuth(true);
  const email = "production@example.com";
  const result = await signUp(auth, email);

  assert.equal(result.token, null);
  assert.equal(result.user.emailVerified, false);
  assert.equal(database.session?.length ?? 0, 0);
  assert.equal(sentOtps.length, 1);
  assert.equal(sentOtps[0].email, email);
  assert.equal(sentOtps[0].type, "email-verification");
  assert.match(sentOtps[0].otp, /^\d{6}$/);
  assert.equal(database.verification.length, 1);

  await assert.rejects(
    auth.api.verifyEmailOTP({ body: { email, otp: "000000" } }),
    (error) => error?.body?.code === "INVALID_OTP",
  );
  assert.equal(database.user[0].emailVerified, false);

  await assert.rejects(
    auth.api.signInEmail({ body: { email, password: TEST_PASSWORD } }),
    (error) => error?.body?.code === "EMAIL_NOT_VERIFIED",
  );

  const verified = await auth.api.verifyEmailOTP({
    body: { email, otp: sentOtps[0].otp },
  });
  assert.equal(verified.status, true);
  assert.equal(typeof verified.token, "string");
  assert.equal(verified.user.emailVerified, true);
  assert.equal(database.user[0].emailVerified, true);
  assert.equal(database.verification.length, 0);
  assert.equal(database.session.length, 1);
});

test("verification OTP expiry and allowed-attempt errors leave email unverified", async () => {
  const expired = createEmailOtpAuth(true);
  const expiredEmail = "expired@example.com";
  await signUp(expired.auth, expiredEmail);
  expired.database.verification[0].expiresAt = new Date(Date.now() - 1_000);

  await assert.rejects(
    expired.auth.api.verifyEmailOTP({
      body: { email: expiredEmail, otp: expired.sentOtps[0].otp },
    }),
    (error) => error?.body?.code === "OTP_EXPIRED",
  );
  assert.equal(expired.database.user[0].emailVerified, false);

  const limited = createEmailOtpAuth(true);
  const limitedEmail = "limited@example.com";
  await signUp(limited.auth, limitedEmail);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assert.rejects(
      limited.auth.api.verifyEmailOTP({
        body: { email: limitedEmail, otp: "000000" },
      }),
      (error) => error?.body?.code === "INVALID_OTP",
    );
  }
  await assert.rejects(
    limited.auth.api.verifyEmailOTP({
      body: { email: limitedEmail, otp: "000000" },
    }),
    (error) => error?.body?.code === "TOO_MANY_ATTEMPTS",
  );
  assert.equal(limited.database.user[0].emailVerified, false);
});

test("repeated required-verification sign-up returns a synthetic success without leaking existence", async () => {
  const { auth, database, sentOtps } = createEmailOtpAuth(true);
  const email = "duplicate@example.com";

  await signUp(auth, email);
  const duplicateResponse = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "另一个昵称",
        email,
        password: "AnotherPassword123",
      }),
    }),
  );
  const duplicateResult = await duplicateResponse.json();

  assert.equal(duplicateResponse.status, 200);
  assert.equal(duplicateResult.token, null);
  assert.equal(duplicateResult.user.email, email);
  assert.equal(duplicateResult.user.emailVerified, false);
  assert.equal(database.user.length, 1);
  assert.equal(database.account.length, 1);
  assert.equal(sentOtps.length, 1);
  assert.equal(database.verification.length, 1);
});
