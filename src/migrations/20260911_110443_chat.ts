import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_chat_threads_locale" AS ENUM('ko', 'ja');
  CREATE TYPE "public"."enum_chat_threads_status" AS ENUM('open', 'closed');
  CREATE TYPE "public"."enum_chat_messages_sender" AS ENUM('customer', 'admin');
  CREATE TYPE "public"."enum_chat_messages_translation_status" AS ENUM('ok', 'failed', 'skipped');
  CREATE TABLE "chat_threads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"locale" "enum_chat_threads_locale" DEFAULT 'ko' NOT NULL,
  	"status" "enum_chat_threads_status" DEFAULT 'open' NOT NULL,
  	"last_message_at" timestamp(3) with time zone,
  	"unread_for_admin" numeric DEFAULT 0 NOT NULL,
  	"unread_for_customer" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "chat_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"thread_id" integer NOT NULL,
  	"sender" "enum_chat_messages_sender" NOT NULL,
  	"sender_user_id" integer,
  	"sender_email" varchar,
  	"body" varchar NOT NULL,
  	"source_lang" varchar,
  	"translated_body" varchar,
  	"translated_lang" varchar,
  	"translation_status" "enum_chat_messages_translation_status" DEFAULT 'skipped' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "chat_threads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "chat_messages_id" integer;
  ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "chat_threads_customer_idx" ON "chat_threads" USING btree ("customer_id");
  CREATE INDEX "chat_threads_last_message_at_idx" ON "chat_threads" USING btree ("last_message_at");
  CREATE INDEX "chat_threads_updated_at_idx" ON "chat_threads" USING btree ("updated_at");
  CREATE INDEX "chat_threads_created_at_idx" ON "chat_threads" USING btree ("created_at");
  CREATE INDEX "chat_messages_thread_idx" ON "chat_messages" USING btree ("thread_id");
  CREATE INDEX "chat_messages_sender_user_idx" ON "chat_messages" USING btree ("sender_user_id");
  CREATE INDEX "chat_messages_updated_at_idx" ON "chat_messages" USING btree ("updated_at");
  CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_chat_threads_fk" FOREIGN KEY ("chat_threads_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_chat_messages_fk" FOREIGN KEY ("chat_messages_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_chat_threads_id_idx" ON "payload_locked_documents_rels" USING btree ("chat_threads_id");
  CREATE INDEX "payload_locked_documents_rels_chat_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("chat_messages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "chat_threads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "chat_messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "chat_threads" CASCADE;
  DROP TABLE "chat_messages" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_chat_threads_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_chat_messages_fk";
  
  DROP INDEX "payload_locked_documents_rels_chat_threads_id_idx";
  DROP INDEX "payload_locked_documents_rels_chat_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "chat_threads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "chat_messages_id";
  DROP TYPE "public"."enum_chat_threads_locale";
  DROP TYPE "public"."enum_chat_threads_status";
  DROP TYPE "public"."enum_chat_messages_sender";
  DROP TYPE "public"."enum_chat_messages_translation_status";`)
}
