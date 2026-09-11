import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiry_files" ADD COLUMN "prefix" varchar DEFAULT 'inquiry-files';
  ALTER TABLE "brand_assets" ADD COLUMN "prefix" varchar DEFAULT 'brand-assets';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiry_files" DROP COLUMN "prefix";
  ALTER TABLE "brand_assets" DROP COLUMN "prefix";`)
}
