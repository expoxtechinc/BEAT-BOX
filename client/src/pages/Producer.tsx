import { BeatCard } from "@/components/BeatCard";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadPublishedBeats } from "@/lib/marketplace";
import type { Beat } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, ExternalLink, Heart, Instagram, MapPin, MessageCircle, Music2, UserRound, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";

type ProducerInfo = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  country: string | null;
  producer_name: string | null;
  whatsapp: string | null;
  follower_count: number | null;
  instagram_url: string | null;
  youtube_url: string | null;
  soundcloud_url: string | null;
};

function safeExternalUrl(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function whatsappUrl(value: string | null | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function Producers() {
  usePageMeta("Producers", "Meet and browse the artists and producers publishing original music on BeatBox.");
  const [producers, setProducers] = useState<ProducerInfo[]>([]);
  useEffect(() => {
    supabase.rpc("get_public_sellers").then(({ data }) => setProducers((data ?? []) as ProducerInfo[]));
  }, []);
  return <section className="producer-page"><div className="container"><p className="eyebrow"><span /> BeatBox community</p><h1>Meet the producers.</h1><p className="producer-page__lede">Artists who publish original, licensable sounds with clear delivery and direct ownership.</p>{producers.length ? <div className="producer-grid">{producers.map(producer => <Link className="producer-card" key={producer.id} href={`/producers/${producer.id}`}><div className="producer-card__avatar">{producer.avatar_url ? <img src={producer.avatar_url} alt="" /> : <UserRound />}</div><div><h2>{producer.producer_name || producer.display_name || "BeatBox producer"}</h2><p>@{producer.username || "producer"} · {producer.country || "Liberia"}</p></div><span><Heart size={14} />{producer.follower_count || 0}</span></Link>)}</div> : <div className="empty-featured empty-featured--light"><Music2 size={34} /><h2>Producer profiles will appear here.</h2><p>Register as a seller to be part of the first BeatBox producer directory.</p><Link className="button" href="/seller">Become a seller</Link></div>}</div></section>;
}

export default function Producer() {
  const [, params] = useRoute("/producers/:id");
  const [, setLocation] = useLocation();
  const { user } = useSupabaseAuth();
  const [producer, setProducer] = useState<ProducerInfo | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<"content" | "about">("content");
  usePageMeta(producer?.producer_name || producer?.display_name || "Producer", producer?.bio || "Browse beats from a BeatBox producer.");

  useEffect(() => {
    if (!params?.id) return;
    Promise.all([supabase.rpc("get_public_sellers", { p_seller_id: params.id }).maybeSingle(), loadPublishedBeats()]).then(([profile, data]) => {
      setProducer((profile.data as ProducerInfo | null) ?? null);
      setBeats(data.filter(beat => beat.seller_id === params.id));
    });
  }, [params?.id]);

  const toggle = async () => {
    if (!user || !producer) return;
    if (following) {
      await supabase.from("producer_follows").delete().eq("follower_id", user.id).eq("producer_id", producer.id);
      setFollowing(false);
    } else {
      await supabase.from("producer_follows").insert({ follower_id: user.id, producer_id: producer.id });
      setFollowing(true);
    }
  };

  if (!producer) return <section className="status-page"><h1>Producer not found.</h1><Link href="/producers" className="button">Meet producers</Link></section>;
  const socials = [{ url: safeExternalUrl(producer.instagram_url), label: "Instagram", icon: <Instagram size={15} /> }, { url: safeExternalUrl(producer.youtube_url), label: "YouTube", icon: <Youtube size={15} /> }, { url: safeExternalUrl(producer.soundcloud_url), label: "SoundCloud", icon: <Music2 size={15} /> }, { url: whatsappUrl(producer.whatsapp), label: "WhatsApp", icon: <ExternalLink size={15} /> }].filter((social): social is typeof social & { url: string } => social.url !== null);
  const name = producer.producer_name || producer.display_name || "BeatBox producer";

  return <section className="producer-profile"><div className="container"><div className="producer-profile__cover" aria-hidden="true"><span>{name.slice(0, 1).toUpperCase()}</span></div><div className="producer-profile__hero"><div className="producer-profile__avatar">{producer.avatar_url ? <img src={producer.avatar_url} alt={`${name} profile`} /> : <UserRound />}</div><div><p className="eyebrow"><span /> Producer profile</p><h1>{name} <span className="verified-badge" title="This profile is an active BeatBox seller"><CheckCircle2 size={17} /> Verified seller</span></h1><p>@{producer.username || "producer"} · {producer.country || "Liberia"}</p><p className="producer-profile__bio">{producer.bio || "This producer has not added a bio yet."}</p></div><div className="producer-profile__actions"><strong><Heart size={15} />{producer.follower_count || 0} followers</strong>{user && user.id !== producer.id && <><button className="button button--small" onClick={() => setLocation(`/messages?to=${encodeURIComponent(producer.id)}`)} aria-label={`Message ${name}`}><MessageCircle size={15} /> Message</button><button className="button button--small" onClick={() => void toggle()}>{following ? "Following" : "Follow"}</button></>}</div></div><nav className="profile-tabs" aria-label="Producer profile sections"><button className={tab === "content" ? "is-active" : ""} onClick={() => setTab("content")}>Published content</button><button className={tab === "about" ? "is-active" : ""} onClick={() => setTab("about")}>About & links</button></nav>{tab === "about" ? <div className="producer-profile__about"><p className="eyebrow"><span /> About this creator</p><h2>{producer.bio ? "Creator note" : "A new BeatBox voice"}</h2><p>{producer.bio || "This producer is building a public catalog on BeatBox."}</p><p><MapPin size={15} /> {producer.country || "Liberia"}</p>{socials.length > 0 && <div className="producer-profile__socials">{socials.map(social => <a href={social.url} target="_blank" rel="noreferrer" key={social.label}>{social.icon}{social.label}</a>)}</div>}</div> : <><div className="section-heading"><div><p className="eyebrow"><span /> Catalog</p><h2>Available beats</h2></div><span>{beats.length} published</span></div>{beats.length ? <div className="beat-grid">{beats.map(beat => <BeatCard key={beat.id} beat={beat} />)}</div> : <div className="empty-featured empty-featured--light"><Music2 size={32} /><h2>No public beats yet.</h2></div>}</>}</div></section>;
}
