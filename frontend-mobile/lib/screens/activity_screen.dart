import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});
  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  List<Map<String, dynamic>> _activities = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getActivity();
      if (!mounted) return;
      setState(() {
        _activities = raw.map((a) => Map<String, dynamic>.from(a)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  IconData _iconFor(String resourceType) {
    switch (resourceType) {
      case 'map':
        return Icons.account_tree_rounded;
      case 'course':
        return Icons.school_rounded;
      case 'assignment':
        return Icons.assignment_rounded;
      case 'submission':
        return Icons.upload_file_rounded;
      case 'badge':
        return Icons.military_tech_rounded;
      case 'quiz':
        return Icons.quiz_rounded;
      default:
        return Icons.history_rounded;
    }
  }

  Color _colorFor(String resourceType) {
    switch (resourceType) {
      case 'map':
        return AppColors.blue;
      case 'course':
        return AppColors.purple;
      case 'assignment':
        return AppColors.amber;
      case 'submission':
        return AppColors.emerald;
      case 'badge':
        return AppColors.amber;
      case 'quiz':
        return AppColors.pink;
      default:
        return AppColors.blue;
    }
  }

  String _labelFor(Map<String, dynamic> item) {
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

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Activity Log', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const SkeletonList(itemCount: 6)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.purple,
              child: _activities.isEmpty
                  ? ListView(children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                      const EmptyState(
                        icon: Icons.history_rounded,
                        title: 'No activity yet',
                        subtitle: 'Your activity timeline will appear here',
                      ),
                    ])
                  : AnimationLimiter(
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                        itemCount: _activities.length,
                        itemBuilder: (_, i) => AnimatedListItem(
                          index: i,
                          child: _activityTile(_activities[i], i),
                        ),
                      ),
                    ),
            ),
    );
  }

  Widget _activityTile(Map<String, dynamic> activity, int index) {
    final c = context.colors;
    final rt = activity['resourceType']?.toString() ?? '';
    final desc = _labelFor(activity);
    final createdAt = (activity['createdAt'] ?? activity['created_at'] ?? '').toString();
    final color = _colorFor(rt);
    final isLast = index == _activities.length - 1;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_iconFor(rt), color: color, size: 18),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      decoration: BoxDecoration(
                        color: c.border,
                        borderRadius: BorderRadius.circular(1),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              margin: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(desc, style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 4),
                  Text(
                    createdAt.length >= 16 ? createdAt.substring(0, 16) : createdAt,
                    style: TextStyle(color: c.textMuted, fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
