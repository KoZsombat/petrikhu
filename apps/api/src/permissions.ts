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

export const ROLES = ["admin", "editor", "reviewer", "author", "inactive"] as const;
export type Role = (typeof ROLES)[number];

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

export const isPermission = (value: string): value is Permission => PERMISSION_SET.has(value);

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

/**
 * Default permissions of each role. A user's effective permissions are these plus any extra
 * permissions granted directly to the account (`user_permissions`).
 *
 * `posts.review` only covers the approve/reject decision; approving publishes the post, which is
 * why the reviewer role also carries `posts.publish`.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ALL_PERMISSIONS as Permission[],
  editor: [
    "dashboard.view",
    "posts.view",
    "posts.create",
    "posts.update",
    "posts.delete",
    "posts.submit",
    "posts.review",
    "posts.publish",
    "media.view",
    "media.upload",
    "media.delete",
    "teachers.view",
    "teachers.manage",
    "documents.view",
    "documents.manage",
  ],
  reviewer: ["dashboard.view", "posts.view", "posts.review", "posts.publish"],
  author: [
    "dashboard.view",
    "posts.view",
    "posts.create",
    "posts.update",
    "posts.submit",
    "media.view",
    "media.upload",
  ],
  inactive: [],
};

export const effectivePermissions = (
  role: Role,
  extra: readonly string[] = [],
): Set<Permission> => {
  if (role === "admin") return new Set<Permission>(ALL_PERMISSIONS as Permission[]);

  const permissions = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const value of extra) {
    if (isPermission(value)) permissions.add(value);
  }
  return permissions;
};
