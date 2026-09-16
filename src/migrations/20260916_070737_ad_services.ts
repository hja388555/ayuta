import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ad_services_model" AS ENUM('tier', 'sum', 'sumMultiplier', 'videoPairs', 'inquiry');
  CREATE TYPE "public"."enum_ad_services_contract_mode" AS ENUM('fixed', 'perQuote');
  CREATE TYPE "public"."enum_ad_service_groups_axis" AS ENUM('none', 'type', 'length');
  CREATE TYPE "public"."enum_price_entries_country" AS ENUM('kr', 'jp');
  CREATE TABLE "ad_services_periods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label_ko" varchar NOT NULL,
  	"label_ja" varchar NOT NULL,
  	"multiplier" numeric NOT NULL
  );
  
  CREATE TABLE "ad_services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"no" numeric NOT NULL,
  	"slug" varchar NOT NULL,
  	"name_ko" varchar NOT NULL,
  	"name_ja" varchar NOT NULL,
  	"desc_ko" varchar,
  	"desc_ja" varchar,
  	"model" "enum_ad_services_model" NOT NULL,
  	"contract_mode" "enum_ad_services_contract_mode" DEFAULT 'fixed' NOT NULL,
  	"sort_order" numeric DEFAULT 100 NOT NULL,
  	"active" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ad_service_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"service_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"title_ko" varchar NOT NULL,
  	"title_ja" varchar NOT NULL,
  	"hint_ko" varchar,
  	"hint_ja" varchar,
  	"multi" boolean DEFAULT false NOT NULL,
  	"country_tabs" boolean DEFAULT false NOT NULL,
  	"axis" "enum_ad_service_groups_axis" DEFAULT 'none' NOT NULL,
  	"sort_order" numeric DEFAULT 100 NOT NULL,
  	"active" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "price_entries" ADD COLUMN "group_id" integer;
  ALTER TABLE "price_entries" ADD COLUMN "priced" boolean DEFAULT true;
  ALTER TABLE "price_entries" ADD COLUMN "country" "enum_price_entries_country";
  ALTER TABLE "price_entries" ADD COLUMN "exclusive" boolean DEFAULT false;
  ALTER TABLE "price_entries" ADD COLUMN "desc_ko" varchar;
  ALTER TABLE "price_entries" ADD COLUMN "desc_ja" varchar;
  ALTER TABLE "price_entries" ADD COLUMN "sort_order" numeric DEFAULT 100;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ad_services_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ad_service_groups_id" integer;
  ALTER TABLE "ad_services_periods" ADD CONSTRAINT "ad_services_periods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ad_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ad_service_groups" ADD CONSTRAINT "ad_service_groups_service_id_ad_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."ad_services"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ad_services_periods_order_idx" ON "ad_services_periods" USING btree ("_order");
  CREATE INDEX "ad_services_periods_parent_id_idx" ON "ad_services_periods" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "ad_services_no_idx" ON "ad_services" USING btree ("no");
  CREATE UNIQUE INDEX "ad_services_slug_idx" ON "ad_services" USING btree ("slug");
  CREATE INDEX "ad_services_updated_at_idx" ON "ad_services" USING btree ("updated_at");
  CREATE INDEX "ad_services_created_at_idx" ON "ad_services" USING btree ("created_at");
  CREATE INDEX "ad_service_groups_service_idx" ON "ad_service_groups" USING btree ("service_id");
  CREATE INDEX "ad_service_groups_key_idx" ON "ad_service_groups" USING btree ("key");
  CREATE INDEX "ad_service_groups_updated_at_idx" ON "ad_service_groups" USING btree ("updated_at");
  CREATE INDEX "ad_service_groups_created_at_idx" ON "ad_service_groups" USING btree ("created_at");
  ALTER TABLE "price_entries" ADD CONSTRAINT "price_entries_group_id_ad_service_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."ad_service_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ad_services_fk" FOREIGN KEY ("ad_services_id") REFERENCES "public"."ad_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ad_service_groups_fk" FOREIGN KEY ("ad_service_groups_id") REFERENCES "public"."ad_service_groups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "price_entries_group_idx" ON "price_entries" USING btree ("group_id");
  CREATE INDEX "payload_locked_documents_rels_ad_services_id_idx" ON "payload_locked_documents_rels" USING btree ("ad_services_id");
  CREATE INDEX "payload_locked_documents_rels_ad_service_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("ad_service_groups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ad_services_periods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ad_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ad_service_groups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ad_services_periods" CASCADE;
  DROP TABLE "ad_services" CASCADE;
  DROP TABLE "ad_service_groups" CASCADE;
  ALTER TABLE "price_entries" DROP CONSTRAINT "price_entries_group_id_ad_service_groups_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ad_services_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ad_service_groups_fk";
  
  DROP INDEX "price_entries_group_idx";
  DROP INDEX "payload_locked_documents_rels_ad_services_id_idx";
  DROP INDEX "payload_locked_documents_rels_ad_service_groups_id_idx";
  ALTER TABLE "price_entries" DROP COLUMN "group_id";
  ALTER TABLE "price_entries" DROP COLUMN "priced";
  ALTER TABLE "price_entries" DROP COLUMN "country";
  ALTER TABLE "price_entries" DROP COLUMN "exclusive";
  ALTER TABLE "price_entries" DROP COLUMN "desc_ko";
  ALTER TABLE "price_entries" DROP COLUMN "desc_ja";
  ALTER TABLE "price_entries" DROP COLUMN "sort_order";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ad_services_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ad_service_groups_id";
  DROP TYPE "public"."enum_ad_services_model";
  DROP TYPE "public"."enum_ad_services_contract_mode";
  DROP TYPE "public"."enum_ad_service_groups_axis";
  DROP TYPE "public"."enum_price_entries_country";`)
}
