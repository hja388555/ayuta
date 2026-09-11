import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('customer', 'manager', 'super');
  CREATE TYPE "public"."enum_orders_country" AS ENUM('kr', 'jp');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'paid', 'in_progress', 'done', 'failed', 'cancelled', 'fraud_suspected');
  CREATE TYPE "public"."enum_orders_currency" AS ENUM('KRW', 'JPY');
  CREATE TYPE "public"."enum_orders_locale" AS ENUM('ko', 'ja');
  CREATE TYPE "public"."enum_orders_purpose" AS ENUM('brand', 'product', 'store', 'medical', 'event', 'etc');
  CREATE TYPE "public"."enum_order_schedule_changes_field" AS ENUM('contractStart', 'contractEnd', 'adStartDate');
  CREATE TYPE "public"."enum_contract_templates_locale" AS ENUM('ko', 'ja');
  CREATE TYPE "public"."enum_inquiries_locale" AS ENUM('ko', 'ja');
  CREATE TYPE "public"."enum_inquiries_status" AS ENUM('new', 'quoted', 'closed');
  CREATE TYPE "public"."enum_quotes_currency" AS ENUM('KRW', 'JPY');
  CREATE TYPE "public"."enum_quotes_status" AS ENUM('issued', 'revoked');
  CREATE TYPE "public"."enum_brand_assets_kind" AS ENUM('seal');
  CREATE TYPE "public"."enum_legal_documents_kind" AS ENUM('terms', 'privacy');
  CREATE TYPE "public"."enum_legal_documents_locale" AS ENUM('ko', 'ja');
  CREATE TYPE "public"."enum_legal_revisions_target" AS ENUM('contract-templates', 'legal-documents');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'customer' NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"postal_code" varchar NOT NULL,
  	"address1" varchar NOT NULL,
  	"address2" varchar,
  	"business_no" varchar,
  	"terms_agreed_at" timestamp(3) with time zone,
  	"privacy_agreed_at" timestamp(3) with time zone,
  	"deleted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "price_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label_ko" varchar NOT NULL,
  	"label_ja" varchar NOT NULL,
  	"category" numeric NOT NULL,
  	"price_krw" numeric NOT NULL,
  	"price_jpy" numeric NOT NULL,
  	"active" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"unit_amount" numeric NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "orders_contract_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "orders_country" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_orders_country",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar NOT NULL,
  	"payment_id" varchar NOT NULL,
  	"idempotency_key" varchar,
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"currency" "enum_orders_currency" NOT NULL,
  	"amount" numeric NOT NULL,
  	"locale" "enum_orders_locale" NOT NULL,
  	"category" numeric NOT NULL,
  	"purpose" "enum_orders_purpose",
  	"customer_id" integer,
  	"orderer_name" varchar NOT NULL,
  	"orderer_phone" varchar NOT NULL,
  	"orderer_email" varchar NOT NULL,
  	"orderer_postcode" varchar NOT NULL,
  	"orderer_address1" varchar NOT NULL,
  	"orderer_address2" varchar,
  	"orderer_business_no" varchar,
  	"orderer_representative" varchar,
  	"signature" varchar NOT NULL,
  	"contract_text" varchar NOT NULL,
  	"seal_asset_id" integer,
  	"contract_start" timestamp(3) with time zone,
  	"contract_end" timestamp(3) with time zone,
  	"ad_start_date" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"fail_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "order_transitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"from_status" varchar NOT NULL,
  	"to_status" varchar NOT NULL,
  	"actor_id" integer,
  	"reason" varchar,
  	"at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "order_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"body" varchar NOT NULL,
  	"author_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "order_schedule_changes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"field" "enum_order_schedule_changes_field" NOT NULL,
  	"from_value" varchar,
  	"to_value" varchar,
  	"actor_id" integer,
  	"at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contract_templates_consents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"required" boolean DEFAULT true NOT NULL
  );
  
  CREATE TABLE "contract_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" numeric NOT NULL,
  	"locale" "enum_contract_templates_locale" NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"active" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" varchar,
  	"body" varchar NOT NULL,
  	"region" varchar,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"locale" "enum_inquiries_locale" NOT NULL,
  	"customer_id" integer,
  	"status" "enum_inquiries_status" DEFAULT 'new' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"inquiry_files_id" integer
  );
  
  CREATE TABLE "inquiry_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"original_name" varchar,
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
  
  CREATE TABLE "quotes_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"quantity" numeric NOT NULL,
  	"unit_amount" numeric NOT NULL
  );
  
  CREATE TABLE "quotes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"quote_number" varchar NOT NULL,
  	"inquiry_id" integer NOT NULL,
  	"currency" "enum_quotes_currency" NOT NULL,
  	"total" numeric NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"status" "enum_quotes_status" DEFAULT 'issued' NOT NULL,
  	"issued_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"issued_by_id" integer,
  	"revoked_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "admin_login_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"email" varchar NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"ip" varchar,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brand_assets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_brand_assets_kind" NOT NULL,
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
  
  CREATE TABLE "legal_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_legal_documents_kind" NOT NULL,
  	"locale" "enum_legal_documents_locale" NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "legal_revisions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"target" "enum_legal_revisions_target" NOT NULL,
  	"doc_id" numeric NOT NULL,
  	"label" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"consents" jsonb,
  	"editor_id" integer,
  	"editor_email" varchar NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"price_entries_id" integer,
  	"orders_id" integer,
  	"order_transitions_id" integer,
  	"order_notes_id" integer,
  	"order_schedule_changes_id" integer,
  	"contract_templates_id" integer,
  	"inquiries_id" integer,
  	"inquiry_files_id" integer,
  	"quotes_id" integer,
  	"admin_login_logs_id" integer,
  	"brand_assets_id" integer,
  	"legal_documents_id" integer,
  	"legal_revisions_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pricing_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"period_multipliers_1w" numeric DEFAULT 1 NOT NULL,
  	"period_multipliers_2w" numeric DEFAULT 1.8 NOT NULL,
  	"period_multipliers_1m" numeric DEFAULT 3 NOT NULL,
  	"period_multipliers_3m" numeric DEFAULT 8 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "company_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name_ko" varchar DEFAULT 'AYUTA(아유타)' NOT NULL,
  	"name_ja" varchar DEFAULT 'AYUTA(アユタ)' NOT NULL,
  	"ceo" varchar DEFAULT '황지원' NOT NULL,
  	"business_no" varchar DEFAULT '259-23-02007' NOT NULL,
  	"address_ko" varchar DEFAULT '서울특별시 동대문구 답십리동 323' NOT NULL,
  	"address_ja" varchar DEFAULT 'ソウル特別市東大門区踏十里洞323' NOT NULL,
  	"phone" varchar DEFAULT '02-3394-8838' NOT NULL,
  	"email" varchar DEFAULT 'gggwon@gmail.com' NOT NULL,
  	"contact_phone" varchar,
  	"mail_order_no" varchar,
  	"seal_image_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "order_counters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"scope" text NOT NULL,
  	"day" text NOT NULL,
  	"seq" integer DEFAULT 0 NOT NULL,
  	CONSTRAINT "order_counters_scope_day_key" UNIQUE("scope","day")
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_contract_items" ADD CONSTRAINT "orders_contract_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_country" ADD CONSTRAINT "orders_country_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_seal_asset_id_brand_assets_id_fk" FOREIGN KEY ("seal_asset_id") REFERENCES "public"."brand_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_transitions" ADD CONSTRAINT "order_transitions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_transitions" ADD CONSTRAINT "order_transitions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_schedule_changes" ADD CONSTRAINT "order_schedule_changes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "order_schedule_changes" ADD CONSTRAINT "order_schedule_changes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contract_templates_consents" ADD CONSTRAINT "contract_templates_consents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contract_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiries_rels" ADD CONSTRAINT "inquiries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "inquiries_rels" ADD CONSTRAINT "inquiries_rels_inquiry_files_fk" FOREIGN KEY ("inquiry_files_id") REFERENCES "public"."inquiry_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes_lines" ADD CONSTRAINT "quotes_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_issued_by_id_users_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "admin_login_logs" ADD CONSTRAINT "admin_login_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_revisions" ADD CONSTRAINT "legal_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_entries_fk" FOREIGN KEY ("price_entries_id") REFERENCES "public"."price_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_order_transitions_fk" FOREIGN KEY ("order_transitions_id") REFERENCES "public"."order_transitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_order_notes_fk" FOREIGN KEY ("order_notes_id") REFERENCES "public"."order_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_order_schedule_changes_fk" FOREIGN KEY ("order_schedule_changes_id") REFERENCES "public"."order_schedule_changes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contract_templates_fk" FOREIGN KEY ("contract_templates_id") REFERENCES "public"."contract_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiries_fk" FOREIGN KEY ("inquiries_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_files_fk" FOREIGN KEY ("inquiry_files_id") REFERENCES "public"."inquiry_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_login_logs_fk" FOREIGN KEY ("admin_login_logs_id") REFERENCES "public"."admin_login_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brand_assets_fk" FOREIGN KEY ("brand_assets_id") REFERENCES "public"."brand_assets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_documents_fk" FOREIGN KEY ("legal_documents_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_revisions_fk" FOREIGN KEY ("legal_revisions_id") REFERENCES "public"."legal_revisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_seal_image_id_brand_assets_id_fk" FOREIGN KEY ("seal_image_id") REFERENCES "public"."brand_assets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "price_entries_key_idx" ON "price_entries" USING btree ("key");
  CREATE INDEX "price_entries_category_idx" ON "price_entries" USING btree ("category");
  CREATE INDEX "price_entries_updated_at_idx" ON "price_entries" USING btree ("updated_at");
  CREATE INDEX "price_entries_created_at_idx" ON "price_entries" USING btree ("created_at");
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_contract_items_order_idx" ON "orders_contract_items" USING btree ("_order");
  CREATE INDEX "orders_contract_items_parent_id_idx" ON "orders_contract_items" USING btree ("_parent_id");
  CREATE INDEX "orders_country_order_idx" ON "orders_country" USING btree ("order");
  CREATE INDEX "orders_country_parent_idx" ON "orders_country" USING btree ("parent_id");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE UNIQUE INDEX "orders_payment_id_idx" ON "orders" USING btree ("payment_id");
  CREATE UNIQUE INDEX "orders_idempotency_key_idx" ON "orders" USING btree ("idempotency_key");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_seal_asset_idx" ON "orders" USING btree ("seal_asset_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "order_transitions_order_idx" ON "order_transitions" USING btree ("order_id");
  CREATE INDEX "order_transitions_actor_idx" ON "order_transitions" USING btree ("actor_id");
  CREATE INDEX "order_transitions_updated_at_idx" ON "order_transitions" USING btree ("updated_at");
  CREATE INDEX "order_transitions_created_at_idx" ON "order_transitions" USING btree ("created_at");
  CREATE INDEX "order_notes_order_idx" ON "order_notes" USING btree ("order_id");
  CREATE INDEX "order_notes_author_idx" ON "order_notes" USING btree ("author_id");
  CREATE INDEX "order_notes_updated_at_idx" ON "order_notes" USING btree ("updated_at");
  CREATE INDEX "order_notes_created_at_idx" ON "order_notes" USING btree ("created_at");
  CREATE INDEX "order_schedule_changes_order_idx" ON "order_schedule_changes" USING btree ("order_id");
  CREATE INDEX "order_schedule_changes_actor_idx" ON "order_schedule_changes" USING btree ("actor_id");
  CREATE INDEX "order_schedule_changes_updated_at_idx" ON "order_schedule_changes" USING btree ("updated_at");
  CREATE INDEX "order_schedule_changes_created_at_idx" ON "order_schedule_changes" USING btree ("created_at");
  CREATE INDEX "contract_templates_consents_order_idx" ON "contract_templates_consents" USING btree ("_order");
  CREATE INDEX "contract_templates_consents_parent_id_idx" ON "contract_templates_consents" USING btree ("_parent_id");
  CREATE INDEX "contract_templates_category_idx" ON "contract_templates" USING btree ("category");
  CREATE INDEX "contract_templates_locale_idx" ON "contract_templates" USING btree ("locale");
  CREATE INDEX "contract_templates_active_idx" ON "contract_templates" USING btree ("active");
  CREATE INDEX "contract_templates_updated_at_idx" ON "contract_templates" USING btree ("updated_at");
  CREATE INDEX "contract_templates_created_at_idx" ON "contract_templates" USING btree ("created_at");
  CREATE UNIQUE INDEX "category_locale_idx" ON "contract_templates" USING btree ("category","locale");
  CREATE INDEX "inquiries_type_idx" ON "inquiries" USING btree ("type");
  CREATE INDEX "inquiries_customer_idx" ON "inquiries" USING btree ("customer_id");
  CREATE INDEX "inquiries_status_idx" ON "inquiries" USING btree ("status");
  CREATE INDEX "inquiries_updated_at_idx" ON "inquiries" USING btree ("updated_at");
  CREATE INDEX "inquiries_created_at_idx" ON "inquiries" USING btree ("created_at");
  CREATE INDEX "inquiries_rels_order_idx" ON "inquiries_rels" USING btree ("order");
  CREATE INDEX "inquiries_rels_parent_idx" ON "inquiries_rels" USING btree ("parent_id");
  CREATE INDEX "inquiries_rels_path_idx" ON "inquiries_rels" USING btree ("path");
  CREATE INDEX "inquiries_rels_inquiry_files_id_idx" ON "inquiries_rels" USING btree ("inquiry_files_id");
  CREATE INDEX "inquiry_files_updated_at_idx" ON "inquiry_files" USING btree ("updated_at");
  CREATE INDEX "inquiry_files_created_at_idx" ON "inquiry_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "inquiry_files_filename_idx" ON "inquiry_files" USING btree ("filename");
  CREATE INDEX "quotes_lines_order_idx" ON "quotes_lines" USING btree ("_order");
  CREATE INDEX "quotes_lines_parent_id_idx" ON "quotes_lines" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "quotes_quote_number_idx" ON "quotes" USING btree ("quote_number");
  CREATE INDEX "quotes_inquiry_idx" ON "quotes" USING btree ("inquiry_id");
  CREATE UNIQUE INDEX "quotes_token_hash_idx" ON "quotes" USING btree ("token_hash");
  CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");
  CREATE INDEX "quotes_issued_by_idx" ON "quotes" USING btree ("issued_by_id");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  CREATE INDEX "admin_login_logs_user_idx" ON "admin_login_logs" USING btree ("user_id");
  CREATE INDEX "admin_login_logs_at_idx" ON "admin_login_logs" USING btree ("at");
  CREATE INDEX "admin_login_logs_updated_at_idx" ON "admin_login_logs" USING btree ("updated_at");
  CREATE INDEX "admin_login_logs_created_at_idx" ON "admin_login_logs" USING btree ("created_at");
  CREATE INDEX "brand_assets_updated_at_idx" ON "brand_assets" USING btree ("updated_at");
  CREATE INDEX "brand_assets_created_at_idx" ON "brand_assets" USING btree ("created_at");
  CREATE UNIQUE INDEX "brand_assets_filename_idx" ON "brand_assets" USING btree ("filename");
  CREATE INDEX "legal_documents_kind_idx" ON "legal_documents" USING btree ("kind");
  CREATE INDEX "legal_documents_locale_idx" ON "legal_documents" USING btree ("locale");
  CREATE INDEX "legal_documents_updated_at_idx" ON "legal_documents" USING btree ("updated_at");
  CREATE INDEX "legal_documents_created_at_idx" ON "legal_documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "kind_locale_idx" ON "legal_documents" USING btree ("kind","locale");
  CREATE INDEX "legal_revisions_target_idx" ON "legal_revisions" USING btree ("target");
  CREATE INDEX "legal_revisions_doc_id_idx" ON "legal_revisions" USING btree ("doc_id");
  CREATE INDEX "legal_revisions_editor_idx" ON "legal_revisions" USING btree ("editor_id");
  CREATE INDEX "legal_revisions_at_idx" ON "legal_revisions" USING btree ("at");
  CREATE INDEX "legal_revisions_updated_at_idx" ON "legal_revisions" USING btree ("updated_at");
  CREATE INDEX "legal_revisions_created_at_idx" ON "legal_revisions" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_price_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("price_entries_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_order_transitions_id_idx" ON "payload_locked_documents_rels" USING btree ("order_transitions_id");
  CREATE INDEX "payload_locked_documents_rels_order_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("order_notes_id");
  CREATE INDEX "payload_locked_documents_rels_order_schedule_changes_id_idx" ON "payload_locked_documents_rels" USING btree ("order_schedule_changes_id");
  CREATE INDEX "payload_locked_documents_rels_contract_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("contract_templates_id");
  CREATE INDEX "payload_locked_documents_rels_inquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiries_id");
  CREATE INDEX "payload_locked_documents_rels_inquiry_files_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_files_id");
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");
  CREATE INDEX "payload_locked_documents_rels_admin_login_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_login_logs_id");
  CREATE INDEX "payload_locked_documents_rels_brand_assets_id_idx" ON "payload_locked_documents_rels" USING btree ("brand_assets_id");
  CREATE INDEX "payload_locked_documents_rels_legal_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_documents_id");
  CREATE INDEX "payload_locked_documents_rels_legal_revisions_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_revisions_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "company_settings_seal_image_idx" ON "company_settings" USING btree ("seal_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "price_entries" CASCADE;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders_contract_items" CASCADE;
  DROP TABLE "orders_country" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "order_transitions" CASCADE;
  DROP TABLE "order_notes" CASCADE;
  DROP TABLE "order_schedule_changes" CASCADE;
  DROP TABLE "contract_templates_consents" CASCADE;
  DROP TABLE "contract_templates" CASCADE;
  DROP TABLE "inquiries" CASCADE;
  DROP TABLE "inquiries_rels" CASCADE;
  DROP TABLE "inquiry_files" CASCADE;
  DROP TABLE "quotes_lines" CASCADE;
  DROP TABLE "quotes" CASCADE;
  DROP TABLE "admin_login_logs" CASCADE;
  DROP TABLE "brand_assets" CASCADE;
  DROP TABLE "legal_documents" CASCADE;
  DROP TABLE "legal_revisions" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "pricing_settings" CASCADE;
  DROP TABLE "company_settings" CASCADE;
  DROP TABLE "order_counters" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_orders_country";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_currency";
  DROP TYPE "public"."enum_orders_locale";
  DROP TYPE "public"."enum_orders_purpose";
  DROP TYPE "public"."enum_order_schedule_changes_field";
  DROP TYPE "public"."enum_contract_templates_locale";
  DROP TYPE "public"."enum_inquiries_locale";
  DROP TYPE "public"."enum_inquiries_status";
  DROP TYPE "public"."enum_quotes_currency";
  DROP TYPE "public"."enum_quotes_status";
  DROP TYPE "public"."enum_brand_assets_kind";
  DROP TYPE "public"."enum_legal_documents_kind";
  DROP TYPE "public"."enum_legal_documents_locale";
  DROP TYPE "public"."enum_legal_revisions_target";`)
}
