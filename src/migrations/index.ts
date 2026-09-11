import * as migration_20260911_042835_baseline from './20260911_042835_baseline';

export const migrations = [
  {
    up: migration_20260911_042835_baseline.up,
    down: migration_20260911_042835_baseline.down,
    name: '20260911_042835_baseline'
  },
];
