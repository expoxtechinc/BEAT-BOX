import { useEffect } from "react";

const SITE_URL = "https://sastechorg-beatbox.vercel.app";
const DEFAULT_IMAGE =
  "https://sastechorg-beatbox.vercel.app/manus-storage/beatbox-social-and-store-artwork_7f0b0a2a.png";

export type PageMetaOptions = {
  canonicalPath?: string;
  noindex?: boolean;
  type?: "website" | "article" | "profile" | "music.song" | "video.movie";
  image?: string;
  structuredData?: Record<string, unknown>;
};

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value));
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function removeStructuredData() {
  document.head.querySelector('script[data-beatbox-structured-data="true"]')?.remove();
}

export function usePageMeta(
  title: string,
  description: string,
  options: PageMetaOptions = {},
) {
  useEffect(() => {
    const pathname = window.location.pathname;
    const privateRoute = /^\/(admin|seller|account|cart|favorites|auth(?:\/|$)|studio|ai)(?:\/|$)/.test(pathname);
    const noindex = options.noindex ?? privateRoute;
    const canonicalPath = options.canonicalPath ?? pathname;
    const canonicalUrl = `${SITE_URL}${canonicalPath === "/" ? "/" : canonicalPath}`;
    const image = options.image ?? DEFAULT_IMAGE;

    document.title = `${title} | BeatBox`;
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex,nofollow,noarchive" : "index,follow,max-image-preview:large",
    });
    upsertLink("canonical", canonicalUrl);

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: `${title} | BeatBox` });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: options.type ?? "website" });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "BeatBox" });
    upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_LR" });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: `${title} | BeatBox` });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

    removeStructuredData();
    if (!noindex) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.beatboxStructuredData = "true";
      script.textContent = JSON.stringify(
        options.structuredData ?? {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${title} | BeatBox`,
          description,
          url: canonicalUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "BeatBox",
            url: SITE_URL,
          },
        },
      );
      document.head.appendChild(script);
    }
  }, [description, options, title]);
}
