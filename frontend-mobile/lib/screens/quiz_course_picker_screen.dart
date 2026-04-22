import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/empty_state.dart';
import '../widgets/glass_card.dart';
import '../widgets/skeletons.dart';
import 'quizzes_screen.dart';

const _pRose     = Color(0xFFF0B8A8);
const _pLavender = Color(0xFFBFA8D9);

/// Lecturer-facing course picker reached from the Quizzes quick-action on
/// the home screen. Lists the lecturer's teaching courses and pushes
/// [QuizzesScreen] for whichever one they select.
class QuizCoursePickerScreen extends StatefulWidget {
  const QuizCoursePickerScreen({super.key});

  @override
  State<QuizCoursePickerScreen> createState() => _QuizCoursePickerScreenState();
}

class _QuizCoursePickerScreenState extends State<QuizCoursePickerScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _courses = [];
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await ApiService.getTeachingCourses();
      if (!mounted) return;
      setState(() {
        _courses = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_query.trim().isEmpty) return _courses;
    final q = _query.toLowerCase();
    return _courses.where((c) {
      final name = (c['course_name'] ?? '').toString().toLowerCase();
      final code = (c['course_code'] ?? '').toString().toLowerCase();
      return name.contains(q) || code.contains(q);
    }).toList();
  }

  void _openCourse(Map<String, dynamic> course) {
    HapticFeedback.selectionClick();
    final courseId = (course['id'] ?? course['course_id'])?.toString() ?? '';
    final courseName = (course['course_name'] ?? 'Course').toString();
    if (courseId.isEmpty) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => QuizzesScreen(
          courseId: courseId,
          courseName: courseName,
          isLecturer: true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppBackground(
      applySafeArea: false,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Select Course',
              style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.transparent,
          foregroundColor: c.textPrimary,
          scrolledUnderElevation: 0,
          actions: [
            IconButton(
              icon: Icon(Icons.refresh_rounded, color: c.textSecondary),
              onPressed: _load,
            ),
          ],
        ),
        body: _loading
            ? const SkeletonList(itemCount: 6)
            : _error != null
                ? _buildError(c)
                : RefreshIndicator(
                    onRefresh: _load,
                    color: _pRose,
                    child: CustomScrollView(
                      physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics()),
                      slivers: [
                        SliverToBoxAdapter(child: _buildHeader(c)),
                        SliverToBoxAdapter(child: _buildSearch(c)),
                        if (_filtered.isEmpty)
                          SliverFillRemaining(
                            hasScrollBody: false,
                            child: Padding(
                              padding: const EdgeInsets.only(top: 40),
                              child: EmptyState(
                                icon: Icons.menu_book_rounded,
                                title: _courses.isEmpty
                                    ? 'No courses yet'
                                    : 'No matching courses',
                                subtitle: _courses.isEmpty
                                    ? 'Create a course before adding quizzes.'
                                    : 'Try a different search.',
                              ),
                            ),
                          )
                        else
                          SliverPadding(
                            padding:
                                const EdgeInsets.fromLTRB(20, 4, 20, 100),
                            sliver: SliverList(
                              delegate: SliverChildBuilderDelegate(
                                (ctx, i) => AnimationConfiguration.staggeredList(
                                  position: i,
                                  duration: const Duration(milliseconds: 350),
                                  child: SlideAnimation(
                                    verticalOffset: 20,
                                    child: FadeInAnimation(
                                      child: Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 10),
                                        child: _buildCourseCard(
                                            c, _filtered[i]),
                                      ),
                                    ),
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

  Widget _buildHeader(AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [
                  _pRose.withOpacity(0.25),
                  _pLavender.withOpacity(0.18),
                ]),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: _pRose.withOpacity(0.3)),
              ),
              child: const Icon(Icons.quiz_rounded,
                  color: _pRose, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Quizzes',
                      style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text('Pick a course to manage its quizzes.',
                      style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 12,
                          height: 1.3)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearch(AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Container(
        decoration: BoxDecoration(
          color: context.isDark
              ? Colors.white.withOpacity(0.04)
              : Colors.white.withOpacity(0.7),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border.withOpacity(0.5)),
        ),
        child: TextField(
          onChanged: (v) => setState(() => _query = v),
          style: TextStyle(color: c.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Search courses…',
            hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
            prefixIcon: Icon(Icons.search_rounded,
                color: c.textMuted, size: 20),
            border: InputBorder.none,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 4, vertical: 14),
          ),
        ),
      ),
    );
  }

  Widget _buildCourseCard(AppColorScheme c, Map<String, dynamic> course) {
    final name = (course['course_name'] ?? 'Course').toString();
    final code = (course['course_code'] ?? '').toString();
    final enrolled = (course['enrolled_count'] ??
        (course['enrolled_students'] as List?)?.length ??
        0) as int;

    return GlassCard(
      onTap: () => _openCourse(course),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [
                _pRose.withOpacity(0.25),
                _pLavender.withOpacity(0.18),
              ]),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _pRose.withOpacity(0.3)),
            ),
            child: const Icon(Icons.menu_book_rounded,
                color: _pRose, size: 20),
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
                        fontSize: 15,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                Text(
                  code.isNotEmpty
                      ? '$code · $enrolled student${enrolled == 1 ? "" : "s"}'
                      : '$enrolled student${enrolled == 1 ? "" : "s"}',
                  style: TextStyle(
                      color: c.textSecondary, fontSize: 12, height: 1.3),
                ),
              ],
            ),
          ),
          Icon(Icons.arrow_forward_ios_rounded,
              color: c.textMuted, size: 14),
        ],
      ),
    );
  }

  Widget _buildError(AppColorScheme c) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: _pRose, size: 48),
            const SizedBox(height: 12),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textSecondary)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _load,
              style: FilledButton.styleFrom(
                backgroundColor: _pRose,
                foregroundColor: Colors.white,
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
