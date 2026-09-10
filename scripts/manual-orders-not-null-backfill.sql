-- Ruling 16 — orders 테이블 NOT NULL 컬럼 수동 백필.
--
-- 이 브랜치(feat/checkout-contract)가 orders 스키마에 새 필수(NOT NULL) 컬럼을 여러 개
-- 추가했다(category, orderer_*, signature, contract_text 등 — src/collections/Orders.ts
-- 참고). 개발 환경은 Payload의 Postgres 어댑터가 push 모드로 스키마를 자동 맞추지만,
-- 이미 orders 행이 있는 운영/스테이징 DB에 그 push가 그대로 적용되면 기존 행은 새
-- NOT NULL 컬럼 값이 없어 ALTER TABLE ... SET NOT NULL 이 실패한다.
--
-- 정식 해법은 마이그레이션 파일(Q31, "단일 migration 생성")이지만 계획서 제약상 이번
-- 작업에서는 마이그레이션 파일을 만들지 않는다. 그때까지 쓰는 수동 경로가 이 스크립트다.
--
-- 실행: docker exec -i <postgres 컨테이너> psql -U <user> -d <db> -f scripts/manual-orders-not-null-backfill.sql
-- (또는 psql "$DATABASE_URI" -f scripts/manual-orders-not-null-backfill.sql)
--
-- 멱등이다 — 이미 채워진 행은 COALESCE가 원래 값을 그대로 두고, 이미 NOT NULL인 컬럼에
-- SET NOT NULL을 다시 걸어도 Postgres는 에러 없이 통과시킨다.

BEGIN;

-- 스칼라 필수 컬럼 — 값이 없는 기존 행에 안전한 자리표시자를 채운 뒤 NOT NULL을 건다.
-- 실제 값이 아니라 "이 주문은 이 기능 이전에 만들어졌다"는 표시다 — 관리자가 주문
-- 상세에서 빈 서명/계약서를 보면 이 백필 이전 데이터라는 걸 알아챌 수 있게 일부러
-- 눈에 띄는 자리표시자를 쓴다.
UPDATE orders SET category = 1 WHERE category IS NULL;
UPDATE orders SET locale = 'ko' WHERE locale IS NULL;
UPDATE orders SET signature = '(백필 이전 주문 — 서명 없음)' WHERE signature IS NULL;
UPDATE orders SET contract_text = '(백필 이전 주문 — 계약서 스냅샷 없음)' WHERE contract_text IS NULL;
UPDATE orders SET orderer_name = '(미상)' WHERE orderer_name IS NULL;
UPDATE orders SET orderer_phone = '(미상)' WHERE orderer_phone IS NULL;
UPDATE orders SET orderer_email = 'unknown+legacy@ayuta.local' WHERE orderer_email IS NULL;
UPDATE orders SET orderer_postcode = '00000' WHERE orderer_postcode IS NULL;
UPDATE orders SET orderer_address1 = '(미상)' WHERE orderer_address1 IS NULL;

ALTER TABLE orders ALTER COLUMN category SET NOT NULL;
ALTER TABLE orders ALTER COLUMN locale SET NOT NULL;
ALTER TABLE orders ALTER COLUMN signature SET NOT NULL;
ALTER TABLE orders ALTER COLUMN contract_text SET NOT NULL;
ALTER TABLE orders ALTER COLUMN orderer_name SET NOT NULL;
ALTER TABLE orders ALTER COLUMN orderer_phone SET NOT NULL;
ALTER TABLE orders ALTER COLUMN orderer_email SET NOT NULL;
ALTER TABLE orders ALTER COLUMN orderer_postcode SET NOT NULL;
ALTER TABLE orders ALTER COLUMN orderer_address1 SET NOT NULL;

-- idempotency_key(Ruling 15)는 일부러 NOT NULL을 걸지 않는다 — 이 기능 이전 주문에는
-- 값을 지어낼 방법이 없고(멱등키는 "그 요청과 같은 요청"을 가리키는 값이라 사후에
-- 아무 값이나 채우면 의미가 없다), UNIQUE 제약은 Postgres에서 NULL끼리 충돌하지 않으므로
-- NULL로 둬도 유니크 인덱스가 깨지지 않는다.

-- orders_items / orders_contract_items 는 Payload의 array 필드라 별도 자식 테이블이다.
-- 부모 행이 없으면 그냥 빈 관계로 남으므로 여기서 손댈 게 없다 — array 필드는 "NOT NULL
-- 컬럼"이 아니라 참조 무결성일 뿐이라 기존 행이 있어도 깨지지 않는다.

COMMIT;
