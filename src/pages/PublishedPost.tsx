import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Post } from "../../shared/pnw/types";
import { PageTemplate } from "../components";
import PostArticle from "../components/news/PostArticle";
import { publicPost } from "../lib/api";
import { useLang } from "../i18n/languageContext";
import { useDocumentHead } from "../lib/useDocumentHead";

/** /hirek/:slug - a Hírkezelőből kiadott hír nyilvános oldala (GET /api/public/posts/:slug). */
export default function PublishedPost({ slug: fixedSlug }: { slug?: string }) {
  const { tr } = useLang();
  const params = useParams<{ slug: string }>();
  const slug = fixedSlug ?? params.slug ?? "";
  // A betöltött hír a saját slugjával együtt él, így slugváltáskor nem kell külön nullázni.
  const [loaded, setLoaded] = useState<{ slug: string; post: Post | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicPost(slug)
      .then(({ post }) => {
        if (cancelled) return;
        setLoaded({ slug, post });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ slug, post: null });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const current = loaded?.slug === slug ? loaded : null;
  const post = current?.post;
  useDocumentHead({ title: post ? post.title : current ? tr("Az oldal nem található") : undefined });

  return (
    <PageTemplate>
      {post ? (
        <PostArticle
          title={post.title}
          content={post.content}
          categoryIds={post.categoryIds}
          image={post.featuredImage}
          imagePosition={post.imagePosition}
          date={post.date}
        />
      ) : current ? (
        <div className="mx-auto max-w-3xl px-4 py-24">
          <h1 className="font-display text-3xl font-semibold">{tr("Az oldal nem található")}</h1>
          <Link to="/" className="mt-6 inline-block underline">
            {tr("Vissza a kezdőlapra")}
          </Link>
        </div>
      ) : null}
    </PageTemplate>
  );
}
