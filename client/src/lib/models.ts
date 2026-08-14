export type UserRole = "buyer" | "seller" | "admin";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  email: string | null;
  country: string | null;
  city?: string | null;
  website_url?: string | null;
  profession?: string | null;
  education?: string | null;
  interests?: string | null;
  cover_url?: string | null;
  social_links?: Record<string, string> | null;
  privacy_settings?: Record<string, boolean> | null;
  contact_preferences?: Record<string, boolean> | null;
  whatsapp_number?: string | null;
  whatsapp_public?: boolean | null;
  role: UserRole | null;
  account_status: "active" | "suspended" | "banned" | null;
  professional_mode?: boolean | null;
};

export type Beat = {
  id: string;
  seller_id: string;
  title: string;
  slug: string;
  description: string | null;
  producer: string | null;
  genre: string | null;
  subgenre: string | null;
  bpm: number | null;
  musical_key: string | null;
  mood: string | null;
  cover_image_url: string | null;
  preview_url: string | null;
  master_url: string | null;
  price: number | null;
  is_free: boolean | null;
  license_info: string | null;
  status: "draft" | "published" | "archived" | "removed" | null;
  play_count: number | null;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  favorite_count: number | null;
  download_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  cover_url?: string | null;
  preview_signed_url?: string | null;
};

export type BeatLicense = {
  id: string;
  beat_id: string;
  license_code: "basic" | "premium" | "exclusive";
  name: string;
  price: number;
  terms: string | null;
  is_available: boolean;
};

export type Category = { id: string; name: string; slug: string };

export type ContentType = "audio" | "video" | "movie" | "software" | "app" | "digital_product" | "plugin" | "soundboard" | "soundtrack" | "loop" | "sample_pack" | "engineering_file";
export type AccessMode = "free_download" | "paid_download" | "stream_only";

export type ContentItem = {
  id: string;
  seller_id: string;
  title: string;
  slug: string;
  description: string | null;
  content_type: ContentType;
  cover_path: string | null;
  preview_path: string | null;
  original_path: string;
  price: number;
  currency: string;
  access_mode: AccessMode;
  download_enabled: boolean;
  genre: string | null;
  tags: string[];
  status: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  download_count: number;
  created_at: string;
};

export type SocialPost = {
  id: string;
  author_id: string;
  body: string | null;
  content_id: string | null;
  media_path: string | null;
  media_type: "image" | "audio" | "video" | null;
  media_gallery?: Array<{ path: string; type: "image" | "audio" | "video" }> | null;
  link_url: string | null;
  status: string;
  audience?: "public" | "friends" | "only_me" | null;
  thumbnail_path?: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null; username?: string | null; professional_mode?: boolean | null } | null;
};

export type Product = {
  id: string;
  seller_id: string;
  product_type: "physical" | "digital" | "service";
  title: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number | null;
  location: string | null;
  delivery_information: string | null;
  file_path: string | null;
  status: string;
  created_at: string;
};

export type SellerEarning = {
  order_id: string;
  seller_id: string;
  beat_id: string;
  amount: number;
  platform_fee_amount: number;
  seller_amount: number;
  currency: string;
  status: string;
  verified_at: string | null;
  created_at: string;
};
