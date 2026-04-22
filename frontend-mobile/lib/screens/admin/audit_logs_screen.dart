import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme_ext.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/skeletons.dart';

class AuditLogsScreen extends StatefulWidget {
  const AuditLogsScreen({super.key});
  @override
  State<AuditLogsScreen> createState() => _AuditLogsScreenState();
}

class _AuditLogsScreenState extends State<AuditLogsScreen> {
  List<Map<String, dynamic>> _logs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.adminGetAuditLogs();
      if (mounted) setState(() { _logs = raw.map((l) => Map<String, dynamic>.from(l)).toList(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _actionColor(String action) {
    if (action.contains('delete') || action.contains('remove')) return AppColors.red;
    if (action.contains('create') || action.contains('add')) return AppColors.emerald;
    if (action.contains('update') || action.contains('edit')) return AppColors.amber;
    return AppColors.blue;
  }

  IconData _actionIcon(String action) {
    if (action.contains('delete') || action.contains('remove')) return Icons.delete_rounded;
    if (action.contains('create') || action.contains('add')) return Icons.add_circle_rounded;
    if (action.contains('update') || action.contains('edit')) return Icons.edit_rounded;
    if (action.contains('login') || action.contains('auth')) return Icons.login_rounded;
    return Icons.info_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Audit Logs', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(icon: Icon(Icons.refresh_rounded, color: c.textSecondary), onPressed: _load),
        ],
      ),
      body: _loading
          ? const SkeletonList(itemCount: 6)
          : _logs.isEmpty
              ? const Center(child: EmptyState(icon: Icons.history_rounded, title: 'No audit logs'))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.amber,
                  child: AnimationLimiter(
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                      itemCount: _logs.length,
                      itemBuilder: (_, i) {
                        final log = _logs[i];
                        final action = log['action']?.toString() ?? '';
                        final user = log['user_name']?.toString() ?? log['user_email']?.toString() ?? 'System';
                        final timestamp = log['created_at']?.toString() ?? '';
                        final details = log['details']?.toString() ?? '';
                        final color = _actionColor(action);

                        return AnimatedListItem(
                          index: i,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: GlassCard(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: color.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Icon(_actionIcon(action), color: color, size: 18),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(action, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                                        const SizedBox(height: 2),
                                        Text(user, style: TextStyle(color: c.textSecondary, fontSize: 12)),
                                        if (details.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(details, style: TextStyle(color: c.textMuted, fontSize: 11), maxLines: 2, overflow: TextOverflow.ellipsis),
                                        ],
                                        if (timestamp.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          BadgeChip(label: timestamp.length >= 16 ? timestamp.substring(0, 16) : timestamp, color: c.textMuted),
                                        ],
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
                ),
    );
  }
}
