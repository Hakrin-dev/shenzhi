import {
  REGISTRATION_EMAIL_SEND_OTP_PATH,
  REGISTRATION_EMAIL_VERIFY_OTP_PATH,
} from "@/lib/auth/registration/constants";

interface RegistrationClientError {
  code?: string;
  message?: string;
  status: number;
}

interface RegistrationClientResult<T> {
  data: T | null;
  error: RegistrationClientError | null;
}

async function postRegistrationAction<T>(
  path: string,
  body: Record<string, string>,
  headers?: HeadersInit,
): Promise<RegistrationClientResult<T>> {
  try {
    const response = await fetch(`/api/auth${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | (T & { code?: string; message?: string })
      | null;

    if (!response.ok) {
      return {
        data: null,
        error: {
          code: payload?.code,
          message: payload?.message,
          status: response.status,
        },
      };
    }

    return { data: payload as T, error: null };
  } catch {
    return {
      data: null,
      error: { status: 0, message: "Network request failed" },
    };
  }
}

export function sendRegistrationEmailOtp(
  email: string,
  turnstileToken?: string,
) {
  return postRegistrationAction<{ success: true; challengeId: string }>(
    REGISTRATION_EMAIL_SEND_OTP_PATH,
    { email },
    turnstileToken
      ? { "x-captcha-response": turnstileToken }
      : undefined,
  );
}

export function verifyRegistrationEmailOtp(input: {
  email: string;
  otp: string;
  challengeId: string;
}) {
  return postRegistrationAction<{ success: true }>(
    REGISTRATION_EMAIL_VERIFY_OTP_PATH,
    input,
  );
}
