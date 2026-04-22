import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:animations/animations.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../models/user_profile.dart';
import '../models/mind_map_model.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../utils/badge_utils.dart';
import '../widgets/badge_icon_widget.dart';
import '../utils/tutorial_prefs.dart';
import '../l10n/app_strings.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/floating_nav_bar.dart';
import '../widgets/open_container_wrapper.dart';
import '../widgets/tutorial_overlay.dart';
import '../widgets/shimmer_box.dart';
import '../widgets/glass_card.dart';
import '../widgets/stat_card.dart';
import '../widgets/section_header.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/badge_chip.dart';
import '../widgets/map_thumbnail.dart';
import 'mind_map_viewer.dart';
import 'achievements_screen.dart';
import 'manage_badges_screen.dart';
import 'notifications_screen.dart';
import 'messaging_screen.dart';
import 'activity_screen.dart';
import 'ai_exam_planner_screen.dart';
import 'ai_study_materials_screen.dart';
import 'attendance_checkin_screen.dart';
import 'attendance_session_detail_screen.dart';
import '../widgets/glass_bottom_sheet.dart';
import 'mind_maps_screen.dart';
import 'grades_screen.dart';
import 'review_maps_screen.dart';
import 'lecturer_analytics_screen.dart';
import 'announcements_screen.dart';
import 'subjects_screen.dart';
import 'quiz_course_picker_screen.dart';
import 'learning_plan_screen.dart';
import '../widgets/weekly_reflection_modal.dart';

// ── "Sunrise" palette — warm, bright, welcoming ─────────────────────────
const _pSlate     = Color(0xFF8BB5DC); // soft sky — primary (student)
const _pLavender  = Color(0xFFBFA8D9); // lavender — secondary (lecturer)
const _pSky       = Color(0xFFA9C9E8); // powder sky
const _pSage      = Color(0xFFA8C9A8); // sage mint — success / done
const _pSand      = Color(0xFFF5D79E); // butter cream — highlight / badges
const _pRose      = Color(0xFFF0B8A8); // soft coral-rose — attention
const _pPeach     = Color(0xFFF0A48C); // warm coral — hero / warmth
const _pPeriwinkle= Color(0xFFB4C2E0); // light periwinkle
const _pSeafoam   = Color(0xFF9FD4C0); // bright mint
const _pMutedRose = Color(0xFFE89988); // warm coral — destructive / urgent

/// Darkens a color by [amount] (0..1) in HSL space. Used to give pastel
/// icon tiles a richer, more saturated tint so white icons pop.
Color _darken(Color color, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

class HomeScreen extends StatefulWidget {
  final VoidCallback? onLoaded;
  const HomeScreen({super.key, this.onLoaded});
  @override
  State<HomeScreen> createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  UserProfile? _profile;
  List<MindMapModel> _recentMaps = [];
  bool _mapsLoading = true;
  List<Map<String, dynamic>> _deadlines = [];
  List<Map<String, dynamic>> _todayTasks = [];
  List<Map<String, dynamic>> _newsPosters = [];
  bool _loading = true;
  bool _deadlinesExpanded = false; // collapsed by default — shows only < 2-day items
  bool _quickExpanded = false;
  Map<String, int> _quickUsage = {}; // label → tap count, persisted in prefs

  // Lecturer-specific
  Map<String, dynamic>? _lecturerStats;
  List<Map<String, dynamic>> _teachingCourses = [];
  List<Map<String, dynamic>> _lecturerAssignments = [];
  bool _lecturerStatsLoading = true;
  List<Map<String, dynamic>> _recentReviewedMaps = [];
  bool _recentReviewedLoading = true;

  // Activity feed
  List<Map<String, dynamic>> _activityFeed = [];
  bool _activityFeedLoaded = false;

  final _newsPageCtrl = PageController(viewportFraction: 0.88);
  Timer? _newsAutoScroll;
  int _currentNewsPage = 0;

  final _bannerKey = GlobalKey();
  final _statsKey = GlobalKey();
  final _quickKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _load();
    _loadQuickUsage();
  }

  Future<void> _loadQuickUsage() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('quick_action_usage') ?? '{}';
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      if (mounted) setState(() => _quickUsage = decoded.map((k, v) => MapEntry(k, (v as num).toInt())));
    } catch (_) {}
  }

  Future<void> _incrementQuickUsage(String label) async {
    final updated = Map<String, int>.from(_quickUsage);
    updated[label] = (updated[label] ?? 0) + 1;
    setState(() => _quickUsage = updated);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('quick_action_usage', jsonEncode(updated));
  }

  @override
  void dispose() {
    _newsAutoScroll?.cancel();
    _newsPageCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      // Phase 1 — critical data only (fast, no N+1 calls)
      final results = await Future.wait([
        ApiService.getMe(),
        _fetchTodayTasks(),
        _fetchNews(),
      ]);
      if (!mounted) return;
      final me = results[0] as Map<String, dynamic>;
      final role = (me['role'] ?? 'student').toString();
      setState(() {
        _profile = UserProfile.fromApi(me);
        _todayTasks = (results[1] as List<Map<String, dynamic>>?) ?? [];
        _newsPosters = (results[2] as List<Map<String, dynamic>>?) ?? [];
        _loading = false;
      });
      _startNewsAutoScroll();
      // Dismiss splash as soon as profile is ready
      widget.onLoaded?.call();
      _checkTutorial();

      // Phase 2 — secondary data loaded after first paint (non-blocking)
      if (role == 'lecturer') {
        _fetchLecturerData();
        _fetchRecentReviewedMaps();
      } else {
        Future.wait([
          ApiService.getMaps(),
          _fetchDeadlines(role),
        ]).then((r) {
          if (!mounted) return;
          final mapsRaw = r[0] as List<dynamic>;
          setState(() {
            _recentMaps = mapsRaw
                .take(4)
                .map((m) => MindMapModel.fromApi(Map<String, dynamic>.from(m)))
                .toList();
            _deadlines = (r[1] as List<Map<String, dynamic>>?) ?? [];
            _mapsLoading = false;
          });
        }).catchError((_) {
          if (mounted) setState(() => _mapsLoading = false);
        });
      }

      // Phase 2b — activity feed (both roles, non-blocking)
      ApiService.getActivity(limit: 5).then((feed) {
        if (!mounted) return;
        setState(() {
          _activityFeed = feed.map((e) => Map<String, dynamic>.from(e)).toList();
          _activityFeedLoaded = true;
        });
      }).catchError((_) {
        if (mounted) setState(() => _activityFeedLoaded = true);
      });
    } catch (e) {
      debugPrint("[HomeScreen] _load error: $e");
      if (mounted) setState(() => _loading = false);
      widget.onLoaded?.call();
    }
  }

  /// Re-fetch only the user profile (no full _load) and update the banner avatar
  /// in place. Called by MainShell after a successful avatar upload in Profile.
  Future<void> refreshProfile() async {
    try {
      final me = await ApiService.getMe();
      if (!mounted) return;
      setState(() => _profile = UserProfile.fromApi(me));
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> _fetchNews() async {
    try {
      final raw = await ApiService.getHomepageContent();
      return raw.map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (_) {
      return [];
    }
  }

  void _startNewsAutoScroll() {
    _newsAutoScroll?.cancel();
    if (_newsPosters.length <= 1) return;
    _newsAutoScroll = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_newsPageCtrl.hasClients) return;
      _currentNewsPage = (_currentNewsPage + 1) % _newsPosters.length;
      _newsPageCtrl.animateToPage(
        _currentNewsPage,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
      );
    });
  }

  Future<List<Map<String, dynamic>>> _fetchDeadlines([String role = 'student']) async {
    try {
      if (role == "lecturer") return [];
      final courses = await ApiService.getEnrolledCourses();
      final List<Map<String, dynamic>> upcoming = [];
      final now = DateTime.now();
      for (final c in courses) {
        final cid = (c["id"] ?? "").toString();
        final cname = (c["course_name"] ?? "").toString();
        try {
          final assignments = await ApiService.getAssignments(cid);
          for (final a in assignments) {
            final map = Map<String, dynamic>.from(a);
            final deadlineStr = (map["deadline"] ?? "").toString();
            if (deadlineStr.isEmpty) continue;
            try {
              final deadline = DateTime.parse(deadlineStr);
              if (deadline.isAfter(now)) {
                upcoming.add({
                  "title": map["title"] ?? "",
                  "course": cname,
                  "deadline": deadline,
                });
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
      upcoming.sort((a, b) =>
          (a["deadline"] as DateTime).compareTo(b["deadline"] as DateTime));
      return upcoming.take(5).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> _fetchTodayTasks() async {
    try {
      final now = DateTime.now();
      final dateStr =
          "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
      final reminders = await ApiService.getReminders(dateStr);
      final todayItems = <Map<String, dynamic>>[];
      for (final r in reminders) {
        final map = Map<String, dynamic>.from(r);
        if ((map["date"] ?? "").toString().startsWith(dateStr)) {
          todayItems.add(map);
        }
      }
      return todayItems;
    } catch (_) {
      return [];
    }
  }

  /// Fetches teaching courses, assignment list, and analytics independently.
  /// Called after initial render so the UI shows immediately.
  Future<void> _fetchLecturerData() async {
    List<Map<String, dynamic>> courses = [];
    List<Map<String, dynamic>> assignments = [];
    Map<String, dynamic>? stats;

    await Future.wait([
      Future(() async {
        try {
          courses = (await ApiService.getTeachingCourses())
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        } catch (_) {}
      }),
      Future(() async {
        try {
          assignments = (await ApiService.getAssignmentsByLecturer())
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        } catch (_) {}
      }),
      Future(() async {
        try {
          stats = await ApiService.getAnalytics();
        } catch (_) {}
      }),
    ]);

    if (!mounted) return;
    setState(() {
      _teachingCourses   = courses;
      _lecturerAssignments = assignments;
      _lecturerStats     = stats;
      _lecturerStatsLoading = false;
    });
  }

  /// Fetches the lecturer's recently-viewed student maps (synced via backend).
  Future<void> _fetchRecentReviewedMaps() async {
    try {
      final raw = await ApiService.getRecentlyViewedMaps();
      if (!mounted) return;
      setState(() {
        _recentReviewedMaps = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _recentReviewedLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _recentReviewedLoading = false);
    }
  }

  void _checkTutorial() async {
    if (!mounted) return;
    final shouldShow = await TutorialPrefs.shouldShow();
    if (!shouldShow || !mounted) return;
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    final s = S.of(context);
    final overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => TutorialOverlay(
        steps: [
          TutorialStep(
              targetKey: _bannerKey,
              title: s.tutorialWelcomeTitle,
              description: s.tutorialWelcomeDesc,
              icon: Icons.dashboard_rounded),
          TutorialStep(
              targetKey: _statsKey,
              title: s.tutorialStatsTitle,
              description: s.tutorialStatsDesc,
              icon: Icons.bar_chart_rounded),
          TutorialStep(
              targetKey: _quickKey,
              title: s.tutorialQuickTitle,
              description: s.tutorialQuickDesc,
              icon: Icons.touch_app_rounded),
          TutorialStep(
              title: s.tutorialNavTitle,
              description: s.tutorialNavDesc,
              icon: Icons.navigation_rounded),
          TutorialStep(
              title: s.tutorialDoneTitle,
              description: s.tutorialDoneDesc,
              icon: Icons.check_circle_rounded),
        ],
        onComplete: () {
          entry.remove();
          TutorialPrefs.markComplete();
        },
      ),
    );
    overlay.insert(entry);
  }

  String _greeting(S s) {
    final h = DateTime.now().hour;
    if (h < 12) return s.greetingMorning;
    if (h < 17) return s.greetingAfternoon;
    return s.greetingEvening;
  }

  String _dateString() {
    final now = DateTime.now();
    const days = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return "${days[now.weekday - 1]}, ${now.day} ${months[now.month - 1]}";
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = S.of(context);

    if (_loading) return _buildSkeleton(c);

    final p = _profile;
    final isLecturer = p?.role == "lecturer";

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        color: _pSlate,
        onRefresh: _load,
        child: AnimationLimiter(
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              // Welcome Banner
              SliverToBoxAdapter(
                child: AnimationConfiguration.synchronized(
                  duration: const Duration(milliseconds: 400),
                  child: SlideAnimation(
                    verticalOffset: 30,
                    child: FadeInAnimation(child: _buildBanner(p, isLecturer, s)),
                  ),
                ),
              ),

              // ── Student-only: Attendance QR scan banner (above News) ─────
              if (!isLecturer)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 100),
                    child: _buildAttendanceBanner(),
                  ),
                ),

              // ── Lecturer: Start Attendance — directly below welcome banner ──
              if (isLecturer)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 100),
                    child: _buildLecturerAttendanceBanner(),
                  ),
                ),

              // News Carousel
              if (_newsPosters.isNotEmpty)
                SliverToBoxAdapter(
                  child: AnimationConfiguration.synchronized(
                    duration: const Duration(milliseconds: 400),
                    child: SlideAnimation(
                      verticalOffset: 30,
                      child: FadeInAnimation(child: _buildNewsCarousel()),
                    ),
                  ),
                ),

              // Stats Row
              SliverToBoxAdapter(
                child: AnimationConfiguration.synchronized(
                  duration: const Duration(milliseconds: 450),
                  child: SlideAnimation(
                    verticalOffset: 30,
                    child: FadeInAnimation(child: _buildStats(p, s)),
                  ),
                ),
              ),

              // Quick Actions
              SliverToBoxAdapter(
                child: FadeSlideIn(
                  delay: const Duration(milliseconds: 150),
                  child: _buildQuickActions(s),
                ),
              ),

              // Today's Progress
              if (_todayTasks.isNotEmpty)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 200),
                    child: _buildTodayProgress(s),
                  ),
                ),

              // ── Lecturer-only: Pending Submissions card ───────────────────
              if (isLecturer)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 220),
                    child: _buildPendingSubmissions(),
                  ),
                ),

              // ── Lecturer-only: Teaching Courses horizontal scroll ─────────
              if (isLecturer)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 240),
                    child: _buildTeachingCourses(),
                  ),
                ),

              // ── Lecturer-only: AI Tools (Learning Plan + AI Import) ──────────
              if (isLecturer)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 255),
                    child: _buildLecturerAiTools(),
                  ),
                ),

              // Upcoming Deadlines (students only)
              if (!isLecturer && _deadlines.isNotEmpty)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 225),
                    child: _buildDeadlines(s),
                  ),
                ),

              // Recent Reviewed Maps (lecturer) — skeleton while loading
              if (isLecturer && (_recentReviewedLoading || _recentReviewedMaps.isNotEmpty))
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 260),
                    child: _recentReviewedLoading
                        ? _buildRecentReviewedSkeleton()
                        : _buildRecentReviewedMaps(),
                  ),
                ),

              // Recent Mind Maps (students) — skeleton while loading
              if (!isLecturer && (_mapsLoading || _recentMaps.isNotEmpty))
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 260),
                    child: _mapsLoading
                        ? _buildRecentMapsSkeleton(s)
                        : _buildRecentMaps(s),
                  ),
                ),

              // Recent Badges (students only)
              if ((p?.role != 'lecturer' && p?.role != 'admin') &&
                  (p?.badges.isNotEmpty ?? false))
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 300),
                    child: _buildBadges(p!, s),
                  ),
                ),

              // Activity Feed (last 5 events)
              if (_activityFeedLoaded)
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 320),
                    child: _buildActivityFeed(s),
                  ),
                ),

              // Tip of the Day
              SliverToBoxAdapter(child: _buildTip(s)),

              // Bottom spacing for nav bar
              const SliverToBoxAdapter(
                child: SizedBox(height: FloatingNavBar.kTotalHeight + 16),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Skeleton Loading ──
  Widget _buildSkeleton(AppColorScheme c) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Padding(
        padding: const EdgeInsets.fromLTRB(20, 60, 20, 16),
        child: Column(
          children: [
            const ShimmerBox(height: 130, borderRadius: 24),
            const SizedBox(height: 20),
            Row(children: const [
              Expanded(child: ShimmerBox(height: 90, borderRadius: 16)),
              SizedBox(width: 12),
              Expanded(child: ShimmerBox(height: 90, borderRadius: 16)),
              SizedBox(width: 12),
              Expanded(child: ShimmerBox(height: 90, borderRadius: 16)),
            ]),
            const SizedBox(height: 20),
            const ShimmerBox(height: 80, borderRadius: 16),
            const SizedBox(height: 16),
            const ShimmerBox(height: 100, borderRadius: 16),
          ],
        ),
      ),
    );
  }

  // ── Welcome Banner ──
  Widget _buildBanner(UserProfile? p, bool isLecturer, S s) {
    final role = p?.role ?? 'student';
    final accent = role == 'lecturer' ? _pLavender : (role == 'admin' ? _pPeach : _pSlate);
    // Cozy warm gradients: sunrise-ish for student, mauve-rose for lecturer, terracotta-cream for admin
    final gradientPair = role == 'lecturer'
        ? [_pLavender, _pRose]
        : role == 'admin'
            ? [_pPeach, _pSand]
            : [_pSlate, _pPeach];
    final points = p?.points ?? 0;
    // Level: every 100 points = 1 level
    final level = (points ~/ 100) + 1;
    final xpProgress = (points % 100) / 100.0;

    return Container(
      key: _bannerKey,
      margin: const EdgeInsets.fromLTRB(20, 56, 20, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.30),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Campus Background Image
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Image.asset(
                'assets/patterns/welcome_banner_ipg_melaka.png',
                fit: BoxFit.cover,
              ),
            ),
          ),
          // Gradient Theme Overlay (keeps text readable while showing background)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                gradient: LinearGradient(
                  colors: [
                    gradientPair[0].withValues(alpha: 0.92),
                    gradientPair[1].withValues(alpha: 0.92),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
          // Readability scrim — darkens bottom half for text contrast
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.0),
                    Colors.black.withOpacity(0.28),
                  ],
                  stops: const [0.35, 1.0],
                ),
              ),
            ),
          ),
          // Decorative background orb
          Positioned(
            top: -30, right: -30,
            child: Container(
              width: 130, height: 130,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.07),
              ),
            ),
          ),
          Positioned(
            bottom: -20, right: 60,
            child: Container(
              width: 70, height: 70,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.05),
              ),
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _greeting(s),
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.95),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              shadows: const [
                                Shadow(
                                  color: Color(0x66000000),
                                  blurRadius: 6,
                                  offset: Offset(0, 1),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            p?.displayName ?? "User",
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.3,
                              shadows: [
                                Shadow(
                                  color: Color(0x80000000),
                                  blurRadius: 8,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 5),
                          Text(
                            _dateString(),
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.90),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              shadows: const [
                                Shadow(
                                  color: Color(0x66000000),
                                  blurRadius: 5,
                                  offset: Offset(0, 1),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildHeaderIconBtn(
                              Icons.chat_bubble_rounded,
                              () => Navigator.push(context, MaterialPageRoute(
                                  builder: (_) => const MessagingScreen())),
                            ),
                            const SizedBox(width: 6),
                            _buildHeaderIconBtn(
                              Icons.notifications_rounded,
                              () => Navigator.push(context, MaterialPageRoute(
                                  builder: (_) => const NotificationsScreen())),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        AvatarWidget(
                          imageUrl: p?.avatarUrl,
                          name: p?.displayName ?? 'U',
                          size: 52,
                          role: role,
                          showBorder: true,
                        ),
                      ],
                    ),
                  ],
                ),
                // XP / Level bar (students only)
                if (!isLecturer && role != 'admin') ...[
                  const SizedBox(height: 16),
                  Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.28),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.35),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        'Lv.$level',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: xpProgress),
                          duration: const Duration(milliseconds: 1200),
                          curve: Curves.easeOutCubic,
                          builder: (_, val, __) => LinearProgressIndicator(
                            value: val,
                            minHeight: 6,
                            backgroundColor: Colors.black.withOpacity(0.25),
                            valueColor: const AlwaysStoppedAnimation(Colors.white),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '$points XP',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.95),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        shadows: const [
                          Shadow(
                            color: Color(0x66000000),
                            blurRadius: 4,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                ],
                if (_getMotivationalLine(p, s) != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _getMotivationalLine(p, s)!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderIconBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.20),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }

  String? _getMotivationalLine(UserProfile? p, S s) {
    if (p == null) return null;
    final isLecturer = p.role == 'lecturer';
    if (!isLecturer && p.streak > 0) return "🔥 ${p.streak}-day streak!";
    final done = _todayTasks.where((t) => t["is_completed"] == true).length;
    final total = _todayTasks.length;
    if (total > 0) return "📋 ${s.tasksCompleted(done, total)}";
    return null;
  }

  // ── News Carousel ──
  Widget _buildNewsCarousel() {
    final c = context.colors;
    return Column(
      children: [
        const SizedBox(height: 8),
        SizedBox(
          height: 150,
          child: PageView.builder(
            controller: _newsPageCtrl,
            itemCount: _newsPosters.length,
            onPageChanged: (i) => setState(() => _currentNewsPage = i),
            itemBuilder: (_, i) {
              final item = _newsPosters[i];
              final rawImageUrl =
                  (item['imageUrl'] ?? item['image_url'] ?? '').toString();
              final imageUrl = rawImageUrl.isNotEmpty && !rawImageUrl.startsWith('http')
                  ? 'http://10.0.2.2:8000$rawImageUrl'
                  : rawImageUrl;
              final title = (item['title'] ?? '').toString();
              final content = (item['content'] ?? '').toString();
              final hasImage = imageUrl.isNotEmpty;

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: GestureDetector(
                  onTap: () {
                    if (hasImage) _showFullScreenImage(context, imageUrl, title);
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: hasImage
                          ? null
                          : LinearGradient(
                              colors: [
                                _pSlate.withOpacity(0.3),
                                _pLavender.withOpacity(0.2),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                      image: hasImage
                          ? DecorationImage(
                              image: NetworkImage(imageUrl),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withOpacity(0.75),
                          ],
                        ),
                      ),
                      padding: const EdgeInsets.all(18),
                      alignment: Alignment.bottomLeft,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (content.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              content,
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.8),
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (_newsPosters.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              _newsPosters.length,
              (i) => AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: _currentNewsPage == i ? 22 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _currentNewsPage == i
                      ? _pSlate
                      : c.textMuted.withOpacity(0.25),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 8),
      ],
    );
  }

  void _showFullScreenImage(BuildContext ctx, String imageUrl, String title) {
    Navigator.of(ctx).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (context, animation, _) => FadeTransition(
          opacity: animation,
          child: Scaffold(
            backgroundColor: Colors.black,
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
              title: Text(title,
                  style: const TextStyle(color: Colors.white, fontSize: 16)),
            ),
            body: InteractiveViewer(
              minScale: 0.5,
              maxScale: 4.0,
              child: Center(
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.contain,
                  loadingBuilder: (_, child, progress) {
                    if (progress == null) return child;
                    return Center(
                      child: CircularProgressIndicator(
                        value: progress.expectedTotalBytes != null
                            ? progress.cumulativeBytesLoaded /
                                progress.expectedTotalBytes!
                            : null,
                        color: _pSlate,
                      ),
                    );
                  },
                  errorBuilder: (_, __, ___) => const Center(
                    child: Icon(Icons.broken_image,
                        color: Colors.white54, size: 64),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Stats Row (lecturer only — student stats live in the header XP bar) ──
  Widget _buildStats(UserProfile? p, S s) {
    final isLecturer = p?.role == 'lecturer';
    if (!isLecturer) return const SizedBox.shrink();
    return Padding(
      key: _statsKey,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        children: [
          Row(
            children: [
                    Expanded(
                      child: StatCard(
                        icon: Icons.school_rounded,
                        value: '${_lecturerStats?['total_courses'] ?? _teachingCourses.length}',
                        label: 'Courses',
                        accentColor: _pLavender,
                        loading: _lecturerStatsLoading,
                        onTap: () => Navigator.push(context,
                            MaterialPageRoute(builder: (_) => const SubjectsScreen())),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: StatCard(
                        icon: Icons.people_rounded,
                        value: '${_lecturerStats?['total_students'] ?? 0}',
                        label: 'Students',
                        accentColor: _pLavender,
                        loading: _lecturerStatsLoading,
                        onTap: () => Navigator.push(context,
                            MaterialPageRoute(builder: (_) => const LecturerAnalyticsScreen())),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: StatCard(
                        icon: Icons.assignment_rounded,
                        value: '${_lecturerAssignments.length}',
                        label: 'Tasks Set',
                        accentColor: _pSand,
                        loading: _lecturerStatsLoading,
                        onTap: () => Navigator.push(context,
                            MaterialPageRoute(builder: (_) => const SubjectsScreen())),
                      ),
                    ),
                  ],
          ),
        ],
      ),
    );
  }

  // ── Today's Progress ──
  Widget _buildTodayProgress(S s) {
    final c = context.colors;
    final done = _todayTasks.where((t) => t["is_completed"] == true).length;
    final total = _todayTasks.length;
    final progress = total > 0 ? done / total : 0.0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GlassCard(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _pSage.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.task_alt_rounded,
                      color: _pSage, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    s.todaysTasks,
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                BadgeChip(
                  label: s.tasksCompleted(done, total),
                  color: _pSage,
                ),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: progress),
                duration: const Duration(milliseconds: 1000),
                curve: Curves.easeOutCubic,
                builder: (_, val, __) => LinearProgressIndicator(
                  value: val,
                  minHeight: 8,
                  backgroundColor: c.surfaceElevated,
                  valueColor:
                      const AlwaysStoppedAnimation(_pSage),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Upcoming Deadlines ──
  Widget _buildDeadlines(S s) {
    final c   = context.colors;
    final now = DateTime.now();

    // Split: urgent = within 48 h (< 2 days), later = everything else
    final urgent = _deadlines
        .where((d) => (d['deadline'] as DateTime).difference(now).inHours < 48)
        .toList();
    final later = _deadlines
        .where((d) => (d['deadline'] as DateTime).difference(now).inHours >= 48)
        .toList();

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: s.upcomingDeadlines,
            icon: Icons.schedule_rounded,
          ),
          const SizedBox(height: 4),

          // ── Always-visible: urgent items (< 2 days) ──
          if (urgent.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text(
                'No deadlines in the next 2 days',
                style: TextStyle(color: c.textMuted, fontSize: 13),
              ),
            )
          else
            ...urgent.map((d) => _buildDeadlineCard(d, c, s)),

          // ── Collapsible: later items (≥ 2 days) ──
          if (later.isNotEmpty) ...[
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                HapticFeedback.lightImpact();
                setState(() => _deadlinesExpanded = !_deadlinesExpanded);
              },
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Row(
                  children: [
                    AnimatedRotation(
                      turns:    _deadlinesExpanded ? 0.5 : 0.0,
                      duration: const Duration(milliseconds: 220),
                      child: Icon(Icons.expand_more_rounded,
                          size: 18, color: c.textSecondary),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _deadlinesExpanded
                          ? 'Show less'
                          : '${later.length} more due in 2+ days',
                      style: TextStyle(
                        color:      c.textSecondary,
                        fontSize:   12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            AnimatedSize(
              duration:  const Duration(milliseconds: 260),
              curve:     Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              child: _deadlinesExpanded
                  ? Column(children: later.map((d) => _buildDeadlineCard(d, c, s)).toList())
                  : const SizedBox.shrink(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDeadlineCard(Map<String, dynamic> d, AppColorScheme c, S s) {
    final deadline = d['deadline'] as DateTime;
    final diff     = deadline.difference(DateTime.now());
    final isUrgent  = diff.inHours < 24;
    final isWarning = diff.inDays  < 3;
    final urgencyColor = isUrgent
        ? _pMutedRose
        : isWarning ? _pSand : _pSlate;
    final timeText = diff.inDays > 0
        ? s.daysLeft(diff.inDays)
        : s.hoursLeft(diff.inHours.clamp(1, 24));

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 4,
              height: 40,
              decoration: BoxDecoration(
                color:         urgencyColor,
                borderRadius:  BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    d['title'].toString(),
                    style: TextStyle(
                      color:      c.textPrimary,
                      fontSize:   14,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    d['course'].toString(),
                    style: TextStyle(color: c.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
            BadgeChip(label: timeText, color: urgencyColor),
          ],
        ),
      ),
    );
  }

  // ── Quick Actions ──
  // ── Attendance QR banner ─────────────────────────────────────────────────
  Widget _buildAttendanceBanner() {
    final c = context.colors;
    final isDark = context.isDark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.mediumImpact();
          Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => const AttendanceCheckinScreen()),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF14b8a6), Color(0xFF10b981)],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF14b8a6).withOpacity(isDark ? 0.35 : 0.28),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              // Pulsing QR icon box
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.20),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: const Icon(
                  Icons.qr_code_scanner_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Scan Attendance QR',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Tap to open camera & check in',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.82),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.arrow_forward_ios_rounded,
                    color: Colors.white, size: 14),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActions(S s) {
    final isLecturer = _profile?.role == 'lecturer';

    // ── Rules:
    // • Bottom nav already owns: Home, Courses, Schedule/Calendar, Maps, Profile
    // • Quick Access must NOT duplicate those — only surface things NOT reachable
    //   with one tap from the bottom bar.
    // • Cap: exactly 8 items (2 clean rows × 4 columns). Nothing less is "quick".
    final actions = <_QuickAction>[
      if (!isLecturer) ...[
        // Row 1
        _QuickAction('Grades',         Icons.grade_rounded,               _pSand,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GradesScreen()))),
        _QuickAction('Reflection',     Icons.psychology_rounded,           _pRose,
            () => WeeklyReflectionModal.show(context)),
        _QuickAction(s.examPlan,       Icons.edit_note_rounded,            _pSlate,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiExamPlannerScreen()))),
        // Row 2
        _QuickAction(s.aiMaterials,    Icons.auto_awesome_rounded,         _pLavender,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AiStudyMaterialsScreen()))),
        _QuickAction('Mind Maps',      Icons.account_tree_rounded,         _pSeafoam,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MindMapsScreen()))),
        _QuickAction('Achievements',   Icons.emoji_events_rounded,         _pPeach,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AchievementsScreen()))),
      ],
      if (isLecturer) ...[
        // Row 1 — core lecturer tasks (Class Management lives in the bottom nav)
        _QuickAction('Review Maps',   Icons.rate_review_rounded,          _pSeafoam,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReviewMapsScreen()))),
        _QuickAction('Analytics',     Icons.bar_chart_rounded,            _pPeriwinkle,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LecturerAnalyticsScreen()))),
        _QuickAction('Announcements', Icons.campaign_rounded,             _pPeach,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AnnouncementsScreen()))),
        _QuickAction('Gradebook',     Icons.grading_rounded,              _pSand,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SubjectsScreen()))),
        // Row 2
        _QuickAction('Quizzes',       Icons.quiz_rounded,                 _pRose,
            () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const QuizCoursePickerScreen(),
                  ),
                )),
        _QuickAction('Badges',        Icons.workspace_premium_rounded,    _pSand,
            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ManageBadgesScreen()))),
      ],
    ];

    // Stable sort by usage count descending — ties keep original order
    final indexed = actions.asMap().entries.toList()
      ..sort((a, b) {
        final diff = (_quickUsage[b.value.label] ?? 0)
            .compareTo(_quickUsage[a.value.label] ?? 0);
        return diff != 0 ? diff : a.key.compareTo(b.key);
      });
    final sorted = indexed.map((e) => e.value).toList();

    const kVisible = 3; // top row always shown
    final top = sorted.take(kVisible).toList();
    final rest = sorted.skip(kVisible).toList();
    final c = context.colors;

    return Padding(
      key: _quickKey,
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: s.quickAccess, icon: Icons.grid_view_rounded),
          const SizedBox(height: 8),
          // Top 3 — always visible
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.88,
            children: top.map(_buildQuickActionItem).toList(),
          ),
          // Remaining — collapsed by default
          if (rest.isNotEmpty) ...[
            ClipRect(
              child: AnimatedAlign(
                alignment: Alignment.topCenter,
                heightFactor: _quickExpanded ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 320),
                curve: Curves.easeInOut,
                child: Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.88,
                    children: rest.map(_buildQuickActionItem).toList(),
                  ),
                ),
              ),
            ),
            // Show more / less toggle
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _quickExpanded = !_quickExpanded);
                },
                child: Container(
                  height: 36,
                  decoration: BoxDecoration(
                    color: c.surfaceElevated,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _quickExpanded ? 'Show less' : 'Show ${rest.length} more',
                        style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 4),
                      AnimatedRotation(
                        turns: _quickExpanded ? 0.5 : 0,
                        duration: const Duration(milliseconds: 280),
                        child: Icon(Icons.keyboard_arrow_down_rounded,
                            color: c.textMuted, size: 16),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildQuickActionItem(_QuickAction action) {
    final c = context.colors;
    final isDark = context.isDark;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        _incrementQuickUsage(action.label);
        action.onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: action.color.withOpacity(isDark ? 0.14 : 0.16),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: action.color.withOpacity(isDark ? 0.45 : 0.55),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: action.color.withOpacity(isDark ? 0.18 : 0.22),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _darken(action.color, 0.06),
                    _darken(action.color, 0.22),
                  ],
                ),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: Colors.white.withOpacity(0.35), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: _darken(action.color, 0.18).withOpacity(0.60),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Icon(action.icon, color: Colors.white, size: 24),
            ),
            const SizedBox(height: 8),
            Text(
              action.label,
              style: TextStyle(
                color: c.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                height: 1.2,
                letterSpacing: 0.1,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ── Recent Mind Maps ──
  Widget _buildRecentMaps(S s) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: s.recentMaps,
            actionLabel: s.viewAll,
            onAction: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const MindMapsScreen()),
            ),
            icon: Icons.account_tree_rounded,
          ),
          const SizedBox(height: 4),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: _recentMaps.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final m = _recentMaps[i];
                final hue = (m.title.hashCode.abs() % 360).toDouble();
                final mapColor = HSLColor.fromAHSL(1.0, hue, 0.55, 0.55).toColor();
                return OpenContainerWrapper(
                  openColor: c.surface,
                  openBuilder: (ctx, _) => MindMapViewerScreen(mindMap: m),
                  closedBuilder: (ctx, openFn) => GestureDetector(
                    onTap: openFn,
                    child: Container(
                      width: 155,
                      decoration: BoxDecoration(
                        color: c.surfaceCard.withOpacity(context.isDark ? 0.5 : 0.85),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: c.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                            child: Container(
                              height: 78,
                              width: double.infinity,
                              color: c.surfaceInput,
                              child: MapThumbnail(map: m, accent: mapColor),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  m.title,
                                  style: TextStyle(
                                    color: c.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(Icons.circle, size: 5, color: mapColor),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${m.nodes.length} nodes',
                                      style: TextStyle(color: c.textMuted, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Recent Mind Maps Skeleton ──
  Widget _buildRecentMapsSkeleton(S s) {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: s.recentMaps,
            actionLabel: s.viewAll,
            onAction: () {},
            icon: Icons.account_tree_rounded,
          ),
          const SizedBox(height: 4),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: 3,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, __) => SizedBox(
                width: 155,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top gradient area skeleton
                    ShimmerBox(height: 78, borderRadius: 18),
                    const SizedBox(height: 10),
                    // Title skeleton
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: ShimmerBox(height: 14, width: 110, borderRadius: 6),
                    ),
                    const SizedBox(height: 8),
                    // Subtitle skeleton
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: ShimmerBox(height: 10, width: 70, borderRadius: 6),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Lecturer: Recent Reviewed Maps ──
  Widget _buildRecentReviewedMaps() {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'Recent Reviewed Maps',
            actionLabel: 'View all',
            onAction: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ReviewMapsScreen()),
            ),
            icon: Icons.history_rounded,
          ),
          const SizedBox(height: 4),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: _recentReviewedMaps.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final m = _recentReviewedMaps[i];
                final id = (m['id'] ?? '').toString();
                final title = (m['title'] ?? 'Untitled Map').toString();
                final owner = (m['owner_email'] ?? m['ownerEmail'] ?? '').toString();
                final viewedAt = (m['viewed_at'] ?? m['viewedAt'] ?? '').toString();
                final thumb = (m['thumbnail'] ?? '').toString();
                final thumbBytes = decodeMapThumbnail(thumb);
                final hue = (title.hashCode.abs() % 360).toDouble();
                final accent = HSLColor.fromAHSL(1.0, hue, 0.35, 0.62).toColor();

                return GestureDetector(
                  onTap: () => _openReviewedMap(id),
                  child: Container(
                    width: 155,
                    decoration: BoxDecoration(
                      color: c.surfaceCard.withOpacity(context.isDark ? 0.5 : 0.85),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: c.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                          child: Container(
                            height: 78,
                            width: double.infinity,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [accent.withOpacity(0.28), accent.withOpacity(0.12)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            child: thumbBytes != null
                                ? Image.memory(thumbBytes, fit: BoxFit.cover)
                                : Center(
                                    child: Icon(Icons.account_tree_rounded, color: accent, size: 28),
                                  ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                style: TextStyle(
                                  color: c.textPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 3),
                              if (owner.isNotEmpty)
                                Text(
                                  owner,
                                  style: TextStyle(color: c.textMuted, fontSize: 10.5),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  Icon(Icons.history_rounded, size: 11, color: c.textMuted),
                                  const SizedBox(width: 3),
                                  Expanded(
                                    child: Text(
                                      _formatViewedAt(viewedAt),
                                      style: TextStyle(color: c.textMuted, fontSize: 10.5),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentReviewedSkeleton() {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'Recent Reviewed Maps',
            actionLabel: 'View all',
            onAction: () {},
            icon: Icons.history_rounded,
          ),
          const SizedBox(height: 4),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: 3,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, __) => SizedBox(
                width: 155,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerBox(height: 78, borderRadius: 18),
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: ShimmerBox(height: 14, width: 110, borderRadius: 6),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: ShimmerBox(height: 10, width: 70, borderRadius: 6),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatViewedAt(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return 'Recently';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${d.day}/${d.month}/${d.year}';
  }

  Future<void> _openReviewedMap(String id) async {
    if (id.isEmpty) return;
    try {
      final raw = await ApiService.getMap(id);
      final map = MindMapModel.fromApi(Map<String, dynamic>.from(raw));
      if (!mounted) return;
      await ApiService.markMapViewed(id).catchError((_) {});
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => MindMapViewerScreen(mindMap: map)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Map no longer available')),
      );
    }
  }

  // ── Badges ──
  Widget _buildBadges(UserProfile p, S s) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: s.recentBadges,
            actionLabel: s.viewAll,
            onAction: () => Navigator.push(
              context,
              PageRouteBuilder(
                transitionDuration: const Duration(milliseconds: 280),
                reverseTransitionDuration: const Duration(milliseconds: 280),
                pageBuilder: (_, __, ___) => const AchievementsScreen(),
                transitionsBuilder: (_, anim, secAnim, child) =>
                    SharedAxisTransition(
                  animation: anim,
                  secondaryAnimation: secAnim,
                  transitionType: SharedAxisTransitionType.horizontal,
                  child: child,
                ),
              ),
            ),
            icon: Icons.emoji_events_rounded,
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 108,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: p.badges.take(6).length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, i) {
                final bid = p.badges.take(6).elementAt(i);
                final info = BadgeUtils.getInfo(bid);
                final color = info?.gradient.colors.first ?? _pSand;
                return Container(
                  width: 100,
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                  decoration: BoxDecoration(
                    color: c.surfaceCard.withOpacity(context.isDark ? 0.5 : 0.85),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: color.withOpacity(0.25)),
                    boxShadow: [
                      BoxShadow(
                        color: color.withOpacity(0.12),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (info != null)
                        Container(
                          width: 46,
                          height: 46,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            gradient: info.gradient,
                            borderRadius: BorderRadius.circular(13),
                            boxShadow: [
                              BoxShadow(
                                color: color.withOpacity(0.30),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(13),
                            child: BadgeIconWidget(badge: info, size: 28, animated: true, earned: true),
                          ),
                        )
                      else
                        Text(BadgeUtils.emoji(bid), style: const TextStyle(fontSize: 26)),
                      const SizedBox(height: 7),
                      Text(
                        BadgeUtils.displayName(bid),
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.1,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Lecturer: AI Tools Section ─────────────────────────────────────────────
  Widget _buildLecturerAiTools() {
    final c = context.colors;
    final tools = [
      _LecturerAiTool(
        icon: Icons.auto_awesome_rounded,
        label: 'Learning Plan',
        subtitle: 'Generate RPP with AI',
        color: _pLavender,
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const LearningPlanScreen()),
        ),
      ),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: 'AI Tools', icon: Icons.psychology_rounded),
          const SizedBox(height: 10),
          Row(
            children: tools.map((tool) {
              return Expanded(
                child: Padding(
                  padding: tools.indexOf(tool) == 0
                      ? const EdgeInsets.only(right: 6)
                      : const EdgeInsets.only(left: 6),
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      tool.onTap();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: c.surfaceCard.withOpacity(context.isDark ? 0.5 : 0.85),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: tool.color.withOpacity(0.25)),
                        boxShadow: context.isDark
                            ? null
                            : [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [tool.color, tool.color.withOpacity(0.65)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: tool.color.withOpacity(0.30),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: Icon(tool.icon, color: Colors.white, size: 20),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  tool.label,
                                  style: TextStyle(
                                    color: c.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  tool.subtitle,
                                  style: TextStyle(color: c.textMuted, fontSize: 10),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ── Lecturer: Start Attendance Banner ──────────────────────────────────────
  Widget _buildLecturerAttendanceBanner() {
    final isDark = context.isDark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.mediumImpact();
          _startAttendanceFlow();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF7C3AED), Color(0xFF4F46E5)],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF7C3AED).withOpacity(isDark ? 0.30 : 0.22),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.20),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.qr_code_rounded,
                    color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Start Attendance Session',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.2,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Select a course to generate QR code',
                      style: TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded,
                  color: Colors.white70, size: 13),
            ],
          ),
        ),
      ),
    );
  }

  // ── Start Attendance flow (course picker → session sheet → detail) ─────────
  Future<void> _startAttendanceFlow() async {
    // Always fetch fresh courses so the picker is never empty due to stale state.
    List<Map<String, dynamic>> courses = _teachingCourses;
    try {
      final fresh = (await ApiService.getTeachingCourses())
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      courses = fresh;
      if (mounted) {
        setState(() {
          _teachingCourses = fresh;
        });
      }
    } catch (_) {
      // Fall back to the cached list if the fetch fails.
    }

    if (courses.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: const Text(
                'No courses found — create a course before starting attendance.'),
            backgroundColor: _pRose),
      );
      return;
    }

    Map<String, dynamic>? selectedCourse;
    await showGlassBottomSheet<void>(
      context: context,
      builder: (ctx) {
        final c = context.colors;
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [
                        _pLavender.withOpacity(0.25),
                        _pSlate.withOpacity(0.18),
                      ]),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _pLavender.withOpacity(0.3)),
                    ),
                    child: const Icon(Icons.fact_check_rounded,
                        color: _pLavender, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Start Attendance Session',
                            style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 15,
                                fontWeight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        Text('Pick a course to generate a QR',
                            style: TextStyle(
                                color: c.textSecondary, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(ctx).size.height * 0.5,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const BouncingScrollPhysics(),
                  itemCount: courses.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final course = courses[i];
                    final name =
                        (course['course_name'] ?? 'Course').toString();
                    final code = (course['course_code'] ?? '').toString();
                    final enrolled = (course['enrolled_count'] ??
                        (course['enrolled_students'] as List?)?.length ??
                        0) as int;
                    return InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () {
                        HapticFeedback.selectionClick();
                        selectedCourse = course;
                        Navigator.pop(ctx);
                      },
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: context.isDark
                              ? Colors.white.withOpacity(0.04)
                              : Colors.white.withOpacity(0.7),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: c.border.withOpacity(0.5)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(colors: [
                                  _pLavender.withOpacity(0.25),
                                  _pSlate.withOpacity(0.18),
                                ]),
                                borderRadius: BorderRadius.circular(11),
                                border: Border.all(
                                    color: _pLavender.withOpacity(0.3)),
                              ),
                              child: const Icon(Icons.class_rounded,
                                  color: _pLavender, size: 18),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          color: c.textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 2),
                                  Text(
                                    code.isNotEmpty
                                        ? '$code · $enrolled student${enrolled == 1 ? "" : "s"}'
                                        : '$enrolled student${enrolled == 1 ? "" : "s"}',
                                    style: TextStyle(
                                        color: c.textMuted, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            Icon(Icons.arrow_forward_ios_rounded,
                                color: c.textMuted, size: 13),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );

    if (selectedCourse == null || !mounted) return;
    await _createAttendanceSessionFor(selectedCourse!);
  }

  Future<void> _createAttendanceSessionFor(Map<String, dynamic> course) async {
    final courseId = (course['id'] ?? course['course_id'])?.toString() ?? '';
    final courseName = (course['course_name'] ?? 'Course').toString();
    if (courseId.isEmpty) return;

    final titleCtrl = TextEditingController(
        text: 'Session ${DateTime.now().toIso8601String().split("T")[0]}');
    DateTime selectedDate = DateTime.now();
    // Default start = current hour, end = start + 1 hour
    final _now = TimeOfDay.now();
    TimeOfDay startTime = _now;
    TimeOfDay endTime = TimeOfDay(
      hour: (_now.hour + 1) % 24,
      minute: _now.minute,
    );
    bool submitted = false;

    String _fmtTOD(TimeOfDay t) =>
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

    await showGlassBottomSheet<void>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setSheetState) {
          final c = context.colors;
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 12,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [
                          _pLavender.withOpacity(0.25),
                          _pSlate.withOpacity(0.18),
                        ]),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: _pLavender.withOpacity(0.3)),
                      ),
                      child: const Icon(Icons.qr_code_rounded,
                          color: _pLavender, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('New Attendance Session',
                              style: TextStyle(
                                  color: c.textPrimary,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(courseName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  color: c.textSecondary, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text('Title',
                    style: TextStyle(
                        color: c.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5)),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: context.isDark
                        ? Colors.white.withOpacity(0.04)
                        : Colors.white.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.border.withOpacity(0.5)),
                  ),
                  child: TextField(
                    controller: titleCtrl,
                    autofocus: true,
                    style: TextStyle(color: c.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Session title',
                      hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
                      prefixIcon: const Icon(Icons.title_rounded,
                          color: _pLavender, size: 18),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 4, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text('Date',
                    style: TextStyle(
                        color: c.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5)),
                const SizedBox(height: 6),
                InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: selectedDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                      builder: (ctx, child) => Theme(
                        data: Theme.of(ctx).copyWith(
                          colorScheme: Theme.of(ctx).colorScheme.copyWith(
                                primary: _pLavender,
                                onPrimary: Colors.white,
                              ),
                        ),
                        child: child!,
                      ),
                    );
                    if (picked != null) {
                      setSheetState(() => selectedDate = picked);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 14),
                    decoration: BoxDecoration(
                      color: context.isDark
                          ? Colors.white.withOpacity(0.04)
                          : Colors.white.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: c.border.withOpacity(0.5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_today_rounded,
                            color: _pLavender, size: 16),
                        const SizedBox(width: 10),
                        Text(
                          selectedDate.toIso8601String().split('T')[0],
                          style:
                              TextStyle(color: c.textPrimary, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Start time',
                              style: TextStyle(
                                  color: c.textSecondary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.5)),
                          const SizedBox(height: 6),
                          InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: ctx,
                                initialTime: startTime,
                                builder: (ctx, child) => Theme(
                                  data: Theme.of(ctx).copyWith(
                                    colorScheme:
                                        Theme.of(ctx).colorScheme.copyWith(
                                              primary: _pLavender,
                                              onPrimary: Colors.white,
                                            ),
                                  ),
                                  child: child!,
                                ),
                              );
                              if (picked != null) {
                                setSheetState(() {
                                  startTime = picked;
                                  // Keep end after start: if end <= start, bump end = start + 1h
                                  final startMin =
                                      picked.hour * 60 + picked.minute;
                                  final endMin =
                                      endTime.hour * 60 + endTime.minute;
                                  if (endMin <= startMin) {
                                    final newEnd = (startMin + 60) % (24 * 60);
                                    endTime = TimeOfDay(
                                        hour: newEnd ~/ 60,
                                        minute: newEnd % 60);
                                  }
                                });
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 14),
                              decoration: BoxDecoration(
                                color: context.isDark
                                    ? Colors.white.withOpacity(0.04)
                                    : Colors.white.withOpacity(0.7),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: c.border.withOpacity(0.5)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.schedule_rounded,
                                      color: _pLavender, size: 16),
                                  const SizedBox(width: 10),
                                  Text(_fmtTOD(startTime),
                                      style: TextStyle(
                                          color: c.textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('End time',
                              style: TextStyle(
                                  color: c.textSecondary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.5)),
                          const SizedBox(height: 6),
                          InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: ctx,
                                initialTime: endTime,
                                builder: (ctx, child) => Theme(
                                  data: Theme.of(ctx).copyWith(
                                    colorScheme:
                                        Theme.of(ctx).colorScheme.copyWith(
                                              primary: _pLavender,
                                              onPrimary: Colors.white,
                                            ),
                                  ),
                                  child: child!,
                                ),
                              );
                              if (picked != null) {
                                setSheetState(() => endTime = picked);
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 14),
                              decoration: BoxDecoration(
                                color: context.isDark
                                    ? Colors.white.withOpacity(0.04)
                                    : Colors.white.withOpacity(0.7),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: c.border.withOpacity(0.5)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.timer_off_rounded,
                                      color: _pLavender, size: 16),
                                  const SizedBox(width: 10),
                                  Text(_fmtTOD(endTime),
                                      style: TextStyle(
                                          color: c.textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Text('Duration',
                        style: TextStyle(
                            color: c.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        children: [30, 60, 90, 120, 180].map((mins) {
                          final startMin =
                              startTime.hour * 60 + startTime.minute;
                          final endMin = endTime.hour * 60 + endTime.minute;
                          final active = (endMin - startMin) == mins;
                          final label = mins < 60
                              ? '${mins}m'
                              : mins % 60 == 0
                                  ? '${mins ~/ 60}h'
                                  : '${mins ~/ 60}h${mins % 60}m';
                          return GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setSheetState(() {
                                final newEnd =
                                    (startMin + mins) % (24 * 60);
                                endTime = TimeOfDay(
                                    hour: newEnd ~/ 60,
                                    minute: newEnd % 60);
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: active
                                    ? _pLavender.withOpacity(0.22)
                                    : (context.isDark
                                        ? Colors.white.withOpacity(0.04)
                                        : Colors.white.withOpacity(0.7)),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: active
                                      ? _pLavender.withOpacity(0.5)
                                      : c.border.withOpacity(0.5),
                                ),
                              ),
                              child: Text(
                                label,
                                style: TextStyle(
                                  color: active ? _pLavender : c.textMuted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient:
                          const LinearGradient(colors: [_pLavender, _pSlate]),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: _pLavender.withOpacity(0.3),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.qr_code_rounded,
                          color: Colors.white, size: 18),
                      label: const Text('Generate QR',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600)),
                      onPressed: () {
                        if (titleCtrl.text.trim().isEmpty) return;
                        submitted = true;
                        Navigator.pop(ctx);
                      },
                    ),
                  ),
                ),
              ],
            ),
          );
        });
      },
    );

    if (!submitted || !mounted) return;
    final title = titleCtrl.text.trim();
    final dateStr = selectedDate.toIso8601String().split('T')[0];
    final startStr = _fmtTOD(startTime);
    final endStr = _fmtTOD(endTime);

    try {
      final res = await ApiService.createAttendanceSession(
        courseId,
        {
          'title': title,
          'date': dateStr,
          'start_time': startStr,
          'end_time': endStr,
        },
      );
      final sessionId = res['id']?.toString() ?? '';
      if (sessionId.isEmpty) throw 'Missing session id';
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => AttendanceSessionDetailScreen(
            courseId: courseId,
            sessionId: sessionId,
            sessionTitle: title,
            sessionDate: dateStr,
            sessionStartTime: startStr,
            sessionEndTime: endStr,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Could not create session: $e'),
            backgroundColor: _pRose),
      );
    }
  }

  // ── Lecturer: Teaching Courses ──────────────────────────────────────────────
  Widget _buildTeachingCourses() {
    final c = context.colors;
    if (_teachingCourses.isEmpty) return const SizedBox.shrink();
    final gradients = [
      [_pLavender, _pPeriwinkle],
      [_pLavender, _pSlate],
      [_pPeriwinkle, _pLavender],
      [_pSlate, _pPeriwinkle],
      [_pLavender, _pPeriwinkle],
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'My Classes',
            icon: Icons.school_rounded,
            actionLabel: 'View All',
            onAction: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const SubjectsScreen())),
          ),
          const SizedBox(height: 4),
          SizedBox(
            height: 120,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(left: 20, right: 8),
              physics: const BouncingScrollPhysics(),
              itemCount: _teachingCourses.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final course = _teachingCourses[i];
                final name   = (course['course_name'] ?? 'Course').toString();
                final code   = (course['course_code'] ?? '').toString();
                final enrolled = (course['enrolled_count'] ??
                    (course['enrolled_students'] as List?)?.length ?? 0) as int;
                final grad = gradients[i % gradients.length];
                return GestureDetector(
                  onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const SubjectsScreen())),
                  child: Container(
                    width: 160,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [grad[0].withOpacity(0.15), grad[1].withOpacity(0.08)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: grad[0].withOpacity(0.25)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: grad,
                                begin: Alignment.topLeft, end: Alignment.bottomRight),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.school_rounded,
                              color: Colors.white, size: 18),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Icon(Icons.people_rounded,
                                    size: 11, color: c.textMuted),
                                const SizedBox(width: 3),
                                Text(
                                  '$enrolled students',
                                  style: TextStyle(
                                      color: c.textMuted, fontSize: 11),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Lecturer: Pending Submissions Card ─────────────────────────────────────
  Widget _buildPendingSubmissions() {
    final c   = context.colors;
    final now = DateTime.now();
    final total = _lecturerAssignments.length;
    if (total == 0) return const SizedBox.shrink();

    // Sort by deadline so the most urgent floats to top
    final sorted = [..._lecturerAssignments]..sort((a, b) {
      final da = DateTime.tryParse(a['deadline']?.toString() ?? '') ?? DateTime(2099);
      final db = DateTime.tryParse(b['deadline']?.toString() ?? '') ?? DateTime(2099);
      return da.compareTo(db);
    });

    // Classify the overall urgency based on the next-due assignment
    final mostUrgent    = sorted.first;
    final urgentDl      = DateTime.tryParse(mostUrgent['deadline']?.toString() ?? '');
    final isOverdue     = urgentDl != null && urgentDl.isBefore(now);
    final isDueSoon     = urgentDl != null && !isOverdue &&
        urgentDl.difference(now).inHours < 48;
    final accentColor   = isOverdue  ? const Color(0xFFDC2626)
                        : isDueSoon  ? _pSand
                        : _pLavender;
    final urgencyLabel  = isOverdue  ? 'Overdue!'
                        : isDueSoon  ? 'Due soon'
                        : null;
    final courseName    = (mostUrgent['course_name'] ?? '').toString();

    // Count overdue + due-soon separately for the chips
    final overdueCount  = sorted.where((a) {
      final dl = DateTime.tryParse(a['deadline']?.toString() ?? '');
      return dl != null && dl.isBefore(now);
    }).length;
    final dueSoonCount  = sorted.where((a) {
      final dl = DateTime.tryParse(a['deadline']?.toString() ?? '');
      return dl != null && !dl.isBefore(now) && dl.difference(now).inHours < 48;
    }).length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () => Navigator.push(context,
            MaterialPageRoute(builder: (_) => const SubjectsScreen())),
        child: GlassCard(
          borderColor: accentColor.withOpacity(0.25),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [accentColor, accentColor.withOpacity(0.70)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: accentColor.withOpacity(0.30),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.grading_rounded,
                    color: Colors.white, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Assignments to Grade',
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (courseName.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        'Next: $courseName',
                        style: TextStyle(color: c.textMuted, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        BadgeChip(label: '$total total', color: _pLavender),
                        if (overdueCount > 0) ...[
                          const SizedBox(width: 6),
                          BadgeChip(
                              label: '$overdueCount overdue',
                              color: const Color(0xFFDC2626)),
                        ] else if (dueSoonCount > 0) ...[
                          const SizedBox(width: 6),
                          BadgeChip(
                              label: '$dueSoonCount due soon',
                              color: _pSand),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  color: c.textMuted, size: 22),
            ],
          ),
        ),
      ),
    );
  }

  // ── Tip of the Day ──
  // ── Activity Feed ──────────────────────────────────────────────────────────
  IconData _activityIcon(String resourceType) {
    switch (resourceType) {
      case 'map': return Icons.account_tree_rounded;
      case 'course': return Icons.school_rounded;
      case 'assignment': return Icons.assignment_rounded;
      case 'submission': return Icons.upload_rounded;
      case 'badge': return Icons.military_tech_rounded;
      case 'quiz': return Icons.quiz_rounded;
      default: return Icons.history_rounded;
    }
  }

  Color _activityColor(String resourceType) {
    switch (resourceType) {
      case 'map': return _pSeafoam;
      case 'course': return _pLavender;
      case 'assignment': return _pSand;
      case 'submission': return _pSage;
      case 'badge': return _pSand;
      case 'quiz': return _pRose;
      default: return _pSlate;
    }
  }

  String _activityLabel(Map<String, dynamic> item) {
    final action = (item['action'] ?? '').toString();
    final rt = (item['resourceType'] ?? '').toString();
    final title = (item['title'] ?? '').toString();
    const actionLabels = {
      'created': 'Created',
      'updated': 'Updated',
      'deleted': 'Deleted',
      'joined': 'Joined',
      'submitted': 'Submitted',
      'earned': 'Earned',
    };
    final aLabel = actionLabels[action] ?? (action.isEmpty ? '' : action[0].toUpperCase() + action.substring(1));
    final parts = <String>[];
    if (aLabel.isNotEmpty) parts.add(aLabel);
    if (rt.isNotEmpty) parts.add(rt);
    final prefix = parts.join(' ');
    if (title.isEmpty) return prefix.isEmpty ? 'Activity' : prefix;
    return prefix.isEmpty ? title : '$prefix: $title';
  }

  Widget _buildActivityFeed(S s) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionHeader(
          title: 'Recent Activity',
          icon: Icons.history_rounded,
          actionLabel: 'See all',
          onAction: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ActivityScreen()),
          ),
        ),
        const SizedBox(height: 8),
        Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: GlassCard(
          borderColor: c.textPrimary.withOpacity(0.12),
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 14),
          child: _activityFeed.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  child: Center(
                    child: Text(
                      'No recent activity yet',
                      style: TextStyle(color: c.textSecondary, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                  ),
                )
              : Column(
            children: List.generate(_activityFeed.length, (i) {
              final item = _activityFeed[i];
              final rt = (item['resourceType'] ?? '').toString();
              final desc = _activityLabel(item);
              final createdAt = (item['createdAt'] ?? item['created_at'] ?? '').toString();
              final color = _activityColor(rt);
              final isLast = i == _activityFeed.length - 1;
              return Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 0),
                child: Column(children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.22),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: color.withOpacity(0.45), width: 1),
                        ),
                        child: Icon(_activityIcon(rt), color: color, size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(
                          desc,
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            height: 1.3,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (createdAt.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            createdAt.length >= 16 ? createdAt.substring(0, 16).replaceAll('T', ' ') : createdAt,
                            style: TextStyle(color: c.textSecondary, fontSize: 11, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ])),
                    ]),
                  ),
                  if (!isLast) Divider(color: c.textPrimary.withOpacity(0.14), height: 1, thickness: 1),
                ]),
              );
            }),
          ),
        ),
        ),
      ]),
    );
  }

  Widget _buildTip(S s) {
    final c = context.colors;
    final tips = [
      "Break complex topics into smaller mind map nodes.",
      "Review your thinking maps regularly for better retention.",
      "Use different colors for different categories.",
      "Connect related concepts across maps.",
      "Set daily study goals to stay consistent.",
      "Take short breaks between study sessions.",
      "Teach concepts to others to solidify understanding.",
    ];
    final tipIndex = DateTime.now().day % tips.length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: GlassCard(
        borderColor: _pSand.withOpacity(0.45),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _pSand,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: Colors.white.withOpacity(0.30), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: _pSand.withOpacity(0.55),
                    blurRadius: 12,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: const Icon(Icons.lightbulb_rounded,
                  color: Colors.white, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s.tipOfTheDay,
                    style: const TextStyle(
                      color: _pSand,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tips[tipIndex],
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickAction {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  _QuickAction(this.label, this.icon, this.color, this.onTap);
}

class _LecturerAiTool {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _LecturerAiTool({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });
}
