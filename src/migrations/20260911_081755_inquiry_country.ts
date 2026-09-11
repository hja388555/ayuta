import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_inquiries_country" AS ENUM('kr', 'jp');
  CREATE TABLE "inquiries_country" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_inquiries_country",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "inquiries_country" ADD CONSTRAINT "inquiries_country_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "inquiries_country_order_idx" ON "inquiries_country" USING btree ("order");
  CREATE INDEX "inquiries_country_parent_idx" ON "inquiries_country" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "inquiries_country" CASCADE;
  DROP TYPE "public"."enum_inquiries_country";`)
}
