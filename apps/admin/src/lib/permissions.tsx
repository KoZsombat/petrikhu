import { createContext, useContext } from "react";

/** Effective permission keys for the signed-in user, loaded once by ProtectedLayout. */
export const PermissionsContext = createContext<ReadonlySet<string>>(new Set());

export const usePermissions = () => useContext(PermissionsContext);

export const can = (permissions: ReadonlySet<string>, key: string) =>
  permissions.has(key);
