import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Post } from "../../shared/pnw/types";
import { PageTemplate } from "../components";
import PostArticle from "../components/news/PostArticle";
import { getPost } from "../lib/api";

/**
 * /hirkezelo/elonezet/:id - a még nem publikus hír mentett változata úgy, ahogy
 * jóváhagyás után megjelenik. Új lapon nyílik, belépést kér (GET /api/posts/:id
 * ellenőrzi, ki láthatja), és nincs indexelve.
 */
export default function PostPreviewPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<{ id: string; post: Post | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPost(id)
      .then(({ post }) => {
        if (cancelled) return;
        setLoaded({ id, post });
        document.title = `Előnézet: ${post.title} | petrik.hu`;
        let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
        if (!robots) {
          robots = document.createElement("meta");
          robots.name = "robots";
          document.head.appendChild(robots);
        }
        robots.content = "noindex, nofollow";
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id, post: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = loaded?.id === id ? loaded : null;
  const post = current?.post;

  return (
    <PageTemplate>
      {post ? (
        <>
          <div className="bg-amber-100 px-5 py-3 text-center text-sm text-amber-900">
            Előnézet - ez a hír még nem publikus. Így fog megjelenni, ha jóváhagyják (a legutóbb mentett változat).
          </div>
          <PostArticle
            title={post.title}
            content={post.content}
            categoryIds={post.categoryIds}
            image={post.featuredImage}
            imagePosition={post.imagePosition}
            date={post.date}
          />
        </>
      ) : current ? (
        <div className="mx-auto max-w-3xl px-4 py-24">
          <h1 className="font-display text-3xl font-semibold">Az oldal nem található</h1>
          <p className="mt-3 text-sm text-petriksoft">
            Az előnézethez be kell jelentkezned a <Link to="/hirkezelo" className="underline">Hírkezelőbe</Link>, és a hírhez hozzáférésed kell legyen.
          </p>
        </div>
      ) : null}
    </PageTemplate>
  );
}
