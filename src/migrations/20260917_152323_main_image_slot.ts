import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_band_images_slot" ADD VALUE IF NOT EXISTS 'main' BEFORE 'category-1';
  ALTER TABLE "band_images" ADD COLUMN IF NOT EXISTS "focus_y" numeric DEFAULT 50;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "band_images" ALTER COLUMN "slot" SET DATA TYPE text;
  DROP TYPE "public"."enum_band_images_slot";
  CREATE TYPE "public"."enum_band_images_slot" AS ENUM('category-1', 'category-2', 'category-3', 'category-4', 'category-5');
  ALTER TABLE "band_images" ALTER COLUMN "slot" SET DATA TYPE "public"."enum_band_images_slot" USING "slot"::"public"."enum_band_images_slot";
  ALTER TABLE "band_images" DROP COLUMN "focus_y";`)
}
