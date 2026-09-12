import * as migration_20260911_042835_baseline from './20260911_042835_baseline';
import * as migration_20260911_052437_storage_prefix from './20260911_052437_storage_prefix';
import * as migration_20260911_081755_inquiry_country from './20260911_081755_inquiry_country';
import * as migration_20260911_090442_users_consents from './20260911_090442_users_consents';
import * as migration_20260911_093339_legal_refund_kind from './20260911_093339_legal_refund_kind';
import * as migration_20260911_103148_admin_invites from './20260911_103148_admin_invites';
import * as migration_20260911_110128_band_images from './20260911_110128_band_images';
import * as migration_20260911_110443_chat from './20260911_110443_chat';
import * as migration_20260911_111245_schema_sync_q37 from './20260911_111245_schema_sync_q37';
import * as migration_20260911_232040_guest_chat from './20260911_232040_guest_chat';
import * as migration_20260912_055606_band_focus from './20260912_055606_band_focus';

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
    name: '20260911_093339_legal_refund_kind',
  },
  {
    up: migration_20260911_103148_admin_invites.up,
    down: migration_20260911_103148_admin_invites.down,
    name: '20260911_103148_admin_invites',
  },
  {
    up: migration_20260911_110128_band_images.up,
    down: migration_20260911_110128_band_images.down,
    name: '20260911_110128_band_images',
  },
  {
    up: migration_20260911_110443_chat.up,
    down: migration_20260911_110443_chat.down,
    name: '20260911_110443_chat',
  },
  {
    up: migration_20260911_111245_schema_sync_q37.up,
    down: migration_20260911_111245_schema_sync_q37.down,
    name: '20260911_111245_schema_sync_q37',
  },
  {
    up: migration_20260911_232040_guest_chat.up,
    down: migration_20260911_232040_guest_chat.down,
    name: '20260911_232040_guest_chat',
  },
  {
    up: migration_20260912_055606_band_focus.up,
    down: migration_20260912_055606_band_focus.down,
    name: '20260912_055606_band_focus'
  },
];
