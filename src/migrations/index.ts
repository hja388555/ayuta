import * as migration_20260911_042835_baseline from './20260911_042835_baseline';
import * as migration_20260911_052437_storage_prefix from './20260911_052437_storage_prefix';
import * as migration_20260911_081755_inquiry_country from './20260911_081755_inquiry_country';
import * as migration_20260911_090442_users_consents from './20260911_090442_users_consents';
import * as migration_20260911_093339_legal_refund_kind from './20260911_093339_legal_refund_kind';

export const migrations = [
  {
    up: migration_20260911_042835_baseline.up,
    down: migration_20260911_042835_baseline.down,
    name: '20260911_042835_baseline',
  },
  {
    up: migration_20260911_052437_storage_prefix.up,
    down: migration_20260911_052437_storage_prefix.down,
    name: '20260911_052437_storage_prefix',
  },
  {
    up: migration_20260911_081755_inquiry_country.up,
    down: migration_20260911_081755_inquiry_country.down,
    name: '20260911_081755_inquiry_country',
  },
  {
    up: migration_20260911_090442_users_consents.up,
    down: migration_20260911_090442_users_consents.down,
    name: '20260911_090442_users_consents',
  },
  {
    up: migration_20260911_093339_legal_refund_kind.up,
    down: migration_20260911_093339_legal_refund_kind.down,
    name: '20260911_093339_legal_refund_kind'
  },
];
