import { useEffect, useState } from "react";
import * as api from "./api";
import type { ApiUser } from "./api";

// A fiókok listája futás közben alig változik, ezért oldalbetöltésenként egy
// lekérés (modulszinten gyorsítótárazva) elég minden megjelenített névhez.
let cache: Map<string, ApiUser> | null = null;
let inflight: Promise<Map<string, ApiUser>> | null = null;

function load(): Promise<Map<string, ApiUser>> {
  if (cache) return Promise.resolve(cache);
  inflight ??= api
    .listUsers()
    .then(({ users }) => {
      cache = new Map(users.map((user) => [user.id, user]));
      return cache;
    })
    .catch(() => {
      inflight = null;
      return new Map<string, ApiUser>();
    });
  return inflight;
}

/** Azonosító → fiók; amíg nem érkezik meg a lista, üres. */
export function useUsers(): Map<string, ApiUser> {
  const [users, setUsers] = useState<Map<string, ApiUser>>(cache ?? new Map());
  useEffect(() => {
    let cancelled = false;
    load().then((map) => {
      if (!cancelled) setUsers(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return users;
}
