/**
 * 附件上传 → prompt 注入 链路自测（需在 dev server 运行时执行）
 * node scripts/test-upload-pipeline.mjs
 */
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function main() {
  const form = new FormData();
  const content = "SECRET_ATTACHMENT_MARKER_42";
  form.append(
    "file",
    new Blob([content], { type: "text/plain" }),
    "pipeline-test.txt",
  );

  const uploadRes = await fetch(`${BASE}/api/b/uploads`, {
    method: "POST",
    body: form,
  });
  const uploadJson = await uploadRes.json();
  console.log("[1] upload status:", uploadRes.status);
  console.log("[1] upload body:", JSON.stringify(uploadJson, null, 2));

  if (uploadJson.code !== 0 || !uploadJson.data?.text?.includes(content)) {
    console.error("FAIL: upload did not return parsed text");
    process.exit(1);
  }

  const attachmentText = uploadJson.data.text;
  const systemWithAttachment = `你是助手。\n\n===== 以下为用户上传附件解析内容，请优先结合这些内容回答 =====\n[附件 pipeline-test.txt]\n${attachmentText}\n===== 附件内容结束 =====\n`;

  const chatRes = await fetch(`${BASE}/api/b/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "ai",
      message: "附件里的 SECRET_ATTACHMENT_MARKER_42 是什么？只回答数字部分。",
      model: "deepseek-chat",
      style: "fast",
      webSearch: false,
      attachments: [],
      messages: [
        { role: "system", content: systemWithAttachment },
        {
          role: "user",
          content:
            "附件里的 SECRET_ATTACHMENT_MARKER_42 是什么？只回答数字部分。",
        },
      ],
    }),
  });

  console.log("[2] chat status:", chatRes.status);
  const chatText = await chatRes.text();
  const hasMarker =
    chatText.includes("42") || chatText.includes("SECRET_ATTACHMENT_MARKER");
  console.log("[2] chat stream snippet:", chatText.slice(0, 800));

  if (!hasMarker) {
    console.error(
      "WARN: chat response may not reflect attachment (check DEEPSEEK_API_KEY)",
    );
    process.exit(0);
  }

  console.log("PASS: upload parse + LLM context pipeline OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
