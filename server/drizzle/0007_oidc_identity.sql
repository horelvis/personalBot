ALTER TABLE "users" ADD COLUMN "oidc_issuer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oidc_subject" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_oidc_identity_idx" ON "users" USING btree ("oidc_issuer","oidc_subject");