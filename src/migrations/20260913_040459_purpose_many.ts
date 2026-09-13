import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "orders_purpose" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_orders_purpose",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "orders_purpose" ADD CONSTRAINT "orders_purpose_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_purpose_order_idx" ON "orders_purpose" USING btree ("order");
  CREATE INDEX "orders_purpose_parent_idx" ON "orders_purpose" USING btree ("parent_id");

  -- 기존 단일 값(orders.purpose)을 새 hasMany 테이블로 이관
  INSERT INTO "orders_purpose" ("order", "parent_id", "value")
  SELECT 1, "id", "purpose" FROM "orders" WHERE "purpose" IS NOT NULL;

  -- orders.purpose 컬럼은 이번 배포에서 지우지 않는다 — 배포 창(migrate 후 next build 전)
  -- 동안 구버전 코드가 여전히 이 컬럼을 참조하므로, 컬럼 삭제는 다음 배포로 미룬다.`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "orders_purpose" CASCADE;`)
}
