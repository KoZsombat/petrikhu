import type { Role } from "./middleware/auth";

/**
 * Every action that can be granted. Permission keys are stable API surface: keep them when
 * renaming labels, and add new keys rather than reusing old ones.
 */
export const PERMISSION_CATALOG = [
  { key: "dashboard.view", label: "Áttekintés megtekintése", group: "Áttekintés" },
  { key: "posts.view", label: "Hírek listázása (piszkozatok is)", group: "Hírek" },
  { key: "posts.create", label: "Hír létrehozása", group: "Hírek" },
  { key: "posts.update", label: "Hír szerkesztése", group: "Hírek" },
  { key: "posts.delete", label: "Hír törlése", group: "Hírek" },
  { key: "posts.submit", label: "Hír beküldése jóváhagyásra", group: "Hírek" },
  { key: "posts.review", label: "Hír jóváhagyása / elutasítása", group: "Hírek" },
  { key: "posts.publish", label: "Hír publikálása", group: "Hírek" },
  { key: "media.view", label: "Médiatár megtekintése", group: "Média" },
  { key: "media.upload", label: "Kép feltöltése", group: "Média" },
  { key: "media.delete", label: "Kép törlése", group: "Média" },
  { key: "teachers.view", label: "Tanárok listázása (rejtettek is)", group: "Tanárok" },
  { key: "teachers.manage", label: "Tanárok kezelése", group: "Tanárok" },
  { key: "documents.view", label: "Dokumentumok listázása", group: "Dokumentumok" },
  { key: "documents.manage", label: "Dokumentumok és kategóriák kezelése", group: "Dokumentumok" },
  { key: "users.view", label: "Felhasználók megtekintése", group: "Felhasználók" },
  { key: "users.manage", label: "Felhasználók létrehozása, szerkesztése, törlése", group: "Felhasználók" },
  { key: "users.permissions", label: "További jogosultságok adása", group: "Felhasználók" },
] as const;

export type Permission = (typeof PERMISSION_CATALOG)[number]["key"];
export type PermissionInfo = (typeof PERMISSION_CATALOG)[number];

export const ALL_PERMISSIONS = PERMISSION_CATALOG.map((entry) => entry.key);

const ALL = ALL_PERMISSIONS as Permission[];

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

export const isPermission = (value: string): value is Permission => PERMISSION_SET.has(value);

export const effectivePermissions = (
  role: Role,
  extra: readonly string[] = [],
): Set<Permission> => {
  if (role === "admin") return new Set<Permission>(ALL_PERMISSIONS as Permission[]);

  const permissions = new Set<Permission>();
  for (const value of extra) {
    if (isPermission(value)) permissions.add(value);
  }
  return permissions;
};
