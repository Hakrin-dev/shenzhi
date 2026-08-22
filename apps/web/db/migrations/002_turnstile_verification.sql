create table "turnstile_verification" (
  "clientId" text not null primary key,
  "expiresAt" timestamptz not null
);
