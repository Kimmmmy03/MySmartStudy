import "dart:ui";
import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "../services/api_service.dart";
import "../utils/app_colors.dart";
import "../utils/app_theme_ext.dart";
import "../widgets/app_background.dart";
import "../widgets/skeletons.dart";
import "../l10n/app_strings.dart";
import "assignments_tab.dart";
import "announcement_form_screen.dart";
import "discussion_chat_screen.dart";
import "resources_screen.dart";
import "subject_form_screen.dart";
import "quizzes_screen.dart";
import "forum_screen.dart";
import "gradebook_screen.dart";
import "attendance_screen.dart";
import "peer_reviews_screen.dart";
import "completion_screen.dart";
import "groups_screen.dart";
import "ai_study_materials_screen.dart";
import "plagiarism_screen.dart";

// ── Tool definition ───────────────────────────────────────────────────────────
class _ToolDef {
  final String Function(S) title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Color color2;
  final VoidCallback onTap;

  const _ToolDef({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.color2,
    required this.onTap,
  });
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

class SubjectDetailScreen extends StatefulWidget {
  final String subjectId;
  final String subjectName;
  const SubjectDetailScreen(
      {super.key, required this.subjectId, required this.subjectName});
  @override
  State<SubjectDetailScreen> createState() => _SubjectDetailScreenState();
}

class _SubjectDetailScreenState extends State<SubjectDetailScreen> {
  Map<String, dynamic>? _course;
  String _role = "student";
  bool _loading = true;

  // ── Per-course colour palette (same hash logic as subjects_screen) ──────────
  static const _accentColors = [
    Color(0xFF7C93C5), // slate blue
    Color(0xFFA79FCD), // lavender
    Color(0xFF8BB5C9), // sky
    Color(0xFF8FA68E), // sage
    Color(0xFFC9B58A), // sand
    Color(0xFFC99FB0), // dusty rose
    Color(0xFFD8A28E), // peach
    Color(0xFF8891B8), // periwinkle
    Color(0xFF7BB5B0), // seafoam
    Color(0xFFC29AA3), // blush
  ];
  static const _gradientPairs = [
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

  Color get _accent {
    final idx = widget.subjectId.hashCode.abs() % _accentColors.length;
    return _accentColors[idx];
  }

  LinearGradient get _headerGradient {
    final idx = widget.subjectId.hashCode.abs() % _gradientPairs.length;
    return LinearGradient(
      colors: _gradientPairs[idx],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final me = await ApiService.getMe();
      final course = await ApiService.getCourse(widget.subjectId);
      if (!mounted) return;
      setState(() {
        _course = course;
        _role = (me["role"] ?? "student").toString();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = context.isDark;
    final isLecturer = _role == "lecturer";
    final s = S.of(context);

    if (_loading) {
      return AppBackground(
        applySafeArea: false,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: const SafeArea(child: SkeletonDetail()),
        ),
      );
    }

    final courseName = _course?["course_name"] ?? widget.subjectName;
    final courseCode = _course?["course_code"] ?? "";
    final semester = _course?["semester"] ?? "";
    final joinCode = _course?["join_code"] ?? "";
    final enrolled = (_course?["enrolled_count"] ?? 0).toString();
    final description = (_course?["description"] ?? "").toString();

    // ── Build tool list ──────────────────────────────────────────────────────
    final tools = <_ToolDef>[
      _ToolDef(
        title: (s) => s.resources,
        subtitle: "Lecture notes & files",
        icon: Icons.folder_open_rounded,
        color: const Color(0xFFC99FB0),
        color2: const Color(0xFFA395C9),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ResourcesScreen(courseId: widget.subjectId, courseName: widget.subjectName, isLecturer: isLecturer))),
      ),
      _ToolDef(
        title: (s) => s.assignments,
        subtitle: "Tasks & submissions",
        icon: Icons.assignment_rounded,
        color: const Color(0xFF7C93C5),
        color2: const Color(0xFF8891B8),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AssignmentsTab(courseId: widget.subjectId, courseName: widget.subjectName, isLecturer: isLecturer))),
      ),
      _ToolDef(
        title: (s) => s.quizzes,
        subtitle: "Tests & results",
        icon: Icons.quiz_rounded,
        color: const Color(0xFFA395C9),
        color2: const Color(0xFF8891B8),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => QuizzesScreen(courseId: widget.subjectId, courseName: widget.subjectName, isLecturer: isLecturer))),
      ),
      _ToolDef(
        title: (s) => s.classChat,
        subtitle: "Live messaging",
        icon: Icons.chat_bubble_rounded,
        color: const Color(0xFF7AB0B5),
        color2: const Color(0xFF7C93C5),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DiscussionChatScreen(courseId: widget.subjectId, courseName: widget.subjectName))),
      ),
      _ToolDef(
        title: (s) => s.forum,
        subtitle: "Q&A & discussions",
        icon: Icons.forum_rounded,
        color: const Color(0xFF8891B8),
        color2: const Color(0xFFA395C9),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ForumScreen(courseId: widget.subjectId, courseName: widget.subjectName, isLecturer: isLecturer))),
      ),
      _ToolDef(
        title: (s) => s.announcements,
        subtitle: "Class updates",
        icon: Icons.campaign_rounded,
        color: const Color(0xFFC9A86A),
        color2: const Color(0xFFD5B28A),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AnnouncementFormScreen(courseId: widget.subjectId, courseName: widget.subjectName))),
      ),
      _ToolDef(
        title: (s) => s.gradebook,
        subtitle: "Marks & scores",
        icon: Icons.bar_chart_rounded,
        color: const Color(0xFFC99999),
        color2: const Color(0xFFC99FB0),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => GradebookScreen(courseId: widget.subjectId, courseName: widget.subjectName, isLecturer: isLecturer))),
      ),
      _ToolDef(
        title: (s) => s.attendance,
        subtitle: "Track sessions",
        icon: Icons.fact_check_rounded,
        color: const Color(0xFF7BB5B0),
        color2: const Color(0xFF8FA68E),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AttendanceScreen(courseId: widget.subjectId, courseName: widget.subjectName, isLecturer: isLecturer))),
      ),
      _ToolDef(
        title: (s) => s.groups,
        subtitle: "Team collaboration",
        icon: Icons.group_rounded,
        color: const Color(0xFFD8A28E),
        color2: const Color(0xFFC9A86A),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => GroupsScreen(courseId: widget.subjectId, courseName: widget.subjectName, isLecturer: isLecturer))),
      ),
      _ToolDef(
        title: (s) => s.peerReviews,
        subtitle: isLecturer ? "View student reviews" : "Review peers",
        icon: Icons.rate_review_rounded,
        color: const Color(0xFFC99999),
        color2: const Color(0xFFD8A28E),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PeerReviewsScreen(courseId: widget.subjectId, courseName: widget.subjectName))),
      ),
      if (isLecturer)
        _ToolDef(
          title: (s) => s.completion,
          subtitle: "Student progress",
          icon: Icons.check_circle_outline_rounded,
          color: const Color(0xFF8FA68E),
          color2: const Color(0xFF7BB5B0),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CompletionScreen(courseId: widget.subjectId, courseName: widget.subjectName))),
        ),
      if (!isLecturer)
        _ToolDef(
          title: (s) => s.aiMaterials,
          subtitle: "Smart study aids",
          icon: Icons.auto_stories_rounded,
          color: const Color(0xFF9F8CC4),
          color2: const Color(0xFF8891B8),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AiStudyMaterialsScreen(courseId: widget.subjectId, courseName: widget.subjectName))),
        ),
      // ── Lecturer-only advanced tools ───────────────────────────────────────
      if (isLecturer)
        _ToolDef(
          title: (_) => "Plagiarism",
          subtitle: "Check submission integrity",
          icon: Icons.shield_outlined,
          color: const Color(0xFFB09AA8),
          color2: const Color(0xFFD8A28E),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PlagiarismScreen(courseId: widget.subjectId, courseName: widget.subjectName))),
        ),
    ];

    return AppBackground(
      applySafeArea: false,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: CustomScrollView(
        slivers: [
          // ── App Bar ────────────────────────────────────────────────────────
          SliverAppBar(
            expandedHeight: 230,
            pinned: true,
            backgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            elevation: 0,
            actions: isLecturer
                ? [
                    IconButton(
                      icon: const Icon(Icons.edit_rounded),
                      onPressed: () async {
                        await Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => SubjectFormScreen(
                                    existingCourse: _course)));
                        _load();
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded,
                          color: Colors.redAccent),
                      onPressed: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: colors.surfaceCard,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20)),
                            title: Text("Delete Course?",
                                style:
                                    TextStyle(color: colors.textPrimary)),
                            content: Text(
                                "This will permanently delete this course and all its data.",
                                style: TextStyle(
                                    color: colors.textSecondary)),
                            actions: [
                              TextButton(
                                  onPressed: () =>
                                      Navigator.pop(ctx, false),
                                  child: const Text("Cancel")),
                              TextButton(
                                  onPressed: () =>
                                      Navigator.pop(ctx, true),
                                  child: const Text("Delete",
                                      style: TextStyle(
                                          color: Colors.red))),
                            ],
                          ),
                        );
                        if (confirm == true) {
                          await ApiService.deleteCourse(widget.subjectId);
                          if (mounted) Navigator.pop(context);
                        }
                      },
                    ),
                  ]
                : null,
            flexibleSpace: FlexibleSpaceBar(
              collapseMode: CollapseMode.parallax,
              background: Container(
                decoration: BoxDecoration(gradient: _headerGradient),
                child: Stack(
                  children: [
                    // Pattern overlay (right half, fading from left)
                    Positioned.fill(
                      child: ShaderMask(
                        shaderCallback: (bounds) => const LinearGradient(
                          colors: [Colors.transparent, Colors.white],
                        ).createShader(Rect.fromLTWH(
                            bounds.width * 0.3, 0, bounds.width * 0.7, bounds.height)),
                        blendMode: BlendMode.dstIn,
                        child: Opacity(
                          opacity: 0.3,
                          child: Image.asset(
                            getPatternForSubject(widget.subjectId),
                            repeat: ImageRepeat.repeat,
                          ),
                        ),
                      ),
                    ),
                    // Decorative orbs
                    Positioned(
                      top: -40, right: -40,
                      child: Container(
                        width: 180, height: 180,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              Colors.white.withValues(alpha: 0.10),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: -30, left: -30,
                      child: Container(
                        width: 120, height: 120,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.06),
                        ),
                      ),
                    ),
                    // Course info
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 90, 20, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          // Role + code pill row
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.22),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  isLecturer ? "Lecturer" : "Student",
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.5),
                                ),
                              ),
                              if (courseCode.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                        color:
                                            Colors.white.withOpacity(0.3)),
                                  ),
                                  child: Text(
                                    courseCode,
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 10),
                          // Course name
                          Text(
                            courseName,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                letterSpacing: -0.3),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 8),
                          // Stats row
                          Row(
                            children: [
                              if (semester.toString().isNotEmpty) ...[
                                Icon(Icons.calendar_today_rounded,
                                    color: Colors.white.withOpacity(0.75),
                                    size: 13),
                                const SizedBox(width: 4),
                                Text(
                                  "Sem $semester",
                                  style: TextStyle(
                                      color:
                                          Colors.white.withOpacity(0.85),
                                      fontSize: 12),
                                ),
                                const SizedBox(width: 14),
                              ],
                              if (isLecturer) ...[
                                Icon(Icons.people_rounded,
                                    color: Colors.white.withOpacity(0.75),
                                    size: 13),
                                const SizedBox(width: 4),
                                Text(
                                  "$enrolled students",
                                  style: TextStyle(
                                      color:
                                          Colors.white.withOpacity(0.85),
                                      fontSize: 12),
                                ),
                                const SizedBox(width: 14),
                              ],
                              // Join code chip for lecturers
                              if (isLecturer && joinCode.isNotEmpty)
                                GestureDetector(
                                  onTap: () {
                                    HapticFeedback.lightImpact();
                                    Clipboard.setData(
                                        ClipboardData(text: joinCode));
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(const SnackBar(
                                      content:
                                          Text("Join code copied!"),
                                      backgroundColor: AppColors.emerald,
                                    ));
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color:
                                          Colors.white.withOpacity(0.22),
                                      borderRadius:
                                          BorderRadius.circular(8),
                                      border: Border.all(
                                          color: Colors.white
                                              .withOpacity(0.3)),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(
                                            Icons.vpn_key_rounded,
                                            color: Colors.white,
                                            size: 11),
                                        const SizedBox(width: 5),
                                        Text(
                                          joinCode,
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 2,
                                              fontSize: 11),
                                        ),
                                        const SizedBox(width: 5),
                                        Icon(Icons.copy_rounded,
                                            color: Colors.white
                                                .withOpacity(0.8),
                                            size: 11),
                                      ],
                                    ),
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
            ),
          ),

          // ── Body ──────────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Optional description card
                  if (description.isNotEmpty) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          margin: const EdgeInsets.only(bottom: 20),
                          decoration: BoxDecoration(
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.04)
                                : Colors.white.withValues(alpha: 0.65),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isDark
                                  ? Colors.white.withValues(alpha: 0.08)
                                  : Colors.black.withValues(alpha: 0.06),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.info_outline_rounded,
                                  color: _accent, size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  description,
                                  style: TextStyle(
                                      color: colors.textSecondary,
                                      fontSize: 13,
                                      height: 1.4),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],

                  // Section header
                  Row(
                    children: [
                      Container(
                        width: 4,
                        height: 20,
                        decoration: BoxDecoration(
                          gradient: _headerGradient,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        s.courseTools,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: _accent.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          "${tools.length}",
                          style: TextStyle(
                              color: _accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Tool grid
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 14,
                      crossAxisSpacing: 14,
                      childAspectRatio: 1.0,
                    ),
                    itemCount: tools.length,
                    itemBuilder: (_, i) => _toolCard(tools[i], s),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }

  Widget _toolCard(_ToolDef tool, S s) {
    final colors = context.colors;
    final isDark = context.isDark;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        tool.onTap();
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.06)
                  : Colors.white.withValues(alpha: 0.65),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : Colors.black.withValues(alpha: 0.06),
              ),
              boxShadow: isDark
                  ? []
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon box — solid pastel gradient fill for strong icon contrast
                Container(
                  width: 44,
                  height: 44,
                  clipBehavior: Clip.hardEdge,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        tool.color.withValues(alpha: isDark ? 0.95 : 0.90),
                        tool.color2.withValues(alpha: isDark ? 0.95 : 0.90),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: isDark ? 0.22 : 0.55),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: tool.color.withValues(alpha: isDark ? 0.35 : 0.25),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Positioned.fill(
                        child: Opacity(
                          opacity: 0.18,
                          child: Image.asset(
                            getPatternForSubject(widget.subjectId),
                            repeat: ImageRepeat.repeat,
                          ),
                        ),
                      ),
                      Icon(tool.icon, color: Colors.white, size: 22),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // Tool name
                Text(
                  tool.title(s),
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.1,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                // Subtitle
                Text(
                  tool.subtitle,
                  style: TextStyle(
                    color: colors.textMuted,
                    fontSize: 11,
                    height: 1.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Spacer(),
                // Open CTA
                Row(
                  children: [
                    Text(
                      "Open",
                      style: TextStyle(
                        color: tool.color,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.arrow_forward_rounded,
                        color: tool.color, size: 14),
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

