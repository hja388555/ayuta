import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// 스냅샷 동기화 전용(no-op). feat/admin-images 와 feat/chat 이 각자 마이그레이션을 만들어 chat 스냅샷에
// band_images 가 빠졌다 — 이 파일의 .json 이 합쳐진 전체 스키마를 기록해, 다음 migrate:create 가
// band_images 를 다시 만들려 하지 않게 한다. 실제 DDL 은 20260911_110128_band_images 가 이미 적용한다.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {}
