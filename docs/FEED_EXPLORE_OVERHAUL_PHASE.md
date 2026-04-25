# Feed + Explore UI/UX Overhaul Phase

**Date completed:** 2026-04-25
**Branch:** `feature/feed-explore-overhaul`
**Commits:** `3e02a2a` (overhaul), `3eaf078` (suggested-creators limit fix)
**Web revision:** `mysmartstudy-web-00025-blg`
**Backend revision:** unchanged (`mysmartstudy-api-00019-rc9` from the prior phase)
**Scope:** web only — `frontend-web/src/app/(dashboard)/student/{feed,explore}/page.tsx`

This document summarizes a presentation-layer refresh of the two Phase 2
social discovery surfaces on web:

1. **Feed page** (`/student/feed`) — public mind maps from people the
   viewer follows, newest-first.
2. **Explore page** (`/student/explore`) — global discovery: trending public
   maps and suggested creators.

No backend, mobile, or API contract changes. All four data calls
(`socialApi.feed`, `trending`, `suggested`, `searchUsers`, plus
`socialApi.following` for the new rail) consume the existing endpoint
shapes; the work was entirely about visual hierarchy, information density,
and skeleton/loading states.

---

## 1. Feed page (`frontend-web/src/app/(dashboard)/student/feed/page.tsx`)

### Hero header

- Replaced the old `flex` row header (icon tile + title + refresh button on
  one line) with a full-width `glass-card` hero containing two decorative
  blurred gradient orbs (`bg-accent-blue/20` top-right, `bg-accent-purple/15`
  bottom-left). The orbs are absolutely positioned and `pointer-events-none`
  so they never intercept clicks.
- The `Users` icon now sits in a 12×12 gradient tile
  (`bg-gradient-to-br from-accent-blue to-accent-purple`) with an IPG-blue
  shadow, matching the visual weight of the Explore hero.
- The Refresh button moved into the hero, switched from a subdued pill to
  a `bg-white/5 hover:bg-white/10 border-white/10` rounded button so it
  reads as a real control instead of a footnote. Label collapses below the
  `sm` breakpoint to leave just the icon.

### Live stat chips (`StatChip`)

A new strip of four chips renders under the title once the feed has data.
Values are computed via `useMemo` over the `maps` array so they only
recalculate when the list changes:

| Chip | Source | Tint |
|---|---|---|
| `{N} maps` | `maps.length` | accent-blue |
| `{N} creators` | `new Set(maps.map(m => m.owner_id)).size` | accent-purple |
| `{N} likes` | `Σ map.like_count` | accent-pink |
| `{N} comments` | `Σ map.comment_count` | accent-cyan |

Each chip uses `inline-flex` with a 1.5-gap, a small Lucide icon, the
count, and a pluralised label. Tones are routed through a small `tones`
record so adding a chip type later is one entry.

### "People you follow" rail (`FollowingAvatar`)

- New horizontal scroll rail above the feed body, populated by a separate
  call to `socialApi.following(user.id, 24)` triggered when `user.id`
  becomes known.
- The rail effect is hidden when the user follows nobody (the load is
  cancellable via a `cancelled` ref so a stale response can't reset state
  after unmount).
- Each entry is a `PublicProfileLink` to the public profile, with the
  avatar wrapped in a 14×14 padded gradient ring
  (`from-accent-blue via-accent-purple to-accent-pink`) over a
  `bg-dark-900` inner ring. The ring scales `1.05` on hover.
- Display name is line-clamped/truncated under the avatar at 10.5px so the
  rail stays compact even when scrolling between many users.
- Auto-prunes when the viewer unfollows someone — `handleFollowChange`
  drops the user from both `maps` and `followingRail` in a single update.

### Skeleton loader (`FeedCardSkeleton`)

- Replaced the single centered `Loader2` with two glass-card skeletons that
  mimic the real feed-card layout:
  - 9×9 avatar disc + two title bars (1/3 and 1/4 width).
  - 240px image block.
  - Three body lines (3/4, full, 2/3 widths).
- Uses `animate-pulse` against `bg-white/10` and `bg-white/5` so it works
  in both dark and the existing light-mode overrides without extra CSS.

### Empty state (`EmptyFeedState`, `SuggestedCard`)

- Centered glass-card hero now uses the global `bg-mesh` overlay at 60%
  opacity behind the icon and copy.
- A 16×16 gradient tile in `from-accent-blue/20 to-accent-purple/20`
  replaces the smaller flat tile.
- Copy revised to "Your feed is quiet — for now" with a softer
  prescriptive subtitle and a primary `btn-gradient` "Explore creators"
  CTA.
- Suggested users moved from a tight stacked list (3 rows) to a
  responsive 2-column grid of 6 `SuggestedCard`s. Each card has:
  - 16-tall cover-photo header (`cover_photo_url` if present, gradient
    fallback otherwise) with a fade-to-page overlay.
  - 12×12 avatar overlapping the cover/body seam, with a 2px dark-page
    border and shadow.
  - Display name + follower count, optional 2-line bio preview, and the
    inline `FollowButton` (size `sm`).

### Untouched

- `MapFeedCard` is still the canonical feed-card and is reused as-is.
- `socialApi.feed(30)` cap and the `handleFollowChange` patch logic are
  unchanged.
- Page-level `motion.div` enter animation is unchanged.

---

## 2. Explore page (`frontend-web/src/app/(dashboard)/student/explore/page.tsx`)

### Hero header with search

- The old separate header + search-card stack is now a single elevated
  hero card with two large gradient orbs (`accent-purple/25` and
  `accent-blue/20`).
- The icon tile is `from-accent-purple to-accent-pink` (mirrors the Feed
  hero's blue→purple palette so the two pages look like sibling surfaces).
- Search input promoted to `py-3` rounded-xl with a `pl-11` icon offset —
  it now reads as the primary action of the page rather than a side
  control.
- Search results render *inside* the hero, separated by a divider with a
  small "Search results" eyebrow. Results moved from a single column to a
  responsive 2-column grid of `UserRow`s on `sm+` so wider screens use the
  space.

### Tabs

- Replaced the segmented pill with an underline tab pattern.
- The active tab gets an animated `motion.div layoutId="explore-tab-underline"`
  on a `bg-gradient-to-r from-accent-blue to-accent-purple` underline so
  the indicator slides between Trending and Creators.
- Each tab now shows a count badge (e.g. `Trending [24]`, `Creators [50]`)
  derived directly from the loaded list lengths. Empty lists hide the
  badge entirely.

### Trending window selector (7d / 30d / 90d)

- Promoted from a tiny `text-[11px]` chip row to a proper `bg-white/5
  border-white/10` segmented button group with `min-w-[58px]` cells.
- The active window gets the `from-accent-blue to-accent-purple` gradient
  treatment and a shadow, so the current scope is immediately readable.
- Subtitle row reads "Top maps from the last `<window>` days" with a
  `Flame` icon in `accent-pink` to anchor the section.

### Featured trending card (`FeaturedTrendingCard`)

The first map in the trending response is lifted into a side-by-side hero
card above the grid:

- Layout — 5-column grid on `md+` (3 columns thumbnail / 2 columns body),
  stacks vertically below `md`.
- Thumbnail block — 220px on mobile, 300px on `md+`, with a
  `group-hover:scale-[1.02]` zoom on a 500ms transition.
- Top-left — a gold trophy ribbon
  (`from-amber-400 to-amber-600`) with the label "#1 Trending".
- Top-right — `VisibilityBadge` (consistent with the existing badge
  component used elsewhere).
- Body — author row with `FollowButton`, full title (line-clamp-2), a
  200-character teaser pulled from `nodes_text`, like/comment chips, and
  an "Open" CTA. The like chip uses `bg-accent-pink/10` with a filled
  heart when `is_liked_by_me`.

### Trending grid (`TrendingMapCard`)

The remaining trending entries render in a 3-column responsive grid
(`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`):

- Backend limit raised from 20 to 24 inside `loadTrending` so the grid
  fills cleanly: 1 hero + 23 grid cells = 7 full rows of 3 + 2 stragglers
  on `lg`.
- Each card has a 7×7 rank badge in the top-left:
  - Ranks 2–3 → gold gradient (`from-amber-400 to-amber-600`).
  - Ranks 4+ → neutral `bg-dark-900/80` glass with a 1px border.
- 160px thumbnail with the same `scale-[1.04]` hover zoom.
- Title clamps to 2 lines with `min-h-[2.5em]` so cards stay aligned even
  when titles are short.
- Compact author/follow footer with a 5×5 avatar and the `FollowButton`
  (size `sm`) on the right.
- Like + comment counts live below a `border-t border-white/5` divider so
  the meta row reads as a separate band from the title.

### Creators tab (`CreatorCard`)

Replaced the divided list with a 3-column responsive grid:

- 24-tall cover-photo header (`cover_photo_url` if set, gradient fallback)
  with a `group-hover:scale-105` zoom and a `to-[rgba(8,12,26,0.85)]` fade
  to the page colour.
- 16×16 avatar overlaps the cover/body seam at `-mt-9` with a 4px
  dark-page border and a shadow ring.
- Display name (clamps + colour shift on hover), follower / following
  counts, and a 2-line bio with `min-h-[2.4em]` so tiles stay aligned.
- Full-width `FollowButton` (the existing component now respects a
  `className` prop including `w-full justify-center` for this layout).

### Skeleton states (`TrendingCardSkeleton`, `CreatorCardSkeleton`)

- `TrendingCardSkeleton` — 160px image block, 4/5-width title bar, 1/3
  meta bar, two short footer chips. Rendered 6× during trending load.
- `CreatorCardSkeleton` — 24-tall cover, 16×16 avatar disc with the
  4px dark-page border, two text bars, and a full-width 7-tall button
  block. Rendered 6× during suggested load.

### Untouched

- All four data calls (`trending`, `suggested`, `searchUsers`, plus the
  follow toggle handler) are unchanged.
- The local `patchFollowFlag` logic still keeps suggested + search +
  trending lists in sync after a follow/unfollow.
- Empty states for Trending / Creators keep their copy and structure —
  just lifted into the new card surface.

---

## 3. Limit fix (`3eaf078`)

After the initial overhaul shipped, the suggested-creators tab was capped
at 12 because of a frontend-side limit hardcoded at the fetch site:

```ts
// before
const data = await socialApi.suggested(12);

// after
const data = await socialApi.suggested(50);
```

The backend endpoint already supports up to 50
(`limit: int = Query(10, ge=1, le=50)` in
`backend/app/routers/social.py:494`), so no server change was needed. The
grid scrolls naturally for the additional rows; the loaded count flows
through to the tab badge automatically because the badge reads
`suggested.length`.

---

## 4. Sub-components introduced

| Component | File | Purpose |
|---|---|---|
| `StatChip` | feed/page.tsx | Tinted pill for the feed hero stats row. |
| `FollowingAvatar` | feed/page.tsx | Avatar tile with gradient ring used in the rail. |
| `FeedCardSkeleton` | feed/page.tsx | Glass-card skeleton mimicking `MapFeedCard`. |
| `EmptyFeedState` | feed/page.tsx | Hero CTA + suggested-creators grid. |
| `SuggestedCard` | feed/page.tsx | Cover-photo + avatar + bio + follow card. |
| `FeaturedTrendingCard` | explore/page.tsx | Side-by-side hero card with #1 ribbon. |
| `TrendingMapCard` | explore/page.tsx | 3-up grid card with rank badge + compact footer. |
| `CreatorCard` | explore/page.tsx | Cover-photo creator tile with full-width follow. |
| `UserRow` | explore/page.tsx | Compact row used in the in-hero search results. |
| `TrendingCardSkeleton` | explore/page.tsx | Placeholder for the trending grid. |
| `CreatorCardSkeleton` | explore/page.tsx | Placeholder for the creators grid. |

All components are local to the page modules; none are exported. If any
of them earn a second caller later (e.g. a profile-page version of
`SuggestedCard`), they should graduate to `frontend-web/src/components/`
at that point — not before, so we don't ship abstractions ahead of need.

---

## Files touched

```
frontend-web/src/app/(dashboard)/student/feed/page.tsx     M
frontend-web/src/app/(dashboard)/student/explore/page.tsx  M
docs/FEED_EXPLORE_PATCH.md                                 A   (short release note)
docs/FEED_EXPLORE_OVERHAUL_PHASE.md                        A   (this file)
```

2 source files, +818 / −187 across the two pages (overhaul commit) and a
+1 / −1 single-line bump (limit fix commit).

---

## Verification

- `npx tsc --noEmit` across the entire web project: **0 errors**.
- ESLint: did not run cleanly this session due to a pre-existing
  `zod/v4` module-resolution issue in `eslint-plugin-react-hooks`
  (unrelated to this patch).
- Cloud Run deploy (overhaul): `Service [mysmartstudy-web] revision
  [mysmartstudy-web-00024-q5x] has been deployed and is serving 100
  percent of traffic.`
- Cloud Run deploy (limit fix): `Service [mysmartstudy-web] revision
  [mysmartstudy-web-00025-blg] has been deployed and is serving 100
  percent of traffic.`
- GitNexus index refreshed via `npx gitnexus analyze` after each commit
  (PostToolUse hook flagged staleness; both runs completed cleanly).

---

## Known caveats / follow-ups

1. **No "Load more" on Suggested Creators.** The frontend now requests up
   to the backend max (50). Beyond that we'd need a cursor on
   `/social/explore/suggested` (the endpoint currently returns top-N
   only). Queue this with the existing pagination follow-ups.
2. **Trending grid still hard-capped at 24.** Same shape as above —
   raising the cap is a one-liner, but a real "see more" needs cursor
   support on `/social/explore/trending`.
3. **Featured trending = list[0] only.** If a tie pushes another map to
   the same like count, we still pick whatever the backend ordered first.
   No tiebreak UX needed yet, but worth flagging if reviewers ask.
4. **No infinite scroll on the Feed.** Still single fetch
   (`socialApi.feed(30)`) per the original Phase 2 design. The hero stats
   reflect the loaded slice, not the global figure.
5. **Mobile parity not covered.** The mobile Feed/Explore screens (queued
   in `SOCIAL_DIGEST_PHASE.md` follow-ups) are still pending; this patch
   doesn't change that backlog.
6. **Light-mode pass not separately validated.** The patch uses existing
   design tokens (`glass-card`, `bg-white/5`, `text-dark-*`,
   `accent-*`) that already have light-mode overrides in `globals.css`,
   but I did not visually QA the light theme this session. Worth a quick
   look before merging to `main`.

---

## How to revert

```bash
# Code — drop both patch commits and return to the pre-overhaul main:
git reset --hard 5c835ea

# Or keep the overhaul but drop the limit-bump:
git reset --hard 3e02a2a

# Cloud Run — point traffic back at the last pre-patch revision:
gcloud run services update-traffic mysmartstudy-web \
  --to-revisions mysmartstudy-web-00023-zzv=100 \
  --region asia-southeast1
```
