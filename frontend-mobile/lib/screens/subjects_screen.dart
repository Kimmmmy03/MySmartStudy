import 'dart:math';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../models/subject_model.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../l10n/app_strings.dart';
import '../widgets/floating_nav_bar.dart';
import '../widgets/empty_state.dart';
import '../widgets/glass_bottom_sheet.dart';
import 'subject_detail_screen.dart';
import 'subject_form_screen.dart';

// ── Per-course colour palette (shared with detail screen) ─────────────────────

const _kCourseColorPairs = [
  [Color(0xFF7C93C5), Color(0xFF8A9AC2)], // slate blue → dusk
  [Color(0xFFA79FCD), Color(0xFFB098C4)], // lavender → plum
  [Color(0xFF8BB5C9), Color(0xFF7C93C5)], // sky → steel
  [Color(0xFF8FA68E), Color(0xFF8FB5AE)], // sage → sea glass
  [Color(0xFFC9B58A), Color(0xFFC5A982)], // sand → warm taupe
  [Color(0xFFC99FB0), Color(0xFFB09AA8)], // dusty rose → mauve
  [Color(0xFFD8A28E), Color(0xFFD5B28A)], // peach → apricot
  [Color(0xFF8891B8), Color(0xFFA79FCD)], // periwinkle → lilac
  [Color(0xFF7BB5B0), Color(0xFF8FA68E)], // seafoam → sage
  [Color(0xFFC29AA3), Color(0xFFC99FB0)], // blush → dusty rose
];

LinearGradient courseGradient(String subjectId) {
  final idx = subjectId.hashCode.abs() % _kCourseColorPairs.length;
  return LinearGradient(
    colors: _kCourseColorPairs[idx],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

Color courseAccent(String subjectId) {
  final idx = subjectId.hashCode.abs() % _kCourseColorPairs.length;
  return _kCourseColorPairs[idx][0];
}

String getPatternForSubject(String subjectId) {
  const patterns = [
    'assets/patterns/songket_pattern.png',
    'assets/patterns/batik_pattern.png',
    'assets/patterns/pucuk_rebung_pattern.png',
    'assets/patterns/ipg_education_pattern.png',
  ];
  return patterns[subjectId.hashCode.abs() % patterns.length];
}

/// Maps a course name / code to a recognisable icon so the coloured square
/// on each card is meaningful rather than repeating the course-code pill.
IconData courseIcon(UserSubjectModel c) {
  final n = c.name.toLowerCase();
  final k = c.courseCode.toLowerCase();
  // Database
  if (n.contains('pangkalan') || n.contains('database') || n.contains('sql'))
    return Icons.storage_rounded;
  // Data structure / algorithm
  if (n.contains('struktur') || n.contains('algorithm') || n.contains('algoritma'))
    return Icons.account_tree_rounded;
  // Math / linear algebra / calculus / statistics
  if (n.contains('algebra') || n.contains('linear') || n.contains('calculus') ||
      n.contains('matematik') || n.contains('statistic') || n.contains('kalkulus'))
    return Icons.calculate_rounded;
  // Programming / coding
  if (n.contains('programming') || n.contains('aturcara') || n.contains('kod'))
    return Icons.code_rounded;
  // Network
  if (n.contains('network') || n.contains('rangkaian'))
    return Icons.hub_rounded;
  // Security / cyber
  if (n.contains('security') || n.contains('keselamatan') || n.contains('cyber'))
    return Icons.security_rounded;
  // Web / internet
  if (n.contains('web') || n.contains('internet'))
    return Icons.web_rounded;
  // AI / machine learning
  if (n.contains('intelligence') || n.contains('machine learning') ||
      n.contains('neural') || n.contains('kecerdasan'))
    return Icons.psychology_rounded;
  // Operating system
  if (n.contains('operating') || n.contains('sistem operasi'))
    return Icons.computer_rounded;
  // Software engineering
  if (n.contains('software') || n.contains('kejuruteraan') || n.contains('perisian'))
    return Icons.engineering_rounded;
  // Language / literature
  if (n.contains('bahasa') || n.contains('melayu') || n.contains('english') ||
      n.contains('kesusasteraan') || n.contains('literature'))
    return Icons.menu_book_rounded;
  // Management / business
  if (n.contains('manage') || n.contains('pengurusan') || n.contains('business'))
    return Icons.business_center_rounded;
  // Default — use course-code prefix as a fallback hint
  if (k.startsWith('it') || k.startsWith('cs')) return Icons.terminal_rounded;
  if (k.startsWith('ma')) return Icons.calculate_rounded;
  if (k.startsWith('en') || k.startsWith('bm')) return Icons.menu_book_rounded;
  return Icons.school_rounded;
}

/// Returns true only when [name] contains something beyond a bare honorific.
/// Hides chips like "👤 Prof." / "👤 Dr." that give no useful information.
bool _hasRealLecturerName(String name) {
  final stripped = name
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\bdr\.?\b'), '')
      .replaceAll(RegExp(r'\bprof\.?\b'), '')
      .replaceAll(RegExp(r'\bmr\.?\b'), '')
      .replaceAll(RegExp(r'\bms\.?\b'), '')
      .replaceAll(RegExp(r'\bmrs\.?\b'), '')
      .replaceAll(RegExp(r'\bts\.?\b'), '')
      .trim();
  return stripped.length >= 2; // at least 2 chars after titles are removed
}

String courseInitials(UserSubjectModel c) {
  if (c.courseCode.isNotEmpty) return c.courseCode.toUpperCase();
  final words = c.name.trim().split(RegExp(r'\s+'));
  if (words.length >= 2) return '${words[0][0]}${words[1][0]}'.toUpperCase();
  return c.name.substring(0, min(2, c.name.length)).toUpperCase();
}

// ── Sort mode ─────────────────────────────────────────────────────────────────

enum _SortMode { defaultOrder, nameAsc, nameDesc, mostStudents }

// ─────────────────────────────────────────────────────────────────────────────

class SubjectsScreen extends StatefulWidget {
  const SubjectsScreen({super.key});
  @override
  State<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends State<SubjectsScreen> {
  List<UserSubjectModel> _courses = [];
  List<UserSubjectModel> _filtered = [];
  bool _loading = true;
  String _role = 'student';
  bool _isGridView = true;
  _SortMode _sortMode = _SortMode.defaultOrder;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _searchCtrl.addListener(_filter);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final me = await ApiService.getMe();
      _role = (me['role'] ?? 'student').toString();
      final List<dynamic> raw = _role == 'lecturer'
          ? await ApiService.getTeachingCourses()
          : await ApiService.getEnrolledCourses();
      if (!mounted) return;
      setState(() {
        _courses = raw
            .map((c) => UserSubjectModel.fromApi(
                Map<String, dynamic>.from(c),
                _role == 'lecturer' ? 'lecturer' : 'student'))
            .toList();
        _filtered = List.from(_courses);
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _filter() {
    final q = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? List.from(_courses)
          : _courses
              .where((c) =>
                  c.name.toLowerCase().contains(q) ||
                  c.courseCode.toLowerCase().contains(q) ||
                  c.lecturerName.toLowerCase().contains(q))
              .toList();
    });
  }

  List<UserSubjectModel> _getSorted() {
    final list = List<UserSubjectModel>.from(_filtered);
    switch (_sortMode) {
      case _SortMode.nameAsc:
        list.sort((a, b) => a.name.compareTo(b.name));
      case _SortMode.nameDesc:
        list.sort((a, b) => b.name.compareTo(a.name));
      case _SortMode.mostStudents:
        list.sort((a, b) => b.enrolledCount.compareTo(a.enrolledCount));
      case _SortMode.defaultOrder:
        break;
    }
    return list;
  }

  // ── Sort sheet ───────────────────────────────────────────────────────────────

  void _showSortSheet() {
    final c = context.colors;
    final isDark = context.isDark;
    final roleAccent = AppColors.accentForRole(_role);
    showGlassBottomSheet(
      context: context,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                  color: c.border, borderRadius: BorderRadius.circular(2)),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Sort Courses',
                  style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Choose how to order your list',
                  style: TextStyle(color: c.textMuted, fontSize: 13)),
            ),
            const SizedBox(height: 20),
            ..._SortMode.values.map((mode) {
              final label = switch (mode) {
                _SortMode.defaultOrder => 'Default order',
                _SortMode.nameAsc     => 'Name: A → Z',
                _SortMode.nameDesc    => 'Name: Z → A',
                _SortMode.mostStudents => 'Most students first',
              };
              final icon = switch (mode) {
                _SortMode.defaultOrder  => Icons.format_list_bulleted_rounded,
                _SortMode.nameAsc       => Icons.sort_by_alpha_rounded,
                _SortMode.nameDesc      => Icons.sort_rounded,
                _SortMode.mostStudents  => Icons.people_rounded,
              };
              return _SortOption(
                icon: icon,
                label: label,
                selected: _sortMode == mode,
                accent: roleAccent,
                colors: c,
                isDark: isDark,
                onTap: () {
                  Navigator.pop(ctx);
                  HapticFeedback.selectionClick();
                  setState(() => _sortMode = mode);
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isDark = context.isDark;
    final s = S.of(context);
    final isLecturer = _role == 'lecturer';
    final roleGradient = AppColors.gradientForRole(_role);
    final roleAccent = AppColors.accentForRole(_role);
    final sorted = _getSorted();

    return Scaffold(
      backgroundColor: Colors.transparent,

      // ── FAB — lecturer only (students use inline join card) ──
      floatingActionButton: isLecturer
          ? Padding(
              padding: const EdgeInsets.only(bottom: FloatingNavBar.kTotalHeight),
              child: FloatingActionButton(
                heroTag: 'fab_courses',
                backgroundColor: roleAccent,
                foregroundColor: Colors.white,
                elevation: 6,
                tooltip: s.createCourse,
                onPressed: () async {
                  await Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const SubjectFormScreen()));
                  _load();
                },
                child: const Icon(Icons.add_rounded, size: 24),
              ),
            )
          : null,

      body: AnimationLimiter(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics()),
          slivers: [
            // ── Collapsing gradient header ─────────────────────────────────
            _SliverCourseHeader(
              isLecturer: isLecturer,
              roleGradient: roleGradient,
              courseCount: _courses.length,
              totalStudents: isLecturer
                  ? _courses.fold<int>(0, (sum, c) => sum + c.enrolledCount)
                  : null,
              loading: _loading,
              onRefresh: _load,
              colors: c,
              isDark: isDark,
            ),

            // ── Inline join course card (student only) ─────────────────────
            if (!isLecturer)
              SliverToBoxAdapter(
                child: _InlineJoinCard(
                  isDark: isDark,
                  colors: c,
                  onJoin: (code) async {
                    try {
                      await ApiService.joinCourse(code);
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('Joined successfully!'),
                          backgroundColor: AppColors.emerald,
                        ));
                        _load();
                      }
                    } catch (_) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('Invalid code or already enrolled'),
                          backgroundColor: AppColors.red,
                        ));
                      }
                    }
                  },
                ),
              ),

            // ── Unified Sticky Glass Header (Search + Controls) ────────────
            SliverPersistentHeader(
              pinned: true,
              delegate: _ModernSearchControlDelegate(
                controller: _searchCtrl,
                count: _filtered.length,
                loading: _loading,
                isGridView: _isGridView,
                sortMode: _sortMode,
                roleAccent: roleAccent,
                colors: c,
                isDark: isDark,
                onClear: () {
                  _searchCtrl.clear();
                  _filter();
                },
                onToggleLayout: () {
                  HapticFeedback.selectionClick();
                  setState(() => _isGridView = !_isGridView);
                },
                onSort: _showSortSheet,
              ),
            ),

            // ── Loading skeletons ──────────────────────────────────────────
            if (_loading)
              _isGridView
                  ? SliverPadding(
                      padding:
                          const EdgeInsets.fromLTRB(16, 4, 16, 0),
                      sliver: SliverGrid(
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.74,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (_, i) => _GridShimmerCard(isDark: isDark),
                          childCount: 6,
                        ),
                      ),
                    )
                  : SliverPadding(
                      padding:
                          const EdgeInsets.fromLTRB(16, 4, 16, 0),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (_, i) => _ShimmerCard(isDark: isDark),
                          childCount: 5,
                        ),
                      ),
                    )

            // ── Empty state ────────────────────────────────────────────────
            else if (sorted.isEmpty)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 340,
                  child: EmptyState(
                    icon: Icons.school_rounded,
                    title: _searchCtrl.text.isNotEmpty
                        ? 'No results found'
                        : isLecturer
                            ? 'No classes yet'
                            : 'No courses yet',
                    subtitle: _searchCtrl.text.isNotEmpty
                        ? 'Try a different search term'
                        : isLecturer
                            ? 'Tap + to create your first class'
                            : 'Tap + to join with a course code',
                  ),
                ),
              )

            // ── Grid view ─────────────────────────────────────────────────
            else if (_isGridView)
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                    16, 4, 16, FloatingNavBar.kTotalHeight + 80),
                sliver: SliverGrid(
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.74,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => AnimationConfiguration.staggeredGrid(
                      position: i,
                      columnCount: 2,
                      duration: const Duration(milliseconds: 340),
                      child: ScaleAnimation(
                        scale: 0.93,
                        child: FadeInAnimation(
                          child: _GridCourseCard(
                            course: sorted[i],
                            isLecturer: isLecturer,
                            isDark: isDark,
                            colors: c,
                            onOpen: () async {
                              await Navigator.push(
                                context,
                                _slideRoute(SubjectDetailScreen(
                                  subjectId: sorted[i].subjectId,
                                  subjectName: sorted[i].name,
                                )),
                              );
                              _load();
                            },
                            onCopyCode: () {
                              HapticFeedback.lightImpact();
                              Clipboard.setData(ClipboardData(
                                  text: sorted[i].joinCode));
                              ScaffoldMessenger.of(context)
                                  .showSnackBar(const SnackBar(
                                content: Text('Join code copied!'),
                                duration: Duration(seconds: 1),
                              ));
                            },
                          ),
                        ),
                      ),
                    ),
                    childCount: sorted.length,
                  ),
                ),
              )

            // ── List view ─────────────────────────────────────────────────
            else
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                    16, 4, 16, FloatingNavBar.kTotalHeight + 80),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => AnimationConfiguration.staggeredList(
                      position: i,
                      duration: const Duration(milliseconds: 360),
                      child: SlideAnimation(
                        verticalOffset: 24,
                        child: FadeInAnimation(
                          child: _CourseCard(
                            course: sorted[i],
                            isLecturer: isLecturer,
                            isDark: isDark,
                            colors: c,
                            onOpen: () async {
                              await Navigator.push(
                                context,
                                _slideRoute(SubjectDetailScreen(
                                  subjectId: sorted[i].subjectId,
                                  subjectName: sorted[i].name,
                                )),
                              );
                              _load();
                            },
                            onCopyCode: () {
                              HapticFeedback.lightImpact();
                              Clipboard.setData(ClipboardData(
                                  text: sorted[i].joinCode));
                              ScaffoldMessenger.of(context)
                                  .showSnackBar(const SnackBar(
                                content: Text('Join code copied!'),
                                duration: Duration(seconds: 1),
                              ));
                            },
                          ),
                        ),
                      ),
                    ),
                    childCount: sorted.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Smooth slide-up + fade page route ─────────────────────────────────────────

Route<T> _slideRoute<T>(Widget page) => PageRouteBuilder<T>(
      pageBuilder: (_, a, __) => page,
      transitionDuration: const Duration(milliseconds: 320),
      reverseTransitionDuration: const Duration(milliseconds: 260),
      transitionsBuilder: (_, animation, __, child) => SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
        child: FadeTransition(opacity: animation, child: child),
      ),
    );

// ── Sliver app bar / header ────────────────────────────────────────────────────

class _SliverCourseHeader extends StatelessWidget {
  final bool isLecturer;
  final LinearGradient roleGradient;
  final int courseCount;
  final int? totalStudents;
  final bool loading;
  final VoidCallback onRefresh;
  final AppColorScheme colors;
  final bool isDark;

  const _SliverCourseHeader({
    required this.isLecturer,
    required this.roleGradient,
    required this.courseCount,
    this.totalStudents,
    required this.loading,
    required this.onRefresh,
    required this.colors,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final accent = isLecturer ? AppColors.purple : AppColors.blue;
    return SliverAppBar(
      expandedHeight: 180,
      toolbarHeight: 74,
      pinned: true,
      backgroundColor: Colors.transparent,
      elevation: 0,
      stretch: true,
      flexibleSpace: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            color: isDark 
                ? const Color(0xFF0A0A1A).withValues(alpha: 0.6)
                : Colors.white.withValues(alpha: 0.6),
            child: FlexibleSpaceBar(
              stretchModes: const [StretchMode.zoomBackground, StretchMode.blurBackground],
              titlePadding: const EdgeInsets.fromLTRB(20, 0, 16, 16),
              centerTitle: false,
              title: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                   Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isLecturer ? 'My Classes' : 'My Courses',
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Text(
                          loading
                              ? 'Loading…'
                              : isLecturer
                                  ? '$courseCount class${courseCount == 1 ? '' : 'es'}${(totalStudents ?? 0) > 0 ? ' · $totalStudents students' : ''}'
                                  : '$courseCount course${courseCount == 1 ? '' : 's'} enrolled',
                          style: TextStyle(
                            color: accent,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: onRefresh,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.refresh_rounded, color: accent, size: 16),
                    ),
                  ),
                ],
              ),
              background: Stack(
                children: [
                  // Beautiful Campus Background Illustration
                  Positioned.fill(
                    child: Image.asset(
                      'assets/patterns/ipg_kampus_melaka_bg.png',
                      fit: BoxFit.cover,
                    ),
                  ),
                  // Overlay for text readability (Dark mode gets a dark wash, Light mode gets a bright frosty wash)
                  Positioned.fill(
                    child: Container(
                      color: isDark 
                          ? Colors.black.withValues(alpha: 0.65) 
                          : Colors.white.withValues(alpha: 0.70),
                    ),
                  ),
                  // Pattern overlay
                  Positioned.fill(
                    child: Opacity(
                      opacity: isDark ? 0.05 : 0.08,
                      child: Image.asset(
                        'assets/patterns/batik_pattern.png',
                        repeat: ImageRepeat.repeat,
                      ),
                    ),
                  ),
                  // Animated slight gradient background
                  Positioned(
                    top: -60, right: -20,
                    child: Container(
                      width: 220, height: 220,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            roleGradient.colors.first.withValues(alpha: 0.15),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Inline join course card (replaces student FAB) ──────────────────────────

class _InlineJoinCard extends StatefulWidget {
  final bool isDark;
  final AppColorScheme colors;
  final Future<void> Function(String code) onJoin;

  const _InlineJoinCard({
    required this.isDark,
    required this.colors,
    required this.onJoin,
  });

  @override
  State<_InlineJoinCard> createState() => _InlineJoinCardState();
}

class _InlineJoinCardState extends State<_InlineJoinCard> {
  final _ctrl = TextEditingController();
  bool _joining = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    final code = _ctrl.text.trim();
    if (code.length < 4 || _joining) return;
    setState(() => _joining = true);
    await widget.onJoin(code);
    if (mounted) {
      _ctrl.clear();
      setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.colors;
    final isDark = widget.isDark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.04)
                  : Colors.white.withValues(alpha: 0.65),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : Colors.black.withValues(alpha: 0.06),
              ),
            ),
            child: Column(
              children: [
                // Gradient tint header
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isDark
                          ? [const Color(0xFF7C93C5).withValues(alpha: 0.10), const Color(0xFFA79FCD).withValues(alpha: 0.10)]
                          : [const Color(0xFF7C93C5).withValues(alpha: 0.06), const Color(0xFFA79FCD).withValues(alpha: 0.06)],
                    ),
                    border: Border(
                      bottom: BorderSide(
                        color: isDark
                            ? Colors.white.withValues(alpha: 0.05)
                            : Colors.black.withValues(alpha: 0.04),
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: const Color(0xFF7C93C5).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF7C93C5).withValues(alpha: 0.20),
                          ),
                        ),
                        child: const Icon(Icons.vpn_key_rounded,
                            color: Color(0xFF7C93C5), size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Join a Course',
                              style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              'Enter the code from your lecturer',
                              style: TextStyle(
                                color: c.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // Input + button row
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 42,
                          decoration: BoxDecoration(
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.05)
                                : Colors.white.withValues(alpha: 0.8),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark
                                  ? Colors.white.withValues(alpha: 0.10)
                                  : Colors.black.withValues(alpha: 0.08),
                            ),
                          ),
                          child: TextField(
                            controller: _ctrl,
                            textCapitalization: TextCapitalization.characters,
                            textAlign: TextAlign.center,
                            maxLength: 6,
                            style: TextStyle(
                              color: c.textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              fontFamily: 'monospace',
                              letterSpacing: 6,
                            ),
                            decoration: InputDecoration(
                              border: InputBorder.none,
                              hintText: 'ABC123',
                              hintStyle: TextStyle(
                                color: c.textMuted.withValues(alpha: 0.5),
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 4,
                              ),
                              counterText: '',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(
                        height: 42,
                        child: ElevatedButton(
                          onPressed: _joining ? null : _join,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF7C93C5),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: _joining
                              ? const SizedBox(
                                  width: 18, height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Join',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  )),
                        ),
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
  }
}

// ── Unified Modern Search & Control Delegate ─────────────────────────────────

class _ModernSearchControlDelegate extends SliverPersistentHeaderDelegate {
  final TextEditingController controller;
  final int count;
  final bool loading;
  final bool isGridView;
  final _SortMode sortMode;
  final Color roleAccent;
  final AppColorScheme colors;
  final bool isDark;
  final VoidCallback onClear;
  final VoidCallback onToggleLayout;
  final VoidCallback onSort;

  const _ModernSearchControlDelegate({
    required this.controller,
    required this.count,
    required this.loading,
    required this.isGridView,
    required this.sortMode,
    required this.roleAccent,
    required this.colors,
    required this.isDark,
    required this.onClear,
    required this.onToggleLayout,
    required this.onSort,
  });

  @override
  double get minExtent => 116;
  @override
  double get maxExtent => 116;

  @override
  bool shouldRebuild(_ModernSearchControlDelegate old) =>
      old.isDark != isDark ||
      old.controller != controller ||
      old.count != count ||
      old.loading != loading ||
      old.isGridView != isGridView ||
      old.sortMode != sortMode;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    final sortActive = sortMode != _SortMode.defaultOrder;

    return OverflowBox(
      alignment: Alignment.topCenter,
      minHeight: maxExtent,
      maxHeight: maxExtent,
      child: ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          color: isDark
              ? const Color(0xFF0A0A1A).withValues(alpha: 0.70)
              : Colors.white.withValues(alpha: 0.85),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Search Pill
              Container(
                height: 44,
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : Colors.black.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.15)
                        : Colors.black.withValues(alpha: 0.05),
                  ),
                  boxShadow: isDark ? [] : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    )
                  ],
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 12),
                    Icon(Icons.search_rounded, color: colors.textMuted, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: controller,
                        style:
                            TextStyle(color: colors.textPrimary, fontSize: 14),
                        decoration: InputDecoration(
                          border: InputBorder.none,
                          hintText: 'Search courses, codes…',
                          hintStyle:
                              TextStyle(color: colors.textMuted, fontSize: 14),
                          isDense: true,
                        ),
                      ),
                    ),
                    AnimatedBuilder(
                      animation: controller,
                      builder: (_, __) => controller.text.isNotEmpty
                          ? GestureDetector(
                              onTap: onClear,
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 10),
                                child: Icon(Icons.close_rounded,
                                    color: colors.textMuted, size: 18),
                              ),
                            )
                          : const SizedBox(width: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              // Control Row
              Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: roleAccent,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    loading
                        ? 'Loading…'
                        : '$count ${count == 1 ? 'course' : 'courses'}',
                    style: TextStyle(
                      color: colors.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  _ControlButton(
                    icon: Icons.sort_rounded,
                    label: 'Sort',
                    active: sortActive,
                    activeColor: roleAccent,
                    colors: colors,
                    isDark: isDark,
                    onTap: onSort,
                  ),
                  const SizedBox(width: 8),
                  // Layout toggle
                  _ControlButton(
                    icon: isGridView
                        ? Icons.view_list_rounded
                        : Icons.grid_view_rounded,
                    label: isGridView ? 'List' : 'Grid',
                    active: isGridView,
                    activeColor: roleAccent,
                    colors: colors,
                    isDark: isDark,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onToggleLayout();
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final Color activeColor;
  final AppColorScheme colors;
  final bool isDark;
  final VoidCallback onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.activeColor,
    required this.colors,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active
              ? activeColor.withValues(alpha: 0.12)
              : (isDark
                  ? Colors.white.withValues(alpha: 0.05)
                  : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active
                ? activeColor.withValues(alpha: 0.30)
                : (isDark ? Colors.transparent : Colors.black.withValues(alpha: 0.05)),
          ),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: activeColor.withValues(alpha: 0.2),
                    blurRadius: 8,
                    spreadRadius: -2,
                  )
                ]
              : (isDark
                  ? []
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      )
                    ]),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 15,
                color: active ? activeColor : colors.textMuted),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: active ? activeColor : colors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sort option row ───────────────────────────────────────────────────────────

class _SortOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final Color accent;
  final AppColorScheme colors;
  final bool isDark;
  final VoidCallback onTap;

  const _SortOption({
    required this.icon,
    required this.label,
    required this.selected,
    required this.accent,
    required this.colors,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: selected
              ? accent.withValues(alpha: 0.11)
              : (isDark
                  ? Colors.white.withValues(alpha: 0.04)
                  : Colors.black.withValues(alpha: 0.03)),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? accent.withValues(alpha: 0.30)
                : Colors.transparent,
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                color: selected ? accent : colors.textMuted, size: 20),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                color: selected ? accent : colors.textPrimary,
                fontSize: 15,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
            const Spacer(),
            if (selected)
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.13),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.check_rounded, color: accent, size: 14),
              ),
          ],
        ),
      ),
    );
  }
}

// ── List view course card ─────────────────────────────────────────────────────

class _CourseCard extends StatefulWidget {
  final UserSubjectModel course;
  final bool isLecturer;
  final bool isDark;
  final AppColorScheme colors;
  final VoidCallback onOpen;
  final VoidCallback onCopyCode;

  const _CourseCard({
    required this.course,
    required this.isLecturer,
    required this.isDark,
    required this.colors,
    required this.onOpen,
    required this.onCopyCode,
  });

  @override
  State<_CourseCard> createState() => _CourseCardState();
}

class _CourseCardState extends State<_CourseCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final course = widget.course;
    final isLecturer = widget.isLecturer;
    final isDark = widget.isDark;
    final colors = widget.colors;

    final gradient = courseGradient(course.subjectId);
    final accent   = courseAccent(course.subjectId);
    final icon     = courseIcon(course);

    return AnimatedScale(
      scale: _pressed ? 0.95 : 1.0,
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOutQuart,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) {
          setState(() => _pressed = false);
          widget.onOpen();
        },
        onTapCancel: () => setState(() => _pressed = false),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
              child: Container(
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.white.withValues(alpha: 0.65),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.08)
                        : Colors.white.withValues(alpha: 0.8),
                    width: 1.5,
                  ),
                  boxShadow: isDark ? [] : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      // ── Main row with left accent bar ──────────────────────────
                      Stack(
                        children: [
                          // Content area (defines the height)
                          Padding(
                            padding: const EdgeInsets.only(left: 4),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(10, 14, 14, 14),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  // Gradient avatar with subject icon
                                  Hero(
                                    tag: 'course_avatar_${course.subjectId}',
                                    child: Container(
                                      width: 54,
                                      height: 54,
                                      clipBehavior: Clip.hardEdge,
                                      decoration: BoxDecoration(
                                        gradient: gradient,
                                        borderRadius: BorderRadius.circular(16),
                                        boxShadow: [
                                          BoxShadow(
                                            color: accent.withValues(alpha: 0.30),
                                            blurRadius: 12,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: Stack(
                                        alignment: Alignment.center,
                                        children: [
                                          Positioned.fill(
                                            child: Opacity(
                                              opacity: 0.3,
                                              child: Image.asset(getPatternForSubject(course.subjectId), repeat: ImageRepeat.repeat),
                                            ),
                                          ),
                                          Icon(icon, color: Colors.white, size: 26),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
    
                                  // Info column
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          course.name,
                                          style: TextStyle(
                                            color: colors.textPrimary,
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                            height: 1.25,
                                            letterSpacing: -0.2,
                                          ),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 6),
                                        Wrap(
                                          spacing: 6,
                                          runSpacing: 4,
                                          children: [
                                            if (course.courseCode.isNotEmpty)
                                              _Chip(
                                                label: course.courseCode,
                                                color: accent,
                                                filled: true,
                                              ),
                                            if (!isLecturer &&
                                                _hasRealLecturerName(course.lecturerName))
                                              _Chip(
                                                icon: Icons.person_rounded,
                                                label: course.lecturerName,
                                                color: colors.textMuted,
                                              ),
                                            if (isLecturer &&
                                                course.enrolledCount > 0)
                                              _Chip(
                                                icon: Icons.people_rounded,
                                                label:
                                                    '${course.enrolledCount} student${course.enrolledCount == 1 ? '' : 's'}',
                                                color: colors.textMuted,
                                              ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
    
                                  // Arrow
                                  Container(
                                    width: 34,
                                    height: 34,
                                    decoration: BoxDecoration(
                                      color: isDark 
                                          ? Colors.white.withValues(alpha: 0.05) 
                                          : accent.withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: isDark 
                                            ? Colors.white.withValues(alpha: 0.06) 
                                            : accent.withValues(alpha: 0.1),
                                      ),
                                    ),
                                    child: Icon(
                                        Icons.arrow_forward_rounded,
                                        color: isDark ? Colors.white : accent,
                                        size: 15),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Left gradient accent bar
                          Positioned(
                            left: 0, top: 0, bottom: 0,
                            child: Container(
                              width: 4,
                              decoration: BoxDecoration(
                                gradient: gradient,
                                borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(20),
                                  bottomLeft: Radius.circular(
                                    (isLecturer && course.joinCode.isNotEmpty) ||
                                            !isLecturer
                                        ? 0
                                        : 20,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
      
                      // ── Lecturer: enrollment progress bar ─────────────────────
                      if (isLecturer && course.enrolledCount > 0)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Text('Enrollment', style: TextStyle(color: colors.textMuted, fontSize: 11)),
                              const Spacer(),
                              Text(
                                '${course.enrolledCount} student${course.enrolledCount == 1 ? '' : 's'}',
                                style: TextStyle(color: accent, fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ]),
                            const SizedBox(height: 4),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: (course.enrolledCount / 50).clamp(0.0, 1.0),
                                minHeight: 5,
                                backgroundColor: accent.withValues(alpha: 0.10),
                                valueColor: AlwaysStoppedAnimation<Color>(accent),
                              ),
                            ),
                          ]),
                        ),
      
                      // ── Lecturer join-code bar ─────────────────────────────────
                      if (isLecturer && course.joinCode.isNotEmpty)
                        _JoinCodeBar(
                          joinCode: course.joinCode,
                          accent: accent,
                          isDark: isDark,
                          colors: colors,
                          onCopy: widget.onCopyCode,
                        )
      
                      // ── Student gradient bottom stripe ─────────────────────────
                      else if (!isLecturer)
                        Container(
                          height: 3,
                          decoration: BoxDecoration(
                            gradient: gradient,
                            borderRadius: const BorderRadius.vertical(
                                bottom: Radius.circular(20)),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Grid view course card (web-matched layout) ──────────────────────────────

class _GridCourseCard extends StatefulWidget {
  final UserSubjectModel course;
  final bool isLecturer;
  final bool isDark;
  final AppColorScheme colors;
  final VoidCallback onOpen;
  final VoidCallback onCopyCode;

  const _GridCourseCard({
    required this.course,
    required this.isLecturer,
    required this.isDark,
    required this.colors,
    required this.onOpen,
    required this.onCopyCode,
  });

  @override
  State<_GridCourseCard> createState() => _GridCourseCardState();
}

class _GridCourseCardState extends State<_GridCourseCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final course = widget.course;
    final isLecturer = widget.isLecturer;
    final isDark = widget.isDark;
    final colors = widget.colors;
    
    final gradient = courseGradient(course.subjectId);
    final accent   = courseAccent(course.subjectId);

    return AnimatedScale(
      scale: _pressed ? 0.95 : 1.0,
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOutQuart,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) {
          setState(() => _pressed = false);
          widget.onOpen();
        },
        onTapCancel: () => setState(() => _pressed = false),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.white.withValues(alpha: 0.65),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.1)
                      : Colors.white.withValues(alpha: 0.8),
                  width: 1.5,
                ),
                boxShadow: isDark ? [] : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   // Course Image/Gradient Top
                   Expanded(
                     flex: 5,
                     child: Container(
                       width: double.infinity,
                       decoration: BoxDecoration(gradient: gradient),
                       child: Stack(
                         children: [
                           // Pattern watermark
                           Positioned.fill(
                             child: Opacity(
                               opacity: 0.4,
                               child: Image.asset(
                                 getPatternForSubject(course.subjectId),
                                 repeat: ImageRepeat.repeat,
                               ),
                             ),
                           ),
                           // Orb top-right
                           Positioned(
                             top: -40, right: -40,
                             child: Container(
                               width: 90, height: 90,
                               decoration: BoxDecoration(
                                 shape: BoxShape.circle,
                                 gradient: RadialGradient(
                                   colors: [
                                     Colors.white.withValues(alpha: 0.2),
                                     Colors.transparent,
                                   ],
                                 ),
                               ),
                             ),
                           ),
                           // Course code pill
                           Positioned(
                             top: 14, left: 14,
                             child: course.courseCode.isNotEmpty 
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                                  ),
                                  child: Text(
                                    course.courseCode,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                )
                              : const SizedBox(),
                           ),
                         ],
                       ),
                     ),
                   ),
                   // Bottom Info Text area
                   Expanded(
                     flex: 6,
                     child: Padding(
                       padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                       child: Column(
                         crossAxisAlignment: CrossAxisAlignment.start,
                         children: [
                           Hero(
                             tag: 'course_avatar_${course.subjectId}',
                             child: Material(
                               color: Colors.transparent,
                               child: Text(
                                 course.name,
                                 style: TextStyle(
                                   color: colors.textPrimary,
                                   fontSize: 15,
                                   fontWeight: FontWeight.w800,
                                   height: 1.2,
                                   letterSpacing: -0.3,
                                 ),
                                 maxLines: 2,
                                 overflow: TextOverflow.ellipsis,
                               ),
                             ),
                           ),
                           const Spacer(),
                           Row(
                             children: [
                               Container(
                                 width: 26, height: 26,
                                 decoration: BoxDecoration(
                                   color: accent.withValues(alpha: 0.15),
                                   shape: BoxShape.circle,
                                 ),
                                 alignment: Alignment.center,
                                 child: Text(
                                   _avatarInitial(course, isLecturer),
                                   style: TextStyle(color: accent, fontSize: 11, fontWeight: FontWeight.bold),
                                 ),
                               ),
                               const SizedBox(width: 8),
                               Expanded(
                                 child: Text(
                                   isLecturer ? 'Teaching' : (course.lecturerName.isEmpty ? 'Lecturer' : course.lecturerName),
                                   style: TextStyle(color: colors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600),
                                   maxLines: 1, overflow: TextOverflow.ellipsis,
                                 ),
                               ),
                             ],
                           ),
                         ],
                       ),
                     ),
                   ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static String _avatarInitial(UserSubjectModel course, bool isLecturer) {
    if (!isLecturer && course.lecturerName.isNotEmpty) {
      return course.lecturerName[0].toUpperCase();
    }
    if (course.name.isNotEmpty) return course.name[0].toUpperCase();
    return 'C';
  }
}

// ── Card header pattern overlay painter ──────────────────────────────────────

class _CardPatternPainter extends CustomPainter {
  final int variant;
  _CardPatternPainter(this.variant);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.07)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;

    switch (variant) {
      case 0: // diagonal lines
        for (double i = -size.height; i < size.width + size.height; i += 14) {
          canvas.drawLine(Offset(i, 0), Offset(i + size.height, size.height), paint);
        }
      case 1: // dots grid
        final dotPaint = Paint()
          ..color = Colors.white.withValues(alpha: 0.10)
          ..style = PaintingStyle.fill;
        for (double x = 8; x < size.width; x += 16) {
          for (double y = 8; y < size.height; y += 16) {
            canvas.drawCircle(Offset(x, y), 1.0, dotPaint);
          }
        }
      default: // diamond / cross-hatch
        for (double i = 0; i < size.width + size.height; i += 20) {
          canvas.drawLine(Offset(i, 0), Offset(0, i), paint);
        }
        for (double i = 0; i < size.width + size.height; i += 20) {
          canvas.drawLine(Offset(size.width - i, 0), Offset(size.width, i), paint);
        }
    }
  }

  @override
  bool shouldRepaint(_CardPatternPainter old) => old.variant != variant;
}

// ── Join code bar ─────────────────────────────────────────────────────────────

class _JoinCodeBar extends StatefulWidget {
  final String joinCode;
  final Color accent;
  final bool isDark;
  final AppColorScheme colors;
  final VoidCallback onCopy;

  const _JoinCodeBar({
    required this.joinCode,
    required this.accent,
    required this.isDark,
    required this.colors,
    required this.onCopy,
  });

  @override
  State<_JoinCodeBar> createState() => _JoinCodeBarState();
}

class _JoinCodeBarState extends State<_JoinCodeBar> {
  bool _copied = false;

  void _copy() async {
    widget.onCopy();
    setState(() => _copied = true);
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: widget.accent
            .withValues(alpha: widget.isDark ? 0.10 : 0.06),
        borderRadius: BorderRadius.circular(13),
        border:
            Border.all(color: widget.accent.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Icon(Icons.vpn_key_rounded, color: widget.accent, size: 14),
          const SizedBox(width: 8),
          Text('Code:',
              style:
                  TextStyle(color: widget.colors.textMuted, fontSize: 12)),
          const SizedBox(width: 8),
          Text(
            widget.joinCode,
            style: TextStyle(
              color: widget.accent,
              fontWeight: FontWeight.w800,
              fontSize: 15,
              letterSpacing: 3,
            ),
          ),
          const Spacer(),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: _copied
                ? Container(
                    key: const ValueKey('ok'),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.emerald.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_rounded,
                            color: AppColors.emerald, size: 13),
                        SizedBox(width: 4),
                        Text('Copied',
                            style: TextStyle(
                                color: AppColors.emerald,
                                fontSize: 11,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  )
                : GestureDetector(
                    key: const ValueKey('copy'),
                    onTap: _copy,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: widget.accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.copy_rounded,
                              color: widget.accent, size: 13),
                          const SizedBox(width: 4),
                          Text('Copy',
                              style: TextStyle(
                                  color: widget.accent,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

// ── Inline chip ───────────────────────────────────────────────────────────────

class _Chip extends StatelessWidget {
  final IconData? icon;
  final String label;
  final Color color;
  final bool filled;

  const _Chip({
    this.icon,
    required this.label,
    required this.color,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: filled ? color.withValues(alpha: 0.13) : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
        border: filled
            ? Border.all(color: color.withValues(alpha: 0.22))
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: color, size: 11),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: filled ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ── List view shimmer skeleton ────────────────────────────────────────────────

class _ShimmerCard extends StatefulWidget {
  final bool isDark;
  const _ShimmerCard({required this.isDark});

  @override
  State<_ShimmerCard> createState() => _ShimmerCardState();
}

class _ShimmerCardState extends State<_ShimmerCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) {
        final base = widget.isDark
            ? Color.lerp(Colors.white.withValues(alpha: 0.04),
                Colors.white.withValues(alpha: 0.07), _anim.value)!
            : Color.lerp(Colors.black.withValues(alpha: 0.04),
                Colors.black.withValues(alpha: 0.07), _anim.value)!;
        final shimmer = widget.isDark
            ? Colors.white.withValues(alpha: 0.08)
            : Colors.black.withValues(alpha: 0.07);

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Container(
            height: 84,
            decoration: BoxDecoration(
              color: base,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                // Left accent bar shimmer
                Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: shimmer,
                    borderRadius: const BorderRadius.horizontal(
                        left: Radius.circular(20)),
                  ),
                ),
                const SizedBox(width: 14),
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: shimmer,
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(height: 13, width: 150, color: shimmer,
                          margin: const EdgeInsets.only(bottom: 8)),
                      Container(height: 10, width: 90, color: base),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Grid view shimmer skeleton ────────────────────────────────────────────────

class _GridShimmerCard extends StatefulWidget {
  final bool isDark;
  const _GridShimmerCard({required this.isDark});

  @override
  State<_GridShimmerCard> createState() => _GridShimmerCardState();
}

class _GridShimmerCardState extends State<_GridShimmerCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) {
        final base = widget.isDark
            ? Color.lerp(Colors.white.withValues(alpha: 0.04),
                Colors.white.withValues(alpha: 0.07), _anim.value)!
            : Color.lerp(Colors.black.withValues(alpha: 0.04),
                Colors.black.withValues(alpha: 0.07), _anim.value)!;
        final shimmer = widget.isDark
            ? Colors.white.withValues(alpha: 0.09)
            : Colors.black.withValues(alpha: 0.08);

        return Container(
          decoration: BoxDecoration(
            color: base,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Cover shimmer
              Container(
                height: 108,
                decoration: BoxDecoration(
                  color: shimmer,
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(24)),
                ),
              ),
              // Info shimmer
              Padding(
                padding: const EdgeInsets.all(11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(height: 12, width: double.infinity,
                        color: shimmer,
                        margin: const EdgeInsets.only(bottom: 6)),
                    Container(height: 10, width: 72, color: base),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
