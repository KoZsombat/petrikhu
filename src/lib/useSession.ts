import { useCallback, useEffect, useState } from "react";
import * as api from "./api";
import type { ApiUser } from "./api";

/** The logged-in user, based on the server cookie (server/middleware/auth.ts). */
export function useSession() {
  const [user, setUser] = useState<ApiUser | null>(null);
  // True until the first GET /api/auth/me response arrives.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(({ user }) => !cancelled && setUser(user))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    setUser((await api.login(loginValue, password)).user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
