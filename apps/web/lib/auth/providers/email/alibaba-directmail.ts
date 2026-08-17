import Dm20151123, * as $Dm20151123 from "@alicloud/dm20151123";

import type { AuthEmailMessage, AuthEmailProvider } from "./types";

export interface AlibabaDirectMailConfig {
  readonly accessKeyId?: string;
  readonly accessKeySecret?: string;
  readonly regionId?: string;
  readonly endpoint?: string;
  readonly from?: string;
  readonly fromAlias?: string;
}

export type DirectMailRequest = $Dm20151123.SingleSendMailRequest;

export interface DirectMailClient {
  singleSendMail(request: DirectMailRequest): Promise<unknown>;
}

export type DirectMailClientFactory = (
  config: AlibabaDirectMailConfig,
) => DirectMailClient;

export interface AlibabaDirectMailProviderDependencies {
  readonly createClient?: DirectMailClientFactory;
}

export class AlibabaDirectMailConfigurationError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Alibaba DirectMail configuration is incomplete: ${missing.join(", ")}.`);
    this.name = "AlibabaDirectMailConfigurationError";
    this.missing = missing;
  }
}

export class AlibabaDirectMailProviderError extends Error {
  readonly code?: string;
  readonly requestId?: string;

  constructor(details: { code?: string; requestId?: string }) {
    super(
      details.code
        ? `Alibaba DirectMail send failed (${details.code}).`
        : "Alibaba DirectMail send failed.",
    );
    this.name = "AlibabaDirectMailProviderError";
    this.code = details.code;
    this.requestId = details.requestId;
  }
}

function getMissingConfiguration(config: AlibabaDirectMailConfig): string[] {
  const required = [
    ["ALIBABA_CLOUD_ACCESS_KEY_ID", config.accessKeyId],
    ["ALIBABA_CLOUD_ACCESS_KEY_SECRET", config.accessKeySecret],
    ["ALIYUN_DIRECTMAIL_REGION_ID", config.regionId],
    ["ALIYUN_DIRECTMAIL_ENDPOINT", config.endpoint],
    ["AUTH_EMAIL_FROM", config.from],
  ] as const;

  return required
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function createDefaultDirectMailClient(
  config: AlibabaDirectMailConfig,
): DirectMailClient {
  const clientConfig = {
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    regionId: config.regionId,
    endpoint: config.endpoint,
    type: "access_key",
  } as ConstructorParameters<typeof Dm20151123>[0];

  return new Dm20151123(clientConfig);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return value as Record<string, unknown>;
}

function readString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string");
}

function toProviderError(error: unknown): AlibabaDirectMailProviderError {
  const errorRecord = asRecord(error);
  const dataRecord = asRecord(errorRecord?.data);

  return new AlibabaDirectMailProviderError({
    code: readString(errorRecord?.code, dataRecord?.code),
    requestId: readString(errorRecord?.requestId, dataRecord?.requestId),
  });
}

export class AlibabaDirectMailProvider implements AuthEmailProvider {
  constructor(
    private readonly client: DirectMailClient,
    private readonly config: AlibabaDirectMailConfig,
  ) {}

  async send(message: AuthEmailMessage): Promise<void> {
    const request = new $Dm20151123.SingleSendMailRequest({
      accountName: this.config.from,
      addressType: 1,
      toAddress: message.to,
      subject: message.subject,
      textBody: message.text,
      ...(message.html !== undefined ? { htmlBody: message.html } : {}),
      ...(this.config.fromAlias
        ? { fromAlias: this.config.fromAlias }
        : {}),
      replyToAddress: false,
      clickTrace: "0",
    });

    try {
      await this.client.singleSendMail(request);
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

export function createAlibabaDirectMailProvider(
  config: AlibabaDirectMailConfig,
  dependencies: AlibabaDirectMailProviderDependencies = {},
): AuthEmailProvider {
  const missing = getMissingConfiguration(config);
  if (missing.length > 0) {
    throw new AlibabaDirectMailConfigurationError(missing);
  }

  const client = dependencies.createClient
    ? dependencies.createClient(config)
    : createDefaultDirectMailClient(config);

  return new AlibabaDirectMailProvider(client, config);
}
