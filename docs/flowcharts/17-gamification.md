# Gamification Flow

## Overview
Badge, points, and streak system. 11 built-in badges auto-awarded based on student actions. Lecturers can create custom badges. Points accumulate from badge awards.

## Flowchart

```mermaid
flowchart TD
    subgraph Trigger Events
        TRIGGER([Student action occurs]) --> WHICH{Which action?}
        WHICH -->|Create mind map| EVT_MAP[maps_created count check]
        WHICH -->|Submit assignment| EVT_ASSIGN[assignments_submitted + early_bird check]
        WHICH -->|Complete quiz| EVT_QUIZ[quizzes_completed + quiz_score check]
        WHICH -->|Write peer review| EVT_REVIEW[peer_reviews count check]
        WHICH -->|Join course| EVT_JOIN[courses_joined count check]
        WHICH -->|Collaborate on map| EVT_COLLAB[collaborations count check]
        WHICH -->|Login daily| EVT_STREAK[streak_days check]
        WHICH -->|Complete course| EVT_COMPLETE[course_completed check]
    end

    subgraph Auto-Badge Check - check_and_award
        EVT_MAP --> CHECK
        EVT_ASSIGN --> CHECK
        EVT_QUIZ --> CHECK
        EVT_REVIEW --> CHECK
        EVT_JOIN --> CHECK
        EVT_COLLAB --> CHECK
        EVT_STREAK --> CHECK
        EVT_COMPLETE --> CHECK

        CHECK[Load all badge criteria: built-in + custom]

        subgraph Built-in Badges - 11 Default
            CHECK --> B1{maps_created >= 1?}
            B1 -->|Yes| AWARD_CARTOGRAPHER[Award: cartographer - Create your first mind map]
            CHECK --> B2{maps_created >= 5?}
            B2 -->|Yes| AWARD_MAPMASTER[Award: map_master - Create 5 mind maps]
            CHECK --> B3{streak_days >= 3?}
            B3 -->|Yes| AWARD_FIRE[Award: on_fire - 3-day streak]
            CHECK --> B4{streak_days >= 7?}
            B4 -->|Yes| AWARD_UNSTOPPABLE[Award: unstoppable - 7-day streak]
            CHECK --> B5{quiz_score >= 90?}
            B5 -->|Yes| AWARD_TOPMARKS[Award: top_marks - Score 90 percent or above]
            CHECK --> B6{early_submissions >= 1?}
            B6 -->|Yes| AWARD_EARLY[Award: early_bird - Submit 24h before deadline]
            CHECK --> B7{quizzes_completed >= 5?}
            B7 -->|Yes| AWARD_QUIZWHIZ[Award: quiz_whiz - Complete 5 quizzes]
            CHECK --> B8{peer_reviews >= 3?}
            B8 -->|Yes| AWARD_HELPER[Award: helper - Write 3 peer reviews]
            CHECK --> B9{course_completed >= 1?}
            B9 -->|Yes| AWARD_COMPLETIONIST[Award: completionist - Complete all course activities]
            CHECK --> B10{courses_joined >= 1?}
            B10 -->|Yes| AWARD_EXPLORER[Award: explorer - Join first course]
            CHECK --> B11{collaborations >= 3?}
            B11 -->|Yes| AWARD_TEAM[Award: team_player - Collaborate on 3 maps]
        end

        subgraph Custom Badges
            CHECK --> CUSTOM[Load custom badges from badgeDefinitions collection]
            CUSTOM --> CUSTOM_CHECK[Check each custom badge condition]
            CUSTOM_CHECK --> CUSTOM_AWARD{Condition met?}
            CUSTOM_AWARD -->|Yes| AWARD_CUSTOM[Award custom badge]
        end
    end

    subgraph Award Process
        AWARD_CARTOGRAPHER --> AWARD_FLOW
        AWARD_MAPMASTER --> AWARD_FLOW
        AWARD_FIRE --> AWARD_FLOW
        AWARD_UNSTOPPABLE --> AWARD_FLOW
        AWARD_TOPMARKS --> AWARD_FLOW
        AWARD_EARLY --> AWARD_FLOW
        AWARD_QUIZWHIZ --> AWARD_FLOW
        AWARD_HELPER --> AWARD_FLOW
        AWARD_COMPLETIONIST --> AWARD_FLOW
        AWARD_EXPLORER --> AWARD_FLOW
        AWARD_TEAM --> AWARD_FLOW
        AWARD_CUSTOM --> AWARD_FLOW

        AWARD_FLOW[Award badge to student]
        AWARD_FLOW --> ALREADY_HAS{Student already has badge?}
        ALREADY_HAS -->|Yes| SKIP[Skip - no duplicate]
        ALREADY_HAS -->|No| ADD_BADGE[Add badge ID to user.badges array]
        ADD_BADGE --> ADD_POINTS[Add points_reward to user.points - default 25]
        ADD_POINTS --> CREATE_NOTIF[Create notification: Badge earned]
        CREATE_NOTIF --> ACTIVITY_LOG[Log to activityFeed]
    end

    subgraph Streak System
        LOGIN([Student logs in]) --> CHECK_LAST[Check lastActiveAt timestamp]
        CHECK_LAST --> CONSECUTIVE{Consecutive day?}
        CONSECUTIVE -->|Yes| INCREMENT[Increment streak count]
        CONSECUTIVE -->|No, gap| RESET[Reset streak to 1]
        INCREMENT --> UPDATE_USER[Update user.streak in Firestore]
        RESET --> UPDATE_USER
        UPDATE_USER --> EVT_STREAK
    end

    subgraph Lecturer Badge Management
        L_CREATE([Lecturer opens manage-badges]) --> L_DEFINE[Define custom badge: name, icon, color, condition, threshold]
        L_DEFINE --> L_SAVE[POST /api/badges/definitions - Save to badgeDefinitions]
        L_SAVE --> L_MANUAL[Manual award: POST /api/badges/award]
        L_MANUAL --> L_REVOKE[Manual revoke: POST /api/badges/revoke]
    end

    subgraph Display
        AWARD_FLOW --> ACHIEVEMENTS[Achievements page: all badges grid]
        ACHIEVEMENTS --> EARNED[Show earned badges with award date]
        ACHIEVEMENTS --> UNEARNED[Show locked badges with progress]
        ACHIEVEMENTS --> POINTS_DISPLAY[Show total points + streak]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/achievements/page.tsx` — Student achievements page
- `frontend-web/src/app/(dashboard)/lecturer/manage-badges/page.tsx` — Badge management
- `frontend-mobile/lib/screens/achievements_screen.dart` — Mobile achievements
- `frontend-mobile/lib/utils/badge_utils.dart` — Badge definitions for mobile
- `backend/app/routers/badges.py` — Badge CRUD, award, revoke, default badges
- `backend/app/routers/auto_badges.py` — Auto-award logic with condition checkers
- `backend/app/gamification.py` — Legacy gamification module
