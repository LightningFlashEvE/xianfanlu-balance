import realmsInitial from "./realms.initial.json";

export const realmNames = realmsInitial.map((r) => r.name) as [
  string,
  ...string[],
];

export type RealmName = (typeof realmNames)[number];

export const realmNameSchema = realmNames;

const realmNameSet = new Set<string>(realmNames);

const legacyMaxRealmToName: Record<string, RealmName> = {
  未设定: "普通凡人",
  炼气三层: "炼气初期",
  炼气六层: "炼气中期",
  炼气九层: "炼气后期",
  炼气圆满: "炼气后期",
};

for (const name of realmNames) {
  legacyMaxRealmToName[name] = name as RealmName;
}

export function migrateLegacyMaxRealm(old: string): RealmName {
  const trimmed = old.trim();
  if (!trimmed) return "普通凡人";
  if (legacyMaxRealmToName[trimmed]) return legacyMaxRealmToName[trimmed]!;
  if (realmNameSet.has(trimmed)) return trimmed as RealmName;
  return "普通凡人";
}

export function isRealmName(value: string): value is RealmName {
  return realmNameSet.has(value);
}
