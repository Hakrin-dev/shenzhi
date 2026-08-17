import { optionalEnv } from "./env";

export const ALIYUN_DIRECTMAIL_PROVIDER = "aliyun-directmail" as const;

export interface EmailConfig {
  readonly provider?: string;
  readonly accessKeyId?: string;
  readonly accessKeySecret?: string;
  readonly regionId?: string;
  readonly endpoint?: string;
  readonly from?: string;
  readonly fromAlias?: string;
}

export const emailConfig: EmailConfig = {
  provider: optionalEnv("EMAIL_PROVIDER"),
  accessKeyId: optionalEnv("ALIBABA_CLOUD_ACCESS_KEY_ID"),
  accessKeySecret: optionalEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET"),
  regionId: optionalEnv("ALIYUN_DIRECTMAIL_REGION_ID"),
  endpoint: optionalEnv("ALIYUN_DIRECTMAIL_ENDPOINT"),
  from: optionalEnv("AUTH_EMAIL_FROM"),
  fromAlias: optionalEnv("AUTH_EMAIL_FROM_ALIAS"),
};

export function getAlibabaDirectMailConfig(source: EmailConfig = emailConfig) {
  if (source.provider !== ALIYUN_DIRECTMAIL_PROVIDER) return undefined;

  const {
    accessKeyId,
    accessKeySecret,
    regionId,
    endpoint,
    from,
    fromAlias,
  } = source;

  if (!accessKeyId || !accessKeySecret || !regionId || !endpoint || !from) {
    return undefined;
  }

  return {
    accessKeyId,
    accessKeySecret,
    regionId,
    endpoint,
    from,
    ...(fromAlias ? { fromAlias } : {}),
  };
}

/**
 * This only describes whether the selected provider has the configuration it
 * needs to attempt delivery. It does not enable sign-up email verification.
 */
export const emailDeliveryConfigured =
  getAlibabaDirectMailConfig() !== undefined;
