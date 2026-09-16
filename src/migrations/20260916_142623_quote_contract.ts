import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "quotes_contract_consents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label_ko" varchar NOT NULL,
  	"label_ja" varchar NOT NULL,
  	"required" boolean DEFAULT true NOT NULL
  );
  
  ALTER TABLE "quotes" ADD COLUMN "contract_title" varchar;
  ALTER TABLE "quotes" ADD COLUMN "contract_body" varchar;
  ALTER TABLE "quotes_contract_consents" ADD CONSTRAINT "quotes_contract_consents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quotes_contract_consents_order_idx" ON "quotes_contract_consents" USING btree ("_order");
  CREATE INDEX "quotes_contract_consents_parent_id_idx" ON "quotes_contract_consents" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "quotes_contract_consents" CASCADE;
  ALTER TABLE "quotes" DROP COLUMN "contract_title";
  ALTER TABLE "quotes" DROP COLUMN "contract_body";`)
}
