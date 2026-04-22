# Badge Lottie Icons

Place your `.lottie` files in this folder. The filename must match the icon name used in the badge definition (without the extension).

When a `.lottie` file exists for a badge icon, it will be rendered as an animated Lottie instead of the default Lucide icon — across the entire system (achievements, dashboard, manage-badges, celebration overlay, messages, etc.).

---

## Current Built-in Badge Icons

| Icon Name      | Badge(s)      | Expected Filename     | Description                                                       |
|:---------------|:--------------|:----------------------|:------------------------------------------------------------------|
| `map`          | Cartographer  | `map.lottie`          | A folded map icon. Awarded for creating first mind map.           |
| `trophy`       | Map Master    | `trophy.lottie`       | A golden trophy cup. Awarded for creating 5 mind maps.            |
| `flame`        | On Fire       | `flame.lottie`        | A burning flame. Awarded for maintaining a 3-day login streak.    |
| `zap`          | Unstoppable   | `zap.lottie`          | A lightning bolt. Awarded for maintaining a 7-day login streak.   |
| `star`         | Top Marks     | `star.lottie`         | A shining star. Awarded for scoring 90%+ on an assignment/quiz.   |
| `bird`         | Early Bird    | `bird.lottie`         | A small bird in flight. Awarded for submitting 24h+ early.        |
| `brain`        | Quiz Whiz     | `brain.lottie`        | A brain icon. Awarded for completing 5 quizzes.                   |
| `handshake`    | Helper        | `handshake.lottie`    | Two hands shaking. Awarded for writing 3 peer reviews.            |
| `check-circle` | Completionist | `check-circle.lottie` | A circled checkmark. Awarded for completing all course activities. |
| `compass`      | Explorer      | `compass.lottie`      | A navigation compass. Awarded for joining first course.           |
| `users`        | Team Player   | `users.lottie`        | A group of people. Awarded for collaborating on 3 mind maps.      |

---

## All Available Icon Names

These are all the icon names supported by the system. You can place a `.lottie` file for any of them:

| Icon Name        | Filename                | Fallback       | Description                                                    |
|:-----------------|:------------------------|:---------------|:---------------------------------------------------------------|
| `map`            | `map.lottie`            | Map            | A folded map. Exploration, navigation, mind map creation.      |
| `trophy`         | `trophy.lottie`         | Trophy         | A golden trophy cup. Winning, mastery, major achievements.     |
| `flame`          | `flame.lottie`          | Flame          | A burning flame. Streaks, consistency, being on fire.          |
| `zap`            | `zap.lottie`            | Zap            | A lightning bolt. Speed, energy, unstoppable momentum.         |
| `star`           | `star.lottie`           | Star           | A shining star. Excellence, top scores, standout work.         |
| `target`         | `target.lottie`         | Target         | A bullseye target. Precision, goal-setting, focus.             |
| `gem`            | `gem.lottie`            | Gem            | A sparkling gemstone. Rare achievements, hidden treasures.     |
| `rocket`         | `rocket.lottie`         | Rocket         | A launching rocket. Rapid progress, taking off.                |
| `graduation-cap` | `graduation-cap.lottie` | GraduationCap  | A graduation cap. Academic milestones, completing courses.     |
| `book-open`      | `book-open.lottie`      | BookOpen       | An open book. Reading, learning, studying resources.           |
| `brain`          | `brain.lottie`          | Brain          | A brain. Knowledge, quiz mastery, critical thinking.           |
| `handshake`      | `handshake.lottie`      | Handshake      | Two hands shaking. Collaboration, peer reviews, teamwork.      |
| `bird`           | `bird.lottie`           | Bird           | A bird in flight. Early submissions, ahead of schedule.        |
| `check-circle`   | `check-circle.lottie`   | CheckCircle    | A circled checkmark. Completion, verification, finishing.      |
| `lightbulb`      | `lightbulb.lottie`      | Lightbulb      | A glowing lightbulb. Ideas, creativity, learning moments.      |
| `palette`        | `palette.lottie`        | Palette        | An artist's palette. Creativity, design, visual thinking.      |
| `medal`          | `medal.lottie`          | Medal          | A medal on a ribbon. Honorable achievement, recognition.       |
| `crown`          | `crown.lottie`          | Crown          | A royal crown. Leadership, top ranking, being the best.        |
| `sparkles`       | `sparkles.lottie`       | Sparkles       | Twinkling sparkles. Magic, special moments, new unlocks.       |
| `compass`        | `compass.lottie`        | Compass        | A navigation compass. Exploration, joining courses, growth.    |
| `users`          | `users.lottie`          | Users          | A group of people. Teamwork, collaboration, community.         |
| `clock`          | `clock.lottie`          | Clock          | A clock face. Time management, punctuality, deadlines.         |
| `shield-check`   | `shield-check.lottie`   | ShieldCheck    | A shield with checkmark. Security, integrity, trust.           |
| `award`          | `award.lottie`          | Award          | An award ribbon. Recognition, accomplishment, honor.           |
| `heart`          | `heart.lottie`          | Heart          | A heart. Passion, dedication, love for learning.               |

---

## Custom Uploaded Lottie Files

When creating a badge in Admin / Lecturer → Manage Badges, you can upload a custom `.lottie` file. These are stored on the backend at `/uploads/lottie/` and served via the API. The uploaded lottie URL is saved in the badge definition and takes priority over any file in this folder.

---

## How It Works (Priority Order)

1. **Custom uploaded Lottie** (`lottie_url` on badge definition) — highest priority
2. **Local Lottie file** in this folder matching the icon name — second priority
3. **Animated Lucide icon** with colors — fallback

---

## Where to Get .lottie Files

- [LottieFiles](https://lottiefiles.com/) — Free and premium animated icons
- [IconScout Lottie](https://iconscout.com/lottie-animations) — Animated icon packs
- Export from After Effects using the LottieFiles plugin
