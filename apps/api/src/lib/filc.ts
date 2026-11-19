/**
 * Room counts from the filc Chronos API (the kiosk/navigator backend).
 * The kiosk groups rooms by `classroomTypes`; we count the two teaching types the
 * public stat strip shows. Cached in-process so the homepage never waits on filc
 * for more than the first request per TTL, and a stale cache survives an outage.
 */
const FILC_API_URL = (
  process.env.FILC_API_URL ?? "https://filc.petrik.hu/api"
).replace(/\/+$/, "");

const CACHE_TTL_MS = 10 * 60 * 1000;

type Room = { type_id: string | null };
type RoomType = { id: string; name: string };

export interface FilcRoomCounts {
  classrooms: number;
  labs: number;
}

let cache: { counts: FilcRoomCounts; fetchedAt: number } | null = null;

/** oRPC RPC returns `{ json: { items } }` for these list procedures. */
const list = async <T>(procedure: string): Promise<T[]> => {
  const response = await fetch(`${FILC_API_URL}/rpc/${procedure}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(4_000),
  });

  if (!response.ok) {
    throw new Error(`filc ${procedure}: ${response.status}`);
  }

  const body = (await response.json()) as { json?: { items?: T[] } };
  return body.json?.items ?? [];
};

const countByType = (rooms: Room[], types: RoomType[]): FilcRoomCounts => {
  const idsByName = new Map(
    types.map((type) => [type.name.trim().toLowerCase(), type.id]),
  );
  const classroomType = idsByName.get("tanterem");
  const labType = idsByName.get("laboratórium");

  return {
    classrooms: classroomType
      ? rooms.filter((room) => room.type_id === classroomType).length
      : 0,
    labs: labType ? rooms.filter((room) => room.type_id === labType).length : 0,
  };
};

/**
 * Returns the current counts, the last successful snapshot when filc fails, or
 * null when filc has never answered.
 */
export async function getFilcRoomCounts(): Promise<FilcRoomCounts | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.counts;
  }

  try {
    const [rooms, types] = await Promise.all([
      list<Room>("navigator/classrooms/list"),
      list<RoomType>("navigator/classroomTypes/list"),
    ]);
    const counts = countByType(rooms, types);
    cache = { counts, fetchedAt: Date.now() };
    return counts;
  } catch {
    return cache?.counts ?? null;
  }
}
