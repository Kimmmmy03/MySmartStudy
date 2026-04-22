import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import 'subject_detail_screen.dart';
import 'subjects_screen.dart' show courseGradient, courseAccent, courseIcon;
import '../models/subject_model.dart';

class LecturerClassManagementScreen extends StatefulWidget {
  const LecturerClassManagementScreen({super.key});
  @override
  State<LecturerClassManagementScreen> createState() =>
      _LecturerClassManagementScreenState();
}

class _LecturerClassManagementScreenState
    extends State<LecturerClassManagementScreen> {
  List<Map<String, dynamic>> _courses = [];
  bool _loading = true;
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _filtered = [];

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
      final raw = await ApiService.getTeachingCourses();
      if (!mounted) return;
      setState(() {
        _courses = raw.map((c) => Map<String, dynamic>.from(c)).toList();
        _filter();
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
          : _courses.where((c) {
              final name = (c['course_name'] ?? '').toString().toLowerCase();
              final code = (c['course_code'] ?? '').toString().toLowerCase();
              return name.contains(q) || code.contains(q);
            }).toList();
    });
  }

  Future<void> _createCourse() async {
    final nameCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final semCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    final ok = await showGlassBottomSheet<bool>(
      context: context,
      builder: (ctx) => _CreateClassSheet(
        nameCtrl: nameCtrl,
        codeCtrl: codeCtrl,
        semCtrl: semCtrl,
        descCtrl: descCtrl,
      ),
    );

    if (ok != true) return;
    if (nameCtrl.text.trim().isEmpty) return;

    try {
      await ApiService.createCourse(
        courseName: nameCtrl.text.trim(),
        courseCode: codeCtrl.text.trim(),
        semester: semCtrl.text.trim(),
        description: descCtrl.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Course created!'),
          backgroundColor: AppColors.emerald,
        ));
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: AppColors.red,
        ));
      }
    }
  }

  Future<void> _deleteCourse(Map<String, dynamic> course) async {
    final id = (course['id'] ?? '').toString();
    final name = (course['course_name'] ?? 'this course').toString();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final c = ctx.colors;
        return AlertDialog(
          backgroundColor: c.surfaceCard,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text('Delete Course?',
              style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold)),
          content: Text(
              '"$name" and all its content will be permanently deleted.',
              style: TextStyle(color: c.textSecondary)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Cancel', style: TextStyle(color: c.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.red),
              child: const Text('Delete', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
    if (confirmed != true) return;
    try {
      await ApiService.deleteCourse(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Course deleted'),
          backgroundColor: AppColors.red,
        ));
        _load();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isDark = context.isDark;
    final totalStudents =
        _courses.fold<int>(0, (s, c) => s + ((c['enrolled_count'] ?? 0) as int));

    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Class Management',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            tooltip: 'New Class',
            icon: const Icon(Icons.add_rounded, color: AppColors.purple),
            onPressed: _createCourse,
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: Icon(Icons.refresh_rounded, color: c.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const SkeletonList(itemCount: 5)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.purple,
              child: AnimationLimiter(
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics()),
                  slivers: [
                    // Summary header
                    SliverToBoxAdapter(
                      child: AnimatedListItem(
                        index: 0,
                        child: _buildSummaryRow(c, totalStudents),
                      ),
                    ),

                    // Search bar
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                        child: TextField(
                          controller: _searchCtrl,
                          style: TextStyle(color: c.textPrimary, fontSize: 14),
                          decoration: InputDecoration(
                            hintText: 'Search courses…',
                            hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
                            prefixIcon:
                                Icon(Icons.search_rounded, color: c.textMuted, size: 20),
                            suffixIcon: _searchCtrl.text.isNotEmpty
                                ? IconButton(
                                    icon: Icon(Icons.close_rounded,
                                        color: c.textMuted, size: 18),
                                    onPressed: () {
                                      _searchCtrl.clear();
                                      _filter();
                                    },
                                  )
                                : null,
                            filled: true,
                            fillColor: c.surfaceElevated,
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: c.border)),
                            enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: c.border)),
                            focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide:
                                    const BorderSide(color: AppColors.purple)),
                            contentPadding:
                                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          ),
                        ),
                      ),
                    ),

                    // Count label
                    if (_filtered.isNotEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 6),
                          child: Text(
                            '${_filtered.length} class${_filtered.length == 1 ? '' : 'es'}',
                            style: TextStyle(color: c.textMuted, fontSize: 12),
                          ),
                        ),
                      ),

                    // Empty state
                    if (_filtered.isEmpty)
                      SliverToBoxAdapter(
                        child: SizedBox(
                          height: 320,
                          child: EmptyState(
                            icon: Icons.school_rounded,
                            title: _searchCtrl.text.isNotEmpty
                                ? 'No results'
                                : 'No classes yet',
                            subtitle: _searchCtrl.text.isNotEmpty
                                ? 'Try a different search'
                                : 'Tap + to create your first class',
                          ),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (_, i) => AnimatedListItem(
                              index: i + 1,
                              child: _CourseCard(
                                course: _filtered[i],
                                isDark: isDark,
                                colors: c,
                                onOpen: () async {
                                  final id =
                                      (_filtered[i]['id'] ?? '').toString();
                                  final name =
                                      (_filtered[i]['course_name'] ?? '').toString();
                                  await Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (_) => SubjectDetailScreen(
                                            subjectId: id,
                                            subjectName: name)),
                                  );
                                  _load();
                                },
                                onCopyCode: () {
                                  final code =
                                      (_filtered[i]['join_code'] ?? '').toString();
                                  Clipboard.setData(ClipboardData(text: code));
                                  HapticFeedback.lightImpact();
                                  ScaffoldMessenger.of(context)
                                      .showSnackBar(const SnackBar(
                                    content: Text('Join code copied!'),
                                    duration: Duration(seconds: 1),
                                  ));
                                },
                                onDelete: () => _deleteCourse(_filtered[i]),
                              ),
                            ),
                            childCount: _filtered.length,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSummaryRow(AppColorScheme c, int totalStudents) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Row(children: [
        _statPill(c, '${_courses.length}', 'Classes', Icons.school_rounded,
            AppColors.purple),
        const SizedBox(width: 10),
        _statPill(c, '$totalStudents', 'Students', Icons.people_rounded,
            AppColors.blue),
      ]),
    );
  }

  Widget _statPill(AppColorScheme c, String value, String label, IconData icon,
      Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.10),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.20)),
        ),
        child: Row(children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value,
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
            Text(label,
                style: TextStyle(color: c.textMuted, fontSize: 11)),
          ]),
        ]),
      ),
    );
  }
}

// ── Course Card ───────────────────────────────────────────────────────────────

class _CourseCard extends StatelessWidget {
  final Map<String, dynamic> course;
  final bool isDark;
  final AppColorScheme colors;
  final VoidCallback onOpen;
  final VoidCallback onCopyCode;
  final VoidCallback onDelete;

  const _CourseCard({
    required this.course,
    required this.isDark,
    required this.colors,
    required this.onOpen,
    required this.onCopyCode,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final c = colors;
    final id = (course['id'] ?? '').toString();
    final name = (course['course_name'] ?? 'Untitled').toString();
    final code = (course['course_code'] ?? '').toString();
    final semester = (course['semester'] ?? '').toString();
    final joinCode = (course['join_code'] ?? '').toString();
    final enrolledCount = (course['enrolled_count'] ?? 0) as int;
    final description = (course['description'] ?? '').toString();

    // Use same accent as SubjectsScreen
    final model = UserSubjectModel(
      subjectId: id,
      name: name,
      courseCode: code,
      lecturerName: '',
      joinCode: joinCode,
      roleInSubject: 'lecturer',
      enrolledCount: enrolledCount,
    );
    final grad = courseGradient(id);
    final accent = courseAccent(id);
    final icon = courseIcon(model);

    return GestureDetector(
      onTap: onOpen,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: c.surfaceCard.withOpacity(isDark ? 0.55 : 0.9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.border),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 12,
                      offset: const Offset(0, 3))
                ],
        ),
        child: Row(children: [
          // Left gradient accent
          Container(
            width: 6,
            height: 92,
            decoration: BoxDecoration(
              gradient: grad,
              borderRadius:
                  const BorderRadius.horizontal(left: Radius.circular(20)),
            ),
          ),
          // Course icon
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: grad,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: Colors.white, size: 24),
            ),
          ),
          // Info
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(name,
                    style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        letterSpacing: -0.2),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Row(children: [
                  if (code.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                          color: accent.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6)),
                      child: Text(code,
                          style: TextStyle(
                              color: accent,
                              fontSize: 10,
                              fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Icon(Icons.people_outline_rounded,
                      size: 13, color: c.textMuted),
                  const SizedBox(width: 3),
                  Text('$enrolledCount student${enrolledCount == 1 ? '' : 's'}',
                      style: TextStyle(color: c.textMuted, fontSize: 12)),
                  if (semester.isNotEmpty) ...[
                    Text('  •  ',
                        style: TextStyle(color: c.textMuted, fontSize: 12)),
                    Text(semester,
                        style: TextStyle(color: c.textMuted, fontSize: 11)),
                  ],
                ]),
                if (joinCode.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  GestureDetector(
                    onTap: onCopyCode,
                    child: Row(children: [
                      Icon(Icons.vpn_key_rounded,
                          size: 12, color: accent.withOpacity(0.7)),
                      const SizedBox(width: 4),
                      Text(joinCode,
                          style: TextStyle(
                              color: accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.5)),
                      const SizedBox(width: 4),
                      Icon(Icons.copy_rounded,
                          size: 11, color: accent.withOpacity(0.6)),
                    ]),
                  ),
                ],
              ]),
            ),
          ),
          // Actions
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.arrow_forward_ios_rounded,
                      size: 14, color: c.textMuted),
                  onPressed: onOpen,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded,
                      size: 16, color: AppColors.red),
                  onPressed: onDelete,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Create Class Bottom Sheet ────────────────────────────────────────────────

class _CreateClassSheet extends StatefulWidget {
  final TextEditingController nameCtrl;
  final TextEditingController codeCtrl;
  final TextEditingController semCtrl;
  final TextEditingController descCtrl;

  const _CreateClassSheet({
    required this.nameCtrl,
    required this.codeCtrl,
    required this.semCtrl,
    required this.descCtrl,
  });

  @override
  State<_CreateClassSheet> createState() => _CreateClassSheetState();
}

class _CreateClassSheetState extends State<_CreateClassSheet> {
  static const _slate = Color(0xFF7C93C5);
  static const _lavender = Color(0xFFA79FCD);

  String? _selectedSemester;
  static const _semesters = [
    'Sem 1 2024',
    'Sem 2 2024',
    'Sem 1 2025',
    'Sem 2 2025',
    'Sem 1 2026',
    'Sem 2 2026',
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final mq = MediaQuery.of(context);
    final canCreate = widget.nameCtrl.text.trim().isNotEmpty;

    return Padding(
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_slate, _lavender],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: _slate.withOpacity(0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.school_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Create New Class',
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              letterSpacing: -0.3)),
                      const SizedBox(height: 2),
                      Text('Set up a new course for your students',
                          style: TextStyle(color: c.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: c.textMuted, size: 22),
                  onPressed: () => Navigator.pop(context, false),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // ── Course details section ──
            _sectionLabel(c, 'COURSE DETAILS'),
            const SizedBox(height: 10),
            GlassCard(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  TextField(
                    controller: widget.nameCtrl,
                    autofocus: true,
                    style: TextStyle(color: c.textPrimary),
                    onChanged: (_) => setState(() {}),
                    decoration: AppTheme.inputDecoration(
                      context,
                      label: 'Course Name *',
                      prefixIcon: Icons.menu_book_rounded,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: widget.codeCtrl,
                    textCapitalization: TextCapitalization.characters,
                    style: TextStyle(color: c.textPrimary),
                    decoration: AppTheme.inputDecoration(
                      context,
                      label: 'Course Code (e.g. CS101)',
                      prefixIcon: Icons.tag_rounded,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Semester section ──
            _sectionLabel(c, 'SEMESTER'),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _semesters.map((s) {
                final selected = _selectedSemester == s;
                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _selectedSemester = s;
                      widget.semCtrl.text = s;
                    });
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: selected ? _slate.withOpacity(0.18) : c.surfaceElevated,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: selected ? _slate : c.border,
                        width: selected ? 1.2 : 1,
                      ),
                    ),
                    child: Text(
                      s,
                      style: TextStyle(
                        color: selected ? _slate : c.textSecondary,
                        fontSize: 12,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // ── Description section ──
            _sectionLabel(c, 'DESCRIPTION'),
            const SizedBox(height: 10),
            GlassCard(
              padding: const EdgeInsets.all(14),
              child: TextField(
                controller: widget.descCtrl,
                maxLines: 3,
                style: TextStyle(color: c.textPrimary),
                decoration: AppTheme.inputDecoration(
                  context,
                  label: 'What is this course about? (optional)',
                  prefixIcon: Icons.description_rounded,
                ),
              ),
            ),
            const SizedBox(height: 22),

            // ── Footer actions ──
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, false),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: BorderSide(color: c.border),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text('Cancel',
                        style: TextStyle(
                            color: c.textSecondary,
                            fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: canCreate ? () => Navigator.pop(context, true) : null,
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Create Class'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _slate,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: c.surfaceElevated,
                      disabledForegroundColor: c.textMuted,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: canCreate ? 4 : 0,
                      shadowColor: _slate.withOpacity(0.4),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      textStyle: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(AppColorScheme c, String label) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        label,
        style: TextStyle(
          color: c.textMuted,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}
