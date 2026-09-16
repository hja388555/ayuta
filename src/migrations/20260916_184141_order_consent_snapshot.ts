import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "orders_consent_snapshot" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"required" boolean DEFAULT false NOT NULL,
  	"agreed" boolean DEFAULT false NOT NULL
  );
  
  ALTER TABLE "orders_consent_snapshot" ADD CONSTRAINT "orders_consent_snapshot_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_consent_snapshot_order_idx" ON "orders_consent_snapshot" USING btree ("_order");
  CREATE INDEX "orders_consent_snapshot_parent_id_idx" ON "orders_consent_snapshot" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "orders_consent_snapshot" CASCADE;`)
}
