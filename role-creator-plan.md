# BeatBox Role and Creator Experience Plan

## Design principles

BeatBox will keep the existing `profiles.role` values for server compatibility and add a separate creator identity field rather than overloading the buyer/seller/admin authorization role. The new identity can be `listener`, `artist`, `producer`, `creator`, or a hybrid combination. Publishing authorization remains server-side and is derived from the authenticated profile, account status, and professional-mode state.

The role selector is an onboarding preference and capability request, not a fake verification system. It must never grant admin privileges, bypass RLS, expose private master files, or create invented followers, plays, ratings, or earnings.

## Role taxonomy

| Identity | Primary use | Publishing capabilities | Creator tools |
|---|---|---|---|
| Listener | Discover and save music | No publishing by default | Library, follows, comments, playlists where supported |
| Artist | Publish songs and releases | Audio releases, artwork, metadata, public/limited visibility | Artist profile, release shelves, followers, release analytics |
| Producer | Publish beats and production assets | Beats, loops, sample packs, soundboards, engineering assets | Marketplace listings, protected downloads, catalog analytics |
| Creator | Publish community and media content | Posts, audio/video media, podcasts, collections | Creator profile, content shelves, followers, audience analytics |
| Hybrid | Select multiple identities | Union of allowed capabilities, subject to account status and server checks | Unified creator studio with role-specific publishing choices |

Existing `buyer`, `seller`, and `admin` values remain authorization roles. A role-aware onboarding flow may call the existing seller-registration path when a producer or marketplace publisher needs seller access, but the client must not write privileged roles directly.

## Onboarding flow

1. After authentication, if no creator identity has been selected, show a dismissible role-choice step with Listener, Artist, Producer, Creator, and multi-role options.
2. Ask for display name, public handle, country/region, primary genre, short bio, and optional website/social links. Keep all fields editable from profile settings.
3. Save the identity through a protected server procedure or approved RLS-safe profile update. Do not persist secrets or private contact details as public profile content.
4. Show a role-specific next action: listen, publish a first release, open producer studio, or create a community post.
5. Allow later role changes and additions, but keep existing published content and permissions intact. Removing an identity must not delete content.

## Permission matrix

| Operation | Listener | Artist | Producer | Creator | Admin |
|---|---:|---:|---:|---:|---:|
| Guest/public playback | Yes | Yes | Yes | Yes | Yes |
| Save/follow/comment | Authenticated | Authenticated | Authenticated | Authenticated | Authenticated |
| Publish artist release | No | Yes | Optional | Optional | Yes |
| Publish beat/engineering asset | No | Optional | Yes | Optional | Yes |
| Publish community media | No | Optional | Optional | Yes | Yes |
| View own creator analytics | No | Yes | Yes | Yes | Yes |
| Moderate others’ content | No | No | No | No | Admin only |
| Issue/download master files | Existing entitlement rules | Existing entitlement rules | Existing entitlement rules | Existing entitlement rules | Existing entitlement rules |

Server checks must be tested independently of UI visibility. Suspended and banned accounts cannot publish. Public stream URLs remain available under the existing guest playback policy; original/master file paths remain protected.

## Recommended creator features

The first release should include role-aware profile headers, creator follow controls, release shelves, catalog organization, profile completeness guidance, shareable creator and release links, notification preferences, persisted creator analytics, and a verification-request form that records a review request without presenting an unverified badge. Future-ready controls may include scheduled-release readiness, draft publishing, collaborators/credits, pinned release, and audience export only if supported by the existing data model and privacy rules.

## Implementation boundaries

Reuse the existing Supabase auth context, profile tables, creator studio, upload helpers, follow tables, analytics events, storage buckets, and RLS policies. Prefer one additive migration for creator identity metadata and server-side procedures. Do not copy Audiomack branding, artwork, text, or user content. Do not seed demo users, chart metrics, testimonials, or follower counts.
