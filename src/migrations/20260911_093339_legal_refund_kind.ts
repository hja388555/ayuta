import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_legal_documents_kind" ADD VALUE 'refund';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "legal_documents" WHERE "kind" = 'refund';
  ALTER TABLE "legal_documents" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_legal_documents_kind";
  CREATE TYPE "public"."enum_legal_documents_kind" AS ENUM('terms', 'privacy');
  ALTER TABLE "legal_documents" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_legal_documents_kind" USING "kind"::"public"."enum_legal_documents_kind";`)
}
