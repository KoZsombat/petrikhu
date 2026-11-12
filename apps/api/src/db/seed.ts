/**
 * Idempotent seed: the previous site's content, snapshotted into `apps/api/seed`.
 * - teachers.json (88): the teaching staff page.
 * - documents.json: the document library categories/files.
 * - posts.json (584): the WordPress posts, including legacy HTML.
 * - Legacy uploads referenced by that content are imported into `media` and rewritten to local URLs.
 *
 * Tables are populated only when empty, so a migrated/edited database is never overwritten. Media import is
 * idempotent and also backfills databases that were seeded before it existed.
 */
import { count, eq } from "drizzle-orm";
import documentsSeed from "../../seed/documents.json";
import postsSeed from "../../seed/posts.json";
import teachersSeed from "../../seed/teachers.json";
import { auth } from "../auth";
import { env } from "../env";
import { user } from "./auth-schema";
import { client, db } from "./index";
import { documentCategories, documents, postCategories, posts, teachers } from "./schema";
import { seedMedia, seedTeacherPhotos } from "./seed-media";
import { seedLegacyGalleries } from "./seed-galleries";

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const slugifyCategory = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "category";

async function seedPostCategories() {
  const [{ total }] = await db.select({ total: count() }).from(postCategories);
  if (total > 0) {
    console.log("Post categories already seeded.");
    return;
  }

  const counts = new Map<string, number>();
  for (const post of postsSeed) {
    const title = post.category?.trim() || "Hírek";
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  const used = new Set<string>();
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "hu"))
    .map(([title], index) => {
      const base = slugifyCategory(title);
      let slug = base;
      let suffix = 2;
      while (used.has(slug)) slug = `${base}-${suffix++}`;
      used.add(slug);
      return {
        id: slug,
        slug,
        title,
        sortOrder: index,
      };
    });

  await db.insert(postCategories).values(rows);
  console.log(`Seeded ${rows.length} post categories.`);
}

async function seedTeachers() {
  const [{ total }] = await db.select({ total: count() }).from(teachers);
  if (total > 0) {
    console.log("Teachers already seeded.");
    return;
  }

  await db.insert(teachers).values(
    teachersSeed.map((teacher, index) => ({
      name: teacher.name,
      role: teacher.role,
      email: teacher.email,
      room: teacher.room,
      photo: teacher.photo,
      sortOrder: index,
    })),
  );
  console.log(`Seeded ${teachersSeed.length} teachers.`);
}

async function seedDocuments() {
  const [{ total }] = await db
    .select({ total: count() })
    .from(documentCategories);

  if (total === 0) {
    await db.insert(documentCategories).values(
      documentsSeed.categories.map((category, index) => ({
        id: category.slug,
        slug: category.slug,
        title: category.title,
        sortOrder: index,
      })),
    );
  }

  const [{ total: documentTotal }] = await db
    .select({ total: count() })
    .from(documents);

  if (documentTotal > 0) {
    console.log("Documents already seeded.");
    return;
  }

  const rows = documentsSeed.categories.flatMap((category) =>
    category.docs.map((document, index) => ({
      categoryId: category.slug,
      slug: document.slug,
      title: document.title,
      file: document.file ?? null,
      protected: !document.file,
      sortOrder: index,
    })),
  );

  for (const batch of chunk(rows, 100)) {
    await db.insert(documents).values(batch);
  }
  console.log(`Seeded ${rows.length} documents.`);
}

async function seedPosts() {
  const [{ total }] = await db.select({ total: count() }).from(posts);
  if (total > 0) {
    console.log("Posts already seeded.");
    return;
  }

  const rows = postsSeed.map((post) => ({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    contentHtml: post.contentHtml,
    category: post.category,
    image: post.image,
    published: true,
    status: "published" as const,
    createdAt: new Date(post.publishedAt),
    updatedAt: new Date(post.updatedAt),
  }));

  for (const batch of chunk(rows, 40)) {
    await db.insert(posts).values(batch);
  }
  console.log(`Seeded ${rows.length} posts.`);
}

async function seedAdmin() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  const context = await auth.$context;

  if (!existing) {
    const created = await auth.api.signUpEmail({
      body: {
        email,
        password: env.ADMIN_PASSWORD,
        name: "Adminisztrátor",
      },
    });

    await context.internalAdapter.updateUser(created.user.id, { role: "admin" });
    console.log(`Seeded admin account: ${email}`);
    return;
  }

  await context.internalAdapter.updateUser(existing.id, { role: "admin" });

  if (env.ADMIN_RESET_PASSWORD) {
    await context.internalAdapter.updatePassword(existing.id, env.ADMIN_PASSWORD);
    console.log(`Admin password reset: ${email}`);
  } else {
    console.log(`Admin account ready: ${email}`);
  }
}

await seedTeachers();
await seedDocuments();
await seedPostCategories();
await seedPosts();
await seedTeacherPhotos();
await seedMedia();
await seedLegacyGalleries();
await seedAdmin();

await client.end();
