import assert from "node:assert/strict";
import test from "node:test";

import {
  AlibabaDirectMailConfigurationError,
  AlibabaDirectMailProviderError,
  createAlibabaDirectMailProvider,
  type AlibabaDirectMailConfig,
} from "../../lib/auth/providers/email/alibaba-directmail.js";
import { createAuthEmailProvider } from "../../lib/auth/providers/email/index.js";

const config: AlibabaDirectMailConfig = {
  accessKeyId: "test-access-key-id",
  accessKeySecret: "test-access-key-secret",
  regionId: "cn-hangzhou",
  endpoint: "dm.aliyuncs.com",
  from: "auth@example.com",
  fromAlias: "深知",
};

const message = {
  to: "person@example.com",
  subject: "验证你的深知邮箱",
  text: "请完成验证。",
  html: "<p>请完成验证。</p>",
};

test("constructs the official DirectMail client with complete configuration", () => {
  assert.doesNotThrow(() => createAlibabaDirectMailProvider(config));
});

test("constructs a DirectMail client and maps AuthEmailMessage to SingleSendMail", async () => {
  let clientConfig: AlibabaDirectMailConfig | undefined;
  let request: Record<string, unknown> | undefined;

  const provider = createAlibabaDirectMailProvider(config, {
    createClient: (nextConfig) => {
      clientConfig = nextConfig;
      return {
        singleSendMail: async (nextRequest) => {
          request = nextRequest as Record<string, unknown>;
        },
      };
    },
  });

  await provider.send(message);

  assert.deepEqual(clientConfig, config);
  assert.equal(request?.accountName, "auth@example.com");
  assert.equal(request?.addressType, 1);
  assert.equal(request?.toAddress, "person@example.com");
  assert.equal(request?.subject, "验证你的深知邮箱");
  assert.equal(request?.textBody, "请完成验证。");
  assert.equal(request?.htmlBody, "<p>请完成验证。</p>");
  assert.equal(request?.fromAlias, "深知");
  assert.equal(request?.replyToAddress, false);
  assert.equal(request?.clickTrace, "0");
});

test("fails safely when DirectMail configuration is incomplete", () => {
  assert.throws(
    () =>
      createAlibabaDirectMailProvider({
        ...config,
        accessKeySecret: undefined,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AlibabaDirectMailConfigurationError);
      assert.match(error.message, /ALIBABA_CLOUD_ACCESS_KEY_SECRET/);
      assert.doesNotMatch(error.message, /test-access-key-secret/);
      return true;
    },
  );
});

test("provider factory stays startable when deployment email settings are absent", () => {
  assert.doesNotThrow(() => {
    assert.equal(
      createAuthEmailProvider({
        provider: "aliyun-directmail",
        accessKeyId: "test-access-key-id",
        regionId: "cn-hangzhou",
        endpoint: "dm.aliyuncs.com",
        from: "auth@example.com",
      }),
      undefined,
    );
  });
});

test("preserves safe DirectMail error metadata without exposing the provider payload", async () => {
  const provider = createAlibabaDirectMailProvider(config, {
    createClient: () => ({
      singleSendMail: async () => {
        const error = Object.assign(new Error("sensitive mail payload"), {
          code: "InvalidReceiverName.Malformed",
          data: { requestId: "request-id-redacted" },
        });
        throw error;
      },
    }),
  });

  await assert.rejects(provider.send(message), (error: unknown) => {
    assert.ok(error instanceof AlibabaDirectMailProviderError);
    assert.equal(error.code, "InvalidReceiverName.Malformed");
    assert.equal(error.requestId, "request-id-redacted");
    assert.doesNotMatch(error.message, /sensitive mail payload/);
    assert.doesNotMatch(error.message, /person@example.com/);
    return true;
  });
});
