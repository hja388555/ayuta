import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_threads" ALTER COLUMN "customer_id" DROP NOT NULL;
  ALTER TABLE "chat_threads" ADD COLUMN "guest_name" varchar;
  ALTER TABLE "chat_threads" ADD COLUMN "guest_email" varchar;
  ALTER TABLE "chat_threads" ADD COLUMN "guest_phone" varchar;
  ALTER TABLE "chat_threads" ADD COLUMN "guest_token_hash" varchar;
  ALTER TABLE "chat_threads" ADD COLUMN "guest_ip_hash" varchar;
  ALTER TABLE "chat_threads" ADD COLUMN "guest_privacy_consent_at" timestamp(3) with time zone;
  ALTER TABLE "chat_threads" ADD COLUMN "inquiry_id" integer;
  ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "chat_threads_guest_token_hash_idx" ON "chat_threads" USING btree ("guest_token_hash");
  CREATE INDEX "chat_threads_guest_ip_hash_idx" ON "chat_threads" USING btree ("guest_ip_hash");
  CREATE UNIQUE INDEX "chat_threads_inquiry_idx" ON "chat_threads" USING btree ("inquiry_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_threads" DROP CONSTRAINT "chat_threads_inquiry_id_inquiries_id_fk";
  
  DROP INDEX "chat_threads_guest_token_hash_idx";
  DROP INDEX "chat_threads_guest_ip_hash_idx";
  DROP INDEX "chat_threads_inquiry_idx";
  ALTER TABLE "chat_threads" ALTER COLUMN "customer_id" SET NOT NULL;
  ALTER TABLE "chat_threads" DROP COLUMN "guest_name";
  ALTER TABLE "chat_threads" DROP COLUMN "guest_email";
  ALTER TABLE "chat_threads" DROP COLUMN "guest_phone";
  ALTER TABLE "chat_threads" DROP COLUMN "guest_token_hash";
  ALTER TABLE "chat_threads" DROP COLUMN "guest_ip_hash";
  ALTER TABLE "chat_threads" DROP COLUMN "guest_privacy_consent_at";
  ALTER TABLE "chat_threads" DROP COLUMN "inquiry_id";`)
}
