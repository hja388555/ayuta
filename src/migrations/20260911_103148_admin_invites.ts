import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_admin_invites_role" AS ENUM('manager', 'super');
  CREATE TABLE "admin_invites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"role" "enum_admin_invites_role" NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"invited_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "admin_invites_id" integer;
  ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "admin_invites_email_idx" ON "admin_invites" USING btree ("email");
  CREATE UNIQUE INDEX "admin_invites_token_hash_idx" ON "admin_invites" USING btree ("token_hash");
  CREATE INDEX "admin_invites_invited_by_idx" ON "admin_invites" USING btree ("invited_by_id");
  CREATE INDEX "admin_invites_updated_at_idx" ON "admin_invites" USING btree ("updated_at");
  CREATE INDEX "admin_invites_created_at_idx" ON "admin_invites" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_invites_fk" FOREIGN KEY ("admin_invites_id") REFERENCES "public"."admin_invites"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_admin_invites_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_invites_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "admin_invites" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "admin_invites" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_admin_invites_fk";
  
  DROP INDEX "payload_locked_documents_rels_admin_invites_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "admin_invites_id";
  DROP TYPE "public"."enum_admin_invites_role";`)
}
