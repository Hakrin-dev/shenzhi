-- 将既有 GitHub OAuth 注册用户补写的随机占位密码凭证标记出来,
-- 使 hasPassword 判定将其识别为「尚未设置真实密码」。
update "account" as credential
set "scope" = 'oauth-placeholder'
where credential."providerId" = 'credential'
  and credential."password" is not null
  and (credential."scope" is null or credential."scope" <> 'oauth-placeholder')
  and exists (
    select 1
    from "account" as github
    where github."userId" = credential."userId"
      and github."providerId" = 'github'
  );
