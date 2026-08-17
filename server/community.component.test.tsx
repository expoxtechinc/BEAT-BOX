// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const authState = { user: null as { id: string } | null, profile: null as { display_name: string } | null, loading: false };
  const state = { socialPosts: { data: [] as unknown[], error: null as Error | null, pending: false }, likes: { data: [] as unknown[], error: null as Error | null }, bookmarks: { data: [] as unknown[], error: null as Error | null }, follows: { data: [] as unknown[], error: null as Error | null }, search: { data: [] as unknown[], error: null as Error | null, pending: false }, discovery: { data: [] as unknown[], error: null as Error | null, pending: false }, likeInsertError: null as Error | null };
  const queryFor = (table: string) => {
    const response = table === "social_posts" ? state.socialPosts : table === "social_post_likes" ? state.likes : table === "social_post_bookmarks" ? state.bookmarks : table === "content_items" ? state.discovery : table === "profiles" ? state.search : state.follows;
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "range", "limit", "ilike", "or", "in"]) chain[method] = vi.fn(() => chain);
    chain.then = (resolve: (value: unknown) => unknown) => (table === "social_posts" && state.socialPosts.pending) || (table === "content_items" && state.discovery.pending) || ((table === "profiles" || table === "social_posts") && state.search.pending) ? new Promise(() => {}) : Promise.resolve(response).then(resolve);
    chain.insert = vi.fn(() => Promise.resolve({ error: table === "social_post_likes" ? state.likeInsertError : null }));
    chain.delete = vi.fn(() => chain);
    return chain;
  };
  const storageBucket = { getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://media.example/${path}` } })) };
  const supabaseMock = { from: vi.fn((table: string) => queryFor(table)), storage: { from: vi.fn(() => storageBucket) } };
  return { authState, state, supabaseMock };
});
const { authState, state, supabaseMock } = mocks;
vi.mock("@/contexts/SupabaseAuthContext", () => ({ useSupabaseAuth: () => mocks.authState }));
vi.mock("@/lib/supabase", () => ({ supabase: mocks.supabaseMock }));

import Community from "@/pages/Community";

const publishedPost = { id: "post-1", author_id: "creator-1", body: "New movie announcement", content_id: "movie-1", media_path: null, media_type: null, link_url: null, status: "published", like_count: 0, comment_count: 0, share_count: 0, created_at: "2026-08-12T00:00:00.000Z", profiles: { display_name: "Creator", avatar_url: null } };

afterEach(() => cleanup());

beforeEach(() => {
  authState.user = null;
  authState.profile = null;
  state.socialPosts = { data: [], error: null, pending: false };
  state.likes = { data: [], error: null };
  state.bookmarks = { data: [], error: null };
  state.follows = { data: [], error: null }; state.search = { data: [], error: null, pending: false }; state.discovery = { data: [], error: null, pending: false };
  state.likeInsertError = null;
  vi.clearAllMocks();
});

describe("Community Feed component", () => {
  it("shows an explicit initial loading state", () => {
    state.socialPosts = { data: [], error: null, pending: true };
    render(<Community />);
    expect(screen.getByText("Loading the BeatBox Feed…")).toBeTruthy();
  });

  it("shows a retryable error instead of silently rendering an empty feed", async () => {
    state.socialPosts = { data: [], error: new Error("Feed unavailable"), pending: false };
    render(<Community />);
    expect((await screen.findByRole("alert")).textContent).toContain("Feed unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("renders published content references without exposing private media", async () => {
    state.socialPosts = { data: [publishedPost], error: null, pending: false };
    render(<Community />);
    expect(await screen.findByText("New movie announcement")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View attached creator content" }).getAttribute("href")).toBe("/catalog?content=movie-1");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("audio")).toBeNull();
    expect(screen.queryByRole("video")).toBeNull();
  });

  it("shows discovery success, empty, and error states", async () => { state.discovery.data = [{ id: "movie-1", title: "Liberia Nights", content_type: "movie", description: "A published film", slug: "liberia-nights" }]; render(<Community />); expect(await screen.findByText("Published movie release")).toBeTruthy(); expect(screen.getByText("Watch details")).toBeTruthy(); cleanup(); state.discovery.data = []; render(<Community />); expect(await screen.findByText("Published creator drops will appear here.")).toBeTruthy(); cleanup(); state.discovery.error = new Error("Discovery down"); render(<Community />); expect(await screen.findByText("Discovery is temporarily unavailable.")).toBeTruthy(); });

  it("renders distinct safe discovery labels for beat, product, app, and movie content", async () => { state.discovery.data = [{ id: "beat-1", title: "Beat", content_type: "audio", description: null, slug: "beat" }, { id: "product-1", title: "Product", content_type: "digital_product", description: null, slug: "product" }, { id: "app-1", title: "App", content_type: "app", description: null, slug: "app" }, { id: "movie-1", title: "Movie", content_type: "movie", description: null, slug: "movie" }]; render(<Community />); expect(await screen.findByText("Published beat release")).toBeTruthy(); expect(screen.getByText("Published digital product")).toBeTruthy(); expect(screen.getByText("Published app release")).toBeTruthy(); expect(screen.getByText("Published movie release")).toBeTruthy(); });

  it("renders attached Feed references with per-type copy, marks, and safe catalog links", async () => { const cases = [{ type: "audio", id: "beat-1", copy: "Published beat release", action: "View beat", mark: "BEAT" }, { type: "digital_product", id: "product-1", copy: "Published digital product", action: "View product", mark: "SHOP" }, { type: "app", id: "app-1", copy: "Published app release", action: "View app", mark: "APP" }, { type: "movie", id: "movie-1", copy: "Published movie release", action: "Watch details", mark: "FILM" }]; for (const item of cases) { state.discovery.data = [{ id: item.id, title: `${item.type} title`, content_type: item.type, description: null, slug: item.type }]; state.socialPosts = { data: [{ ...publishedPost, id: `post-${item.type}`, content_id: item.id }], error: null, pending: false }; render(<Community />); expect(await screen.findByText(item.copy)).toBeTruthy(); const card = document.querySelector(`.community-post .feed-content-card[data-content-type="${item.type}"]`) as HTMLElement | null; expect(card).toBeTruthy(); expect(within(card as HTMLElement).getByText(item.action)).toBeTruthy(); expect(within(card as HTMLElement).getByText(item.mark)).toBeTruthy(); expect(card?.getAttribute("data-content-type")).toBe(item.type); expect(card?.querySelector("a")?.getAttribute("href")).toBe(`/catalog?content=${item.id}`); cleanup(); } });

  it("shows the visible autocomplete Searching state during an in-flight query", async () => { state.search.pending = true; render(<Community />); fireEvent.change(screen.getByLabelText("Search marketplace beats"), { target: { value: "beat" } }); expect(await screen.findByText("Searching…")).toBeTruthy(); });

  it("shows an explicit empty state for a search with no public matches", async () => { render(<Community />); fireEvent.change(screen.getByLabelText("Search marketplace beats"), { target: { value: "zz-no-match" } }); expect(await screen.findByText("No matching creators, posts, or published marketplace items.")).toBeTruthy(); });

  it("shows a visible search error when public discovery queries fail", async () => { state.search.error = new Error("Search unavailable"); render(<Community />); fireEvent.change(screen.getByLabelText("Search marketplace beats"), { target: { value: "beat" } }); expect(await screen.findByText("Search unavailable")).toBeTruthy(); });

  it("persists a signed-in like interaction through Supabase", async () => {
    authState.user = { id: "buyer-1" };
    authState.profile = { display_name: "Buyer" };
    state.socialPosts = { data: [publishedPost], error: null, pending: false };
    render(<Community />);
    await screen.findByText("New movie announcement");
    const article = screen.getByText("New movie announcement").closest("article");
    expect(article).toBeTruthy();
    const actionBar = article?.querySelector(".community-post__actions");
    expect(actionBar).toBeTruthy();
    const likeButton = within(actionBar as HTMLElement).getAllByRole("button")[0];
    fireEvent.click(likeButton);
    await waitFor(() => expect(supabaseMock.from).toHaveBeenCalledWith("social_post_likes"));
  });

  it("presents public image, video, and audio attachments with visible media and inline engagement controls", async () => {
    state.socialPosts = {
      data: [{
        ...publishedPost,
        id: "media-post",
        body: "Liberia sound check",
        content_id: null,
        media_gallery: [
          { path: "photos/community.jpg", type: "image" },
          { path: "videos/session.mp4", type: "video" },
          { path: "audio/session.mp3", type: "audio" },
        ],
      }],
      error: null,
      pending: false,
    };
    render(<Community />);
    expect((await screen.findAllByText("Liberia sound check")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Open community image" })).toBeTruthy();
    expect(screen.getByText("Photo · Tap to expand")).toBeTruthy();
    expect(screen.getByText("Play public video")).toBeTruthy();
    expect(screen.getByText("Audio update")).toBeTruthy();
    expect(screen.getByLabelText("Play full stream for Liberia sound check")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open comments" }));
    expect(await screen.findByLabelText("Comments")).toBeTruthy();
    expect(await screen.findByText("No comments yet. Start the conversation.")).toBeTruthy();
  });
});
