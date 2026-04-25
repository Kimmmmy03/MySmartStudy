# Notification Digest + Mobile Social Parity Phase

**Date completed:** 2026-04-25
**Commit:** `8df4cbd` on `main`
**Backend revision:** `mysmartstudy-api-00019-rc9`
**Web revision:** `mysmartstudy-web-00023-zzv`

This document summarizes the work shipped in one batch covering two parallel goals:

1. **Notification digest grouping** — Instagram-style "5 people liked your mind map" collapsing across web + mobile.
2. **Mobile social parity** — bringing the Followers / Feed / Explore / Likes / Comments features that already exist on web up to model + widget parity on mobile, plus a public profile screen and per-type notification preferences.

---

## 1. Notification digest grouping

### Backend (`backend/app/routers/notifications.py`)

- New `GET /api/notifications/grouped` endpoint.
  - Query params: `limit` (default 40, max 100), `window_hours` (default 24, range 1–168).
  - Fetches up to `limit * 4` raw notifications (capped at 200) and collapses them.
  - Grouping key: `(notification_type, link)`. Only types in `{map_like, map_comment, new_follower, map_posted}` are eligible for grouping; everything else stays as a single-doc entry.
  - Each grouped entry exposes:
    - `id` — the most recent source notification id (for backwards-compat; clients should use `source_ids` for fan-out).
    - `kind` — `"single"` or `"digest"`.
    - `count` — number of underlying docs in this group.
    - `actors[]` — extracted display names (deduped, ordered by recency).
    - `source_ids[]` — every underlying notification doc id, used by clients to fan out mark-read / delete operations.
    - `title` — auto-generated for digests via `_digest_title_for(type, count)` (e.g. "5 people liked your mind map").
    - `message`, `createdAt`, `read`, `link` — passthrough from the most recent source.
  - The original `GET /` raw endpoint is preserved unchanged so any existing read-state code keeps working.

- New helper `_extract_actor(message: str) -> Optional[str]`:
  - Parses the natural-language `message` body of a notification to extract the actor's display name.
  - Looks for separator patterns: `" started "`, `" liked "`, `" commented "`, `": "`. Whatever precedes the separator is taken as the actor name.
  - Used to build the `actors[]` list for digests without requiring a schema migration on existing notification docs.

- New helper `_digest_title_for(n_type: str, count: int) -> str`:
  - Returns templated digest titles like `"{count} people liked your mind map"`, falling back to the type-default title when `count == 1`.

### Web (`frontend-web/src/lib/api.ts`)

- New TypeScript interface `NotificationDigestItem` — shape mirrors the backend `/grouped` response (`id, kind, type, link, title, message, createdAt, read, count, actors, source_ids`).
- New `notificationsApi.listGrouped(limit?, windowHours?)` method.

### Web (`frontend-web/src/components/notification-dropdown.tsx`)

- Replaced `notificationsApi.list()` with `notificationsApi.listGrouped(20)`.
- Added new icons + tints for the social types that didn't exist before (`map_like → Heart`, `map_comment → MessageCircle/cyan`, `new_follower → UserPlus/blue`, `map_posted → Users/purple`).
- New `actorsLine(actors, count)` helper renders "Ali, Sarah and 3 others" between the title and message body.
- Digest entries get a `count` badge in the title row.
- `handleMarkRead` and `handleDelete` now fan out across `source_ids[]` so a single click marks/deletes every underlying doc the digest wraps. The local optimistic update reconciles all wrapper digests whose source list is fully covered.

### Web (`frontend-web/src/components/notifications-page-view.tsx`)

- Same digest treatment as the dropdown — `listGrouped(50)`, identical icon/tint table, actors-line component, count badge, source-ids fan-out for mark-read and delete.
- Filter tabs (`all` / `unread`) and `unreadCount` derive from the digest list directly. The badge count is "≥ real unread" (a single digest can wrap multiple unread docs) but works fine as a bell indicator.

### Mobile (`frontend-mobile/lib/services/api_service.dart`)

- New `getNotificationsGrouped({limit = 50, windowHours = 24})` method calling `/notifications/grouped`.

### Mobile (`frontend-mobile/lib/screens/notifications_screen.dart`)

- `_load()` now calls `getNotificationsGrouped()` instead of the raw `getNotifications()`.
- `_iconFor()` and `_colorFor()` gained cases for `map_like` (favourite/pink), `map_comment` (mode_comment/cyan), `new_follower` (person_add/blue), `map_posted` (auto_awesome/purple).
- New `_actorsLine(actors, count)` helper builds "Ali, Sarah and 3 others" identical to the web logic.
- `_notifTile()` rewritten to read `kind`, `count`, `actors`, `source_ids`:
  - Renders a purple `count` pill next to the title for digest entries.
  - Renders the actors line as bold text inline with the body via `RichText`.
  - `onTap` mark-read fans out across every entry in `source_ids[]` using `Future.wait(...)`.

---

## 2. Mobile social parity

### Mobile (`frontend-mobile/lib/services/api_service.dart`)

Added a new "Social" section (mirrors `frontend-web/src/lib/api.ts::socialApi`):

| Method | Endpoint | Notes |
|---|---|---|
| `followUser(uid)` | `POST /social/follow/{uid}` | Returns `{ok, already_following}`. |
| `unfollowUser(uid)` | `DELETE /social/follow/{uid}` | Returns `{ok, was_following}`. |
| `getFollowers(uid, {limit})` | `GET /social/followers/{uid}` | List of public profiles. |
| `getFollowing(uid, {limit})` | `GET /social/following/{uid}` | List of public profiles. |
| `getPublicProfile(uid)` | `GET /social/profile/{uid}` | Includes `is_followed_by_me`. |
| `getFeed({limit})` | `GET /social/feed` | Followed-user public maps. |
| `getTrending({days, limit})` | `GET /social/explore/trending` | Defaults to 30-day window. |
| `getSuggestedUsers({limit})` | `GET /social/explore/suggested` | Excludes users with zero public maps. |
| `searchSocialUsers(q, {limit})` | `GET /social/users/search` | Renamed to disambiguate from the existing `/messages/search-users` `searchUsers`. |
| `likeMap(mapId)` | `POST /social/maps/{id}/like` | Returns `{ok, already_liked, like_count}`. |
| `unlikeMap(mapId)` | `DELETE /social/maps/{id}/like` | Returns `{ok, was_liked}`. |
| `listMapComments(mapId, {limit})` | `GET /social/maps/{id}/comments` | |
| `createMapComment(mapId, text)` | `POST /social/maps/{id}/comments` | |
| `deleteMapComment(mapId, commentId)` | `DELETE /social/maps/{id}/comments/{commentId}` | |
| `getPublicMapsByUser(uid, {limit})` | `GET /maps/public/user/{uid}` | Used by public profile grid. |
| `uploadCoverPhoto(filePath)` | `POST /users/me/cover-photo` | Multipart file upload, returns `{cover_photo_url}`. |
| `updateNotificationPrefs(prefs)` | `PATCH /users/me` | Snake-case keys: `new_follower, map_like, map_comment, followed_user_posts`. |

### Mobile (`frontend-mobile/lib/models/user_profile.dart`)

Extended `UserProfile` with social fields:

- `bio: String` (default `""`)
- `coverPhotoURL: String` (default `""`)
- `followerCount: int` (default `0`)
- `followingCount: int` (default `0`)
- `notificationPrefs: NotificationPrefs`

New `NotificationPrefs` class with `newFollower`, `mapLike`, `mapComment`, `followedUserPosts` flags. Defaults match the backend (`followedUserPosts` is the only one off-by-default). Has `fromApi`, `toApi`, and `copyWith`.

New `coverUrl` and `hasCover` getters mirror the existing `avatarUrl` and `hasAvatar` patterns.

### Mobile (`frontend-mobile/lib/models/mind_map_model.dart`)

- New top-level `MapVisibility` enum: `private`, `unlisted`, `public`.
- New `MapVisibilityX` extension with `apiValue` and `MapVisibilityX.fromApi()` for safe parsing.
- `MindMapModel` gained `visibility`, `likeCount`, `commentCount` fields with sane defaults (`private`, `0`, `0`).
- `fromApi()` parses both snake_case and camelCase on the new fields.

### Mobile (`frontend-mobile/lib/widgets/visibility_badge.dart`) — NEW

Pill badge with icon + label + tinted bg/border:

- `private` — lock icon, neutral muted tint.
- `unlisted` — link icon, blue tint.
- `public` — globe icon, purple tint.

Supports `compact` mode for use inside list cards.

### Mobile (`frontend-mobile/lib/widgets/follow_button.dart`) — NEW

Follow/unfollow toggle with optimistic state and error rollback. Mirrors the web component:

- Unfollowing state → blue→purple gradient with "Follow" label.
- Following state → muted glass with white-text "Following" label.
- Loading spinner replaces the icon during the API round-trip.
- `onChange(bool)` callback fires after server confirmation so the parent can reconcile cached follower counts.
- `compact` prop for use inside list rows.

### Mobile (`frontend-mobile/lib/screens/public_profile_screen.dart`) — NEW

Mirrors `/student/profile/[uid]` on web:

1. **Self-view guard** — if the uid matches the current Firebase user, the screen pops immediately on `initState` so the caller can route to the editable self-profile instead. Single source of truth for edits.
2. **Cover strip** — 180px image if `cover_photo_url` is set, otherwise a soft purple→blue→cyan gradient placeholder.
3. **Avatar overlap** — 88px rounded avatar transformed up to overlap the cover, with a 4px surface-coloured border ring and shadow.
4. **Header row** — display name + role + FollowButton on the right (state-managed locally, increments/decrements `_followerCount` on `onChange`).
5. **Bio** — only renders when non-empty.
6. **Counters** — pill-style follower / following counts (purple / blue tints).
7. **Public maps section** — fetches via `getPublicMapsByUser(uid, limit: 30)`. Each tile shows thumbnail (or fallback icon), title, like count + comment count, and chevron. Tapping fetches the full map via `getMap(id)` and pushes `MindMapViewerScreen`.
8. **States** — separate skeleton/loader for profile vs maps fetch; `EmptyState` when no public maps; `EmptyState` glass card for not-found.
9. **Pull-to-refresh** — calls `_load()` to refetch both profile and maps.

### Mobile (`frontend-mobile/lib/screens/profile_screen.dart`)

Augmented self-profile with social fields. The existing form's `_isDirty` logic now also tracks bio, and saving sends `bio` along with the existing fields:

**State additions:**
- `_bioCtrl: TextEditingController` for the bio.
- `_coverPhotoUrl: String` reflecting the uploaded URL.
- `_uploadingCover: bool`.
- Four notification-pref booleans: `_prefNewFollower`, `_prefMapLike`, `_prefMapComment`, `_prefFollowedUserPosts`.
- `_savingPrefs: bool` to guard concurrent toggle calls.

**Methods added:**
- `_pickCoverPhoto()` — image picker → `uploadCoverPhoto` → updates local URL; max width 1600.
- `_toggleNotifPref({...})` — optimistic state flip, calls `updateNotificationPrefs` with all four current values, rolls back on error and shows a SnackBar.

**UI additions inside Edit Profile card:**
- New 3-line `Bio` field with 280-char counter, between Full Name and the read-only Email.

**New "Social & Notifications" section** (between Edit Profile and Achievements):
- Glass card with header, then a cover-photo tile:
  - 120px preview banner (image or gradient).
  - "Add cover photo" / "Change cover photo" outlined button (purple).
- Divider, then a notification-preferences sub-section:
  - Header + 1-line description.
  - Four `_buildPrefSwitch` rows (icon + label + adaptive Switch):
    1. New followers — blue tint.
    2. Likes on my maps — pink tint.
    3. Comments on my maps — cyan tint.
    4. New posts from people I follow — purple tint.

Each switch saves on toggle (no separate Save button needed for prefs — the rest of the form retains its existing dirty-state Save Changes flow).

---

## Files touched

```
backend/app/routers/notifications.py                    M
frontend-web/src/lib/api.ts                             M
frontend-web/src/components/notification-dropdown.tsx   M
frontend-web/src/components/notifications-page-view.tsx M
frontend-mobile/lib/services/api_service.dart           M
frontend-mobile/lib/models/user_profile.dart            M
frontend-mobile/lib/models/mind_map_model.dart          M
frontend-mobile/lib/widgets/visibility_badge.dart       A
frontend-mobile/lib/widgets/follow_button.dart          A
frontend-mobile/lib/screens/notifications_screen.dart   M
frontend-mobile/lib/screens/public_profile_screen.dart  A
frontend-mobile/lib/screens/profile_screen.dart         M
```

12 files, +1695 / −49.

---

## Verification

- `flutter analyze` across the entire mobile project: **0 errors** (988 pre-existing info-level lints unchanged).
- Backend deploy: `Service [mysmartstudy-api] revision [mysmartstudy-api-00019-rc9] has been deployed and is serving 100 percent of traffic.`
- Web deploy: `Service [mysmartstudy-web] revision [mysmartstudy-web-00023-zzv] has been deployed and is serving 100 percent of traffic.`

---

## Known caveats / follow-ups

1. **GitNexus index not refreshed** — `npx gitnexus analyze` failed with an `EPERM` error on `onnxruntime-web` (npm cache lock on Windows). Re-run when the cache clears.
2. **No mobile entry points to `PublicProfileScreen` yet** — the screen is built and route-ready but no caller pushes it. Natural hookups: tapping author rows in feed/notifications, avatars in discussions, suggested-users tiles. (Queued as the next mobile task.)
3. **No mobile Feed / Explore screens** — the api_service methods exist (`getFeed`, `getTrending`, `getSuggestedUsers`, `searchSocialUsers`) but no UI consumes them yet.
4. **No mobile like/comment UI** — `likeMap` / `listMapComments` / `createMapComment` / `deleteMapComment` exist on api_service but no UI wires them up on the mobile map viewer.
5. **Mobile APK not rebuilt this session** — code changes live on `main`; rebuild + sideload required to pick up changes on test devices.
