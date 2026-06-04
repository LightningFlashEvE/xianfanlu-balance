import equipmentLibrary from "./equipment.library.json";
import manualsLibrary from "./manuals.library.json";
import realmsInitial from "./realms.initial.json";
import heroDefaults from "./hero.defaults.json";
import meta from "./meta.json";
export { statFields, aptitudeFields } from "./hero-meta";
export {
  itemQualityTiers,
  itemQualityIdSchema,
  migrateLegacyItemQuality,
  isItemQualityId,
  type ItemQualityId,
} from "./item-quality";
export {
  realmNames,
  realmNameSchema,
  migrateLegacyMaxRealm,
  isRealmName,
  type RealmName,
} from "./realm-names";
export {
  equipmentSlotOptions,
  equipmentSlotSchema,
  weaponKindOptions,
  weaponCategoriesByKind,
  getWeaponKind,
  getWeaponCategoryOptions,
  migrateLegacyWeaponCategory,
  equipmentCategoriesBySlot,
  equipmentTaxonomyGroups,
  getEquipmentDomain,
  getEquipmentDomainLabel,
  getEquipmentCategoryOptions,
  normalizeEquipmentSlot,
  normalizeEquipmentCategory,
  isEquipmentSlot,
  equipmentTypeCatalog,
  encodeEquipmentTypeKey,
  decodeEquipmentTypeKey,
  getEquipmentTypesForDomain,
  findEquipmentTypeOption,
  formatEquipmentTypeLabel,
  getDefaultEquipmentTypeForDomain,
  type EquipmentSlot,
  type EquipmentDomain,
  type EquipmentTypeOption,
  type WeaponKindId,
} from "./item-taxonomy";
export {
  sandboxEnemyPresetDefs,
  type SandboxEnemyPresetDef,
} from "./sandbox-enemy-presets";
export {
  balanceRealmBands,
  balanceRealmBandIdSchema,
  buildBalanceBandOrderMap,
  mapRealmNameToBalanceBand,
  migrateLegacyBalanceRealm,
  isBalanceRealmBandId,
  type BalanceRealmBandId,
} from "./balance-realm-bands";
export {
  fiveElements,
  spiritualRootCountOptions,
  formatSpiritualRootLabel,
  normalizeSpiritualRootElements,
  buildAptitudeSpiritualRoot,
  defaultSpiritualRootElements,
  getSpiritualRootCountMultiplier,
  type FiveElement,
} from "./spiritual-root";
import type { EquipmentDef } from "../schemas/equipment";
import type { ManualDef } from "../schemas/manual";
import type { Realm } from "../schemas/realm";
import type { Aptitude, HeroStats } from "../schemas/hero";

export const data = {
  realmsInitial: realmsInitial as Realm[],
  equipmentLibrary: equipmentLibrary as EquipmentDef[],
  manualsLibrary: manualsLibrary as ManualDef[],
  heroDefaults: heroDefaults as {
    stats: HeroStats;
    aptitude: Aptitude;
    combatMultiplier: number;
    baseBagCapacity: number;
  },
  meta,
};

export {
  equipmentLibrary,
  manualsLibrary,
  realmsInitial,
  heroDefaults,
  meta,
};
