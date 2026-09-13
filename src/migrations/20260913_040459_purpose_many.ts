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

  -- 기존 단일 값(orders.purpose)을 새 hasMany 테이블로 이관 — 컬럼을 지우기 전에 반드시 옮긴다
  INSERT INTO "orders_purpose" ("order", "parent_id", "value")
  SELECT 1, "id", "purpose" FROM "orders" WHERE "purpose" IS NOT NULL;

  ALTER TABLE "orders" DROP COLUMN "purpose";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN "purpose" "enum_orders_purpose";

  -- 되돌릴 때는 각 주문의 첫 값(order=1)만 단일 컬럼으로 되돌린다 — 여러 개를 하나로 압축하는
  -- 손실 있는 역방향이라 up 과 대칭이 아니다(관리자가 굳이 내려가야 할 때만 쓰는 비상 경로)
  UPDATE "orders" SET "purpose" = "orders_purpose"."value"
  FROM "orders_purpose"
  WHERE "orders_purpose"."parent_id" = "orders"."id" AND "orders_purpose"."order" = 1;

  DROP TABLE "orders_purpose" CASCADE;`)
}
