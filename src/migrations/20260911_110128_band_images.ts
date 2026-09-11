import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_band_images_slot" AS ENUM('category-1', 'category-2', 'category-3', 'category-4', 'category-5');
  CREATE TABLE "band_images" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slot" "enum_band_images_slot" NOT NULL,
  	"alt_ko" varchar,
  	"alt_ja" varchar,
  	"prefix" varchar DEFAULT 'band-images',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "band_images_id" integer;
  CREATE UNIQUE INDEX "band_images_slot_idx" ON "band_images" USING btree ("slot");
  CREATE INDEX "band_images_updated_at_idx" ON "band_images" USING btree ("updated_at");
  CREATE INDEX "band_images_created_at_idx" ON "band_images" USING btree ("created_at");
  CREATE UNIQUE INDEX "band_images_filename_idx" ON "band_images" USING btree ("filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_band_images_fk" FOREIGN KEY ("band_images_id") REFERENCES "public"."band_images"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_band_images_id_idx" ON "payload_locked_documents_rels" USING btree ("band_images_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "band_images" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "band_images" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_band_images_fk";
  
  DROP INDEX "payload_locked_documents_rels_band_images_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "band_images_id";
  DROP TYPE "public"."enum_band_images_slot";`)
}
