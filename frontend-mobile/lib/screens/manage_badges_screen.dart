import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../utils/badge_utils.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

/// Lecturer-facing read-only catalog of all badges (built-in defaults +
/// custom ones defined on the web). Creation/editing happens on the web;
/// this screen just lets lecturers browse what exists.
class ManageBadgesScreen extends StatefulWidget {
  const ManageBadgesScreen({super.key});
  @override
  State<ManageBadgesScreen> createState() => _ManageBadgesScreenState();
}

class _ManageBadgesScreenState extends State<ManageBadgesScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _badgeDefs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await ApiService.getBadgeDefinitions();
      setState(() {
        _badgeDefs = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final defaults = _badgeDefs.where((b) => b['is_default'] == true).toList();
    final custom = _badgeDefs.where((b) => b['is_default'] != true).toList();

    return AppBackground(
      applySafeArea: false,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Badges', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.transparent,
          foregroundColor: c.textPrimary,
          scrolledUnderElevation: 0,
          actions: [
            IconButton(icon: Icon(Icons.refresh_rounded, color: c.textSecondary), onPressed: _load),
          ],
        ),
        body: _loading
            ? const SkeletonList(itemCount: 6)
            : _error != null
                ? _buildError(c)
                : RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.purple,
                    child: _badgeDefs.isEmpty
                        ? ListView(children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                            const EmptyState(
                              icon: Icons.emoji_events_outlined,
                              title: 'No badges yet',
                              subtitle: 'Create custom badges on the web — they\'ll appear here automatically.',
                            ),
                          ])
                        : AnimationLimiter(
                            child: ListView(
                              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                              padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                              children: [
                                _buildInfoBanner(c),
                                const SizedBox(height: 16),
                                if (custom.isNotEmpty) ...[
                                  _sectionHeader(c, 'Custom Badges', custom.length, AppColors.purple),
                                  const SizedBox(height: 8),
                                  for (int i = 0; i < custom.length; i++)
                                    AnimatedListItem(index: i, child: _buildBadgeCard(custom[i])),
                                  const SizedBox(height: 20),
                                ],
                                if (defaults.isNotEmpty) ...[
                                  _sectionHeader(c, 'Default Badges', defaults.length, AppColors.amber),
                                  const SizedBox(height: 8),
                                  for (int i = 0; i < defaults.length; i++)
                                    AnimatedListItem(index: custom.length + i, child: _buildBadgeCard(defaults[i])),
                                ],
                              ],
                            ),
                          ),
                  ),
      ),
    );
  }

  Widget _buildInfoBanner(AppColorScheme c) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.purple.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.info_outline_rounded, color: AppColors.purple, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Badges are created on the web. View the full catalog below.',
              style: TextStyle(color: c.textSecondary, fontSize: 12.5, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(AppColorScheme c, String title, int count, Color accent) {
    return Row(
      children: [
        Container(
          width: 4, height: 16,
          decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2)),
        ),
        const SizedBox(width: 8),
        Text(title, style: TextStyle(color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: accent.withOpacity(0.15),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text('$count', style: TextStyle(color: accent, fontSize: 11, fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  Widget _buildError(AppColorScheme c) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 48),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: c.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _load,
              style: AppTheme.gradientButtonStyle(isLecturer: true),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBadgeCard(Map<String, dynamic> def) {
    final c = context.colors;
    final name = (def['name'] ?? def['id'] ?? '').toString();
    final desc = (def['description'] ?? '').toString();
    final icon = (def['icon'] ?? 'award').toString();
    final isDefault = def['is_default'] == true;
    final condType = (def['condition_type'] ?? '').toString();
    final condVal = def['condition_value'];
    final points = def['points_reward'];
    final createdBy = (def['created_by_name'] ?? '').toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 52, height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: (isDefault ? AppColors.amber : AppColors.purple).withOpacity(0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(BadgeUtils.emojiForIcon(icon), style: const TextStyle(fontSize: 28)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          name,
                          style: TextStyle(color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w700),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (!isDefault) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.purple.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('Custom',
                              style: TextStyle(color: AppColors.purple, fontSize: 9, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ],
                  ),
                  if (desc.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(desc, style: TextStyle(color: c.textSecondary, fontSize: 12.5, height: 1.3)),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6, runSpacing: 6,
                    children: [
                      if (condType.isNotEmpty)
                        _metaChip(c, Icons.flag_rounded,
                            '${_humanCondition(condType)}${condVal != null ? ': $condVal' : ''}'),
                      if (points != null)
                        _metaChip(c, Icons.star_rounded, '+$points pts'),
                      if (!isDefault && createdBy.isNotEmpty)
                        _metaChip(c, Icons.person_rounded, 'by $createdBy'),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _metaChip(AppColorScheme c, IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: c.surfaceElevated,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: c.textMuted),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(color: c.textSecondary, fontSize: 10.5, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  String _humanCondition(String raw) {
    switch (raw) {
      case 'maps_created': return 'Maps created';
      case 'streak_days': return 'Streak days';
      case 'quiz_score': return 'Quiz score';
      case 'early_submissions': return 'Early submissions';
      case 'quizzes_completed': return 'Quizzes done';
      case 'peer_reviews': return 'Peer reviews';
      case 'course_completion': return 'Course complete';
      case 'courses_joined': return 'Courses joined';
      case 'collaborations': return 'Collaborations';
      default: return raw.replaceAll('_', ' ');
    }
  }
}
