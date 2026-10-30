import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Post } from "../../shared/pnw/types";
import { PageTemplate } from "../components";
import PostArticle from "../components/news/PostArticle";
import { publicPost } from "../lib/api";
import { useLang } from "../i18n/languageContext";
import { useDocumentHead } from "../lib/useDocumentHead";

/** /hirek/:slug - public page of a post published from the Hírkezelő (GET /api/public/posts/:slug). */
export default function PublishedPost({ slug: fixedSlug }: { slug?: string }) {
  const { tr } = useLang();
  const params = useParams<{ slug: string }>();
  const slug = fixedSlug ?? params.slug ?? "";
  // The loaded post is kept together with its own slug, so it does not need a separate reset when the slug changes.
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
