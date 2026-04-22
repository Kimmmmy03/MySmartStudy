import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../models/announcement_model.dart';
import '../models/subject_model.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/app_background.dart';
import 'subjects_screen.dart' show courseGradient, courseAccent;

// ── Pastel palette (matches Courses overhaul) ────────────────────────────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pRose = Color(0xFFC99999);

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});
  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen>
    with SingleTickerProviderStateMixin {
  bool _loading = true;
  List<AnnouncementModel> _announcements = [];
  List<SubjectModel> _teachingCourses = [];
  List<SubjectModel> _enrolledCourses = [];
  String _userRole = 'student';

  // Filters
  String _search = '';
  String? _courseFilter; // null = all

  // Inline composer
  bool _composerOpen = false;
  bool _posting = false;
  String? _composerCourseId;
  final _titleCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  late final AnimationController _composerAnim;

  @override
  void initState() {
    super.initState();
    _composerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    );
    _load();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    _composerAnim.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────── data ────

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final me = await ApiService.getMe();
      _userRole = (me['role'] ?? 'student').toString();

      final List<dynamic> teachingRaw =
          _userRole == 'lecturer' ? await ApiService.getTeachingCourses() : [];
      final List<dynamic> enrolledRaw = await ApiService.getEnrolledCourses();

      _teachingCourses = teachingRaw
          .map((c) => SubjectModel.fromApi(Map<String, dynamic>.from(c)))
          .toList();
      _enrolledCourses = enrolledRaw
          .map((c) => SubjectModel.fromApi(Map<String, dynamic>.from(c)))
          .toList();

      final allCourses = <SubjectModel>[..._teachingCourses, ..._enrolledCourses];

      final List<AnnouncementModel> allAnns = [];
      for (final course in allCourses) {
        try {
          final raw = await ApiService.getAnnouncements(course.id);
          for (final a in raw) {
            allAnns.add(AnnouncementModel.fromApi(
              Map<String, dynamic>.from(a),
              subjectName: course.name,
            ));
          }
        } catch (_) {}
      }

      allAnns.sort((a, b) {
        final aDate = a.createdAt ?? DateTime(1970);
        final bDate = b.createdAt ?? DateTime(1970);
        return bDate.compareTo(aDate);
      });

      _composerCourseId ??=
          _teachingCourses.isNotEmpty ? _teachingCourses.first.id : null;

      if (!mounted) return;
      setState(() {
        _announcements = allAnns;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ─────────────────────────────────────────── actions ────

  Future<void> _deleteAnnouncement(AnnouncementModel ann) async {
    final confirmed = await showConfirmationDialog(
      context: context,
      title: 'Delete Announcement',
      message: 'Delete "${ann.title}"? This cannot be undone.',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (confirmed == true) {
      try {
        await ApiService.deleteAnnouncement(ann.subjectId, ann.id);
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete: $e'),
              backgroundColor: _pRose,
            ),
          );
        }
      }
    }
  }

  Future<void> _submitComposer() async {
    final title = _titleCtrl.text.trim();
    final body = _bodyCtrl.text.trim();
    final courseId = _composerCourseId;
    if (title.isEmpty || body.isEmpty || courseId == null) return;

    HapticFeedback.mediumImpact();
    setState(() => _posting = true);
    try {
      await ApiService.createAnnouncement(courseId, title, body);
      _titleCtrl.clear();
      _bodyCtrl.clear();
      setState(() {
        _posting = false;
        _composerOpen = false;
      });
      _composerAnim.reverse();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Announcement posted'),
            backgroundColor: _pSlate,
          ),
        );
      }
      _load();
    } catch (e) {
      setState(() => _posting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to post: $e'),
            backgroundColor: _pRose,
          ),
        );
      }
    }
  }

  void _toggleComposer() {
    HapticFeedback.lightImpact();
    setState(() => _composerOpen = !_composerOpen);
    if (_composerOpen) {
      _composerAnim.forward();
    } else {
      _composerAnim.reverse();
    }
  }

  Future<void> _showCoursePicker() async {
    final picked = await showGlassBottomSheet<String>(
      context: context,
      builder: (ctx) {
        final c = context.colors;
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 4, top: 8, bottom: 12),
                child: Text(
                  'Select Course',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              ..._teachingCourses.map((cr) {
                final selected = cr.id == _composerCourseId;
                final accent = courseAccent(cr.id);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: GlassCard(
                    padding: EdgeInsets.zero,
                    borderColor: selected
                        ? accent.withValues(alpha: 0.5)
                        : null,
                    onTap: () => Navigator.pop(ctx, cr.id),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              gradient: courseGradient(cr.id),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.class_rounded,
                                color: Colors.white, size: 18),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              cr.name,
                              style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (selected)
                            Icon(Icons.check_circle_rounded,
                                color: accent, size: 20),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
    if (picked != null) {
      setState(() => _composerCourseId = picked);
    }
  }

  // ─────────────────────────────────────────── helpers ────

  String _formatRelative(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  String _groupKey(DateTime? dt) {
    if (dt == null) return 'Earlier';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final that = DateTime(dt.year, dt.month, dt.day);
    final days = today.difference(that).inDays;
    if (days <= 0) return 'Today';
    if (days == 1) return 'Yesterday';
    if (days <= 7) return 'This Week';
    if (days <= 30) return 'This Month';
    return 'Earlier';
  }

  List<AnnouncementModel> get _filtered {
    final q = _search.trim().toLowerCase();
    return _announcements.where((a) {
      if (_courseFilter != null && a.subjectId != _courseFilter) return false;
      if (q.isEmpty) return true;
      return a.title.toLowerCase().contains(q) ||
          a.message.toLowerCase().contains(q) ||
          a.subjectName.toLowerCase().contains(q);
    }).toList();
  }

  // ─────────────────────────────────────────── build ────

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLecturer = _userRole == 'lecturer';

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Announcements',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: context.isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        actions: [
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: c.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: isLecturer ? _pLavender : _pSlate,
                  child: _buildBody(isLecturer),
                ),
        ),
      ),
    );
  }

  Widget _buildBody(bool isLecturer) {
    final list = _filtered;
    final grouped = <String, List<AnnouncementModel>>{};
    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];
    for (final a in list) {
      grouped.putIfAbsent(_groupKey(a.createdAt), () => []).add(a);
    }
    final groupOrder = order.where(grouped.containsKey).toList();

    return AnimationLimiter(
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        slivers: [
          // ── Summary header ──
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: _buildSummaryHeader(isLecturer),
            ),
          ),

          // ── Inline composer (lecturer only) ──
          if (isLecturer && _teachingCourses.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
                child: _buildComposerCard(),
              ),
            ),

          // ── Search ──
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
              child: _buildSearchBar(),
            ),
          ),

          // ── Course filter chips ──
          if (_teachingCourses.isNotEmpty || _enrolledCourses.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 0, 0, 14),
                child: _buildFilterChips(isLecturer),
              ),
            ),

          // ── Empty state ──
          if (list.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _buildEmpty(isLecturer),
            )
          else
            // ── Grouped list ──
            ...groupOrder.map((group) {
              final items = grouped[group]!;
              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 6),
                sliver: SliverList.builder(
                  itemCount: items.length + 1,
                  itemBuilder: (_, i) {
                    if (i == 0) return _buildGroupLabel(group, items.length);
                    final ann = items[i - 1];
                    return AnimatedListItem(
                      index: i,
                      child: _buildAnnouncementCard(ann),
                    );
                  },
                ),
              );
            }),

          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }

  // ─────────────────────────────────────── summary header ────

  Widget _buildSummaryHeader(bool isLecturer) {
    final c = context.colors;
    final total = _announcements.length;
    final now = DateTime.now();
    final weekAgo = now.subtract(const Duration(days: 7));
    final thisWeek = _announcements
        .where((a) => (a.createdAt ?? DateTime(1970)).isAfter(weekAgo))
        .length;
    final courses = isLecturer
        ? _teachingCourses.length
        : _enrolledCourses.length;

    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      gradient: LinearGradient(
        colors: [
          _pSlate.withValues(alpha: context.isDark ? 0.14 : 0.08),
          _pLavender.withValues(alpha: context.isDark ? 0.10 : 0.05),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: _pSlate.withValues(alpha: 0.25),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_pSlate, _pLavender],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: _pSlate.withValues(alpha: 0.32),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.campaign_rounded,
                color: Colors.white, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$total Announcement${total == 1 ? '' : 's'}',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$thisWeek this week · $courses course${courses == 1 ? '' : 's'}',
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────── inline composer ────

  Widget _buildComposerCard() {
    final c = context.colors;
    final selectedCourse = _teachingCourses.firstWhere(
      (cr) => cr.id == _composerCourseId,
      orElse: () => _teachingCourses.first,
    );
    final accent = courseAccent(selectedCourse.id);

    return GlassCard(
      padding: EdgeInsets.zero,
      borderColor: _composerOpen
          ? _pLavender.withValues(alpha: 0.4)
          : null,
      child: Column(
        children: [
          // Header strip — tappable to toggle
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: _toggleComposer,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [_pLavender, _pSlate],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(11),
                      boxShadow: [
                        BoxShadow(
                          color: _pLavender.withValues(alpha: 0.30),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.edit_note_rounded,
                        color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _composerOpen ? 'New Announcement' : 'Post an announcement',
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _composerOpen
                              ? 'Broadcast to ${selectedCourse.name}'
                              : 'Tap to compose a message to your students',
                          style: TextStyle(
                            color: c.textSecondary,
                            fontSize: 11.5,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _composerOpen ? 0.5 : 0,
                    duration: const Duration(milliseconds: 260),
                    child: Icon(Icons.keyboard_arrow_down_rounded,
                        color: c.textMuted, size: 22),
                  ),
                ],
              ),
            ),
          ),

          // Animated form body
          ClipRect(
            child: SizeTransition(
              axisAlignment: -1,
              sizeFactor: CurvedAnimation(
                parent: _composerAnim,
                curve: Curves.easeOutCubic,
              ),
              child: FadeTransition(
                opacity: _composerAnim,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Divider(color: c.border, height: 1),
                      const SizedBox(height: 12),
                      // Course selector row
                      GestureDetector(
                        onTap: _showCoursePicker,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: accent.withValues(alpha: 0.25)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  gradient: courseGradient(selectedCourse.id),
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: const Icon(Icons.class_rounded,
                                    color: Colors.white, size: 14),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  selectedCourse.name,
                                  style: TextStyle(
                                    color: c.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Icon(Icons.unfold_more_rounded,
                                  color: c.textMuted, size: 18),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      // Title
                      _composerField(
                        controller: _titleCtrl,
                        hint: 'Title',
                        icon: Icons.title_rounded,
                      ),
                      const SizedBox(height: 8),
                      // Body
                      _composerField(
                        controller: _bodyCtrl,
                        hint: 'Write your announcement…',
                        icon: Icons.notes_rounded,
                        maxLines: 5,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          TextButton(
                            onPressed: _posting
                                ? null
                                : () {
                                    _titleCtrl.clear();
                                    _bodyCtrl.clear();
                                    _toggleComposer();
                                  },
                            child: Text('Cancel',
                                style: TextStyle(color: c.textSecondary)),
                          ),
                          const Spacer(),
                          ElevatedButton.icon(
                            onPressed: _posting ? null : _submitComposer,
                            icon: _posting
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.send_rounded, size: 16),
                            label: Text(_posting ? 'Posting…' : 'Post'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _pLavender,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 18, vertical: 11),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                              textStyle: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _composerField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    int maxLines = 1,
  }) {
    final c = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: c.surfaceInput,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        minLines: 1,
        style: TextStyle(color: c.textPrimary, fontSize: 13.5),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: c.textMuted, fontSize: 13.5),
          prefixIcon: Padding(
            padding: EdgeInsets.only(
                left: 4, top: maxLines > 1 ? 10 : 0, bottom: 0),
            child: Icon(icon, color: c.textMuted, size: 18),
          ),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 40, minHeight: 20),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.fromLTRB(4, 12, 14, 12),
        ),
      ),
    );
  }

  // ─────────────────────────────────────────── search ────

  Widget _buildSearchBar() {
    final c = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: c.surfaceInput,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: TextField(
        onChanged: (v) => setState(() => _search = v),
        style: TextStyle(color: c.textPrimary, fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search announcements…',
          hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
          prefixIcon:
              Icon(Icons.search_rounded, color: c.textMuted, size: 20),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        ),
      ),
    );
  }

  // ─────────────────────────────────── course filter chips ────

  Widget _buildFilterChips(bool isLecturer) {
    final courses = isLecturer ? _teachingCourses : _enrolledCourses;
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          _courseChip('All', null, isActive: _courseFilter == null),
          const SizedBox(width: 8),
          ...courses.map((cr) {
            final active = _courseFilter == cr.id;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _courseChip(cr.name, cr.id,
                  isActive: active, accent: courseAccent(cr.id)),
            );
          }),
        ],
      ),
    );
  }

  Widget _courseChip(String label, String? id,
      {required bool isActive, Color? accent}) {
    final c = context.colors;
    final tint = accent ?? _pSlate;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _courseFilter = id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? tint.withValues(alpha: 0.15)
              : c.surfaceCard.withValues(alpha: context.isDark ? 0.4 : 0.7),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: isActive
                  ? tint.withValues(alpha: 0.6)
                  : c.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isActive) ...[
              Icon(Icons.check_rounded, size: 14, color: tint),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                color: isActive ? tint : c.textSecondary,
                fontSize: 13,
                fontWeight:
                    isActive ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────── group label ────

  Widget _buildGroupLabel(String label, int count) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 10, 2, 10),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_pSlate, _pLavender],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: c.surfaceCard.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: c.border),
            ),
            child: Text(
              '$count',
              style: TextStyle(
                color: c.textSecondary,
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────── announcement card ────

  Widget _buildAnnouncementCard(AnnouncementModel ann) {
    final c = context.colors;
    final uid = FirebaseAuth.instance.currentUser?.uid ?? '';
    final canDelete = ann.senderId == uid || _userRole == 'lecturer';
    final accent = courseAccent(ann.subjectId);
    final gradient = courseGradient(ann.subjectId);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        borderColor: accent.withValues(alpha: 0.22),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left accent stripe with per-course gradient
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: gradient,
                  borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(16)),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 13, 12, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header row: course chip + time + delete
                      Row(
                        children: [
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: accent.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color:
                                        accent.withValues(alpha: 0.28)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 14,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      gradient: gradient,
                                      borderRadius:
                                          BorderRadius.circular(4),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Text(
                                      ann.subjectName.isEmpty
                                          ? 'Course'
                                          : ann.subjectName,
                                      style: TextStyle(
                                        color: accent,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: -0.1,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(Icons.access_time_rounded,
                              size: 11, color: c.textMuted),
                          const SizedBox(width: 3),
                          Text(
                            _formatRelative(ann.createdAt),
                            style: TextStyle(
                              color: c.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          if (canDelete)
                            Padding(
                              padding: const EdgeInsets.only(left: 4),
                              child: IconButton(
                                padding: EdgeInsets.zero,
                                visualDensity: VisualDensity.compact,
                                constraints: const BoxConstraints(
                                    minWidth: 32, minHeight: 32),
                                onPressed: () {
                                  HapticFeedback.lightImpact();
                                  _deleteAnnouncement(ann);
                                },
                                icon: const Icon(
                                  Icons.delete_outline_rounded,
                                  color: _pRose,
                                  size: 18,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      // Title
                      Text(
                        ann.title,
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 6),
                      // Body
                      Text(
                        ann.message,
                        style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 13,
                          height: 1.5,
                        ),
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (ann.senderName.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            AvatarWidget(
                                name: ann.senderName,
                                imageUrl: ann.senderPhotoUrl,
                                size: 22,
                                role: 'lecturer'),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                ann.senderName,
                                style: TextStyle(
                                  color: c.textMuted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─────────────────────────────────────────── empty ────

  Widget _buildEmpty(bool isLecturer) {
    final hasFilters = _search.isNotEmpty || _courseFilter != null;
    if (hasFilters) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 40, 20, 40),
        child: EmptyState(
          icon: Icons.filter_alt_off_rounded,
          title: 'No matches',
          subtitle: 'Try clearing the search or course filter',
          action: ElevatedButton.icon(
            onPressed: () => setState(() {
              _search = '';
              _courseFilter = null;
            }),
            icon: const Icon(Icons.clear_all_rounded, size: 16),
            label: const Text('Clear filters'),
            style: ElevatedButton.styleFrom(
              backgroundColor: _pLavender,
              foregroundColor: Colors.white,
              elevation: 0,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      );
    }
    if (isLecturer && _teachingCourses.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(20, 40, 20, 40),
        child: EmptyState(
          icon: Icons.school_outlined,
          title: 'No courses yet',
          subtitle: 'Create a course before posting announcements',
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 40, 20, 40),
      child: EmptyState(
        icon: Icons.campaign_rounded,
        title: 'No announcements yet',
        subtitle: isLecturer
            ? 'Tap "Post an announcement" above to broadcast your first message'
            : 'Announcements from your courses will appear here',
      ),
    );
  }
}

