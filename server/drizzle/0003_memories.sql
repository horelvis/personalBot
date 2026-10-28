CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_owner_created_idx" ON "memories" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "memories_search_idx" ON "memories" USING gin ("search");