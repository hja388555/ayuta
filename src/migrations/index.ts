import * as migration_20260911_042835_baseline from './20260911_042835_baseline';
import * as migration_20260911_052437_storage_prefix from './20260911_052437_storage_prefix';
import * as migration_20260911_081755_inquiry_country from './20260911_081755_inquiry_country';

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
    name: '20260911_081755_inquiry_country'
  },
];
