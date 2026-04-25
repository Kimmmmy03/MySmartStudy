# Patch — Feed + Explore UI/UX Overhaul

**Date:** 2026-04-25
**Branch:** `feature/feed-explore-overhaul`
**Commits:** `3e02a2a`, `3eaf078`
**Web revision:** `mysmartstudy-web-00025-blg` (Cloud Run, `asia-southeast1`)
**Scope:** web only — no backend / mobile / API changes.

A presentation-layer refresh of the two Phase 2 social discovery surfaces:
`/student/feed` and `/student/explore`. Same data, sharper layout.

---

## What's new

### Feed page (`/student/feed`)

- **Hero header** — gradient orbs, gradient icon tile, dynamic stat chips
  showing maps / creators / likes / comments in the current feed.
- **People-you-follow rail** — horizontal scroll strip of avatars with a
  gradient ring, links to the public profile of each.
- **Skeleton cards** replace the plain spinner during initial load.
- **Empty state** — centered hero with mesh background and a 2-column grid
  of suggested creators (cover photo, avatar, bio, follow button).

### Explore page (`/student/explore`)

- **Hero search** — search input promoted into the hero card; results
  render in a 2-column grid below a divider.
- **Underline tabs** with animated indicator and per-tab count badges
  (`Trending [N]`, `Creators [N]`).
- **Window selector** (7d / 30d / 90d) is now a prominent gradient pill
  group instead of a tiny chip row.
- **Featured trending #1** card — side-by-side hero with a gold "#1
  Trending" trophy ribbon, full title, teaser, and stats.
- **Trending grid** — 3-column responsive grid with rank badges (gold for
  ranks 1–3, neutral glass for 4+) and compact author/like/comment footer.
- **Creators grid** — rich cards using `cover_photo_url` as a header,
  avatar overlapping the seam, bio preview, full-width follow button.
- **Skeleton states** for both grids.

### Limit bump

Suggested-creators tab was capped at 12 because of a frontend-side limit;
bumped to 50 (the backend max). No server change needed.

---

## Files touched

```
frontend-web/src/app/(dashboard)/student/feed/page.tsx
frontend-web/src/app/(dashboard)/student/explore/page.tsx
```

## Out of scope

- Backend endpoints — unchanged.
- Mobile — separate workstream.
- `MapFeedCard` — still the canonical feed-card component; Explore got its
  own purpose-built `FeaturedTrendingCard` / `TrendingMapCard` instead of
  forking it.

---

## Rollback

```bash
# Code
git checkout main                              # leave the feature branch
# or to drop both patch commits:
git reset --hard 5c835ea

# Cloud Run (revert serving traffic to the pre-patch revision)
gcloud run services update-traffic mysmartstudy-web \
  --to-revisions mysmartstudy-web-00023-zzv=100 \
  --region asia-southeast1
```
