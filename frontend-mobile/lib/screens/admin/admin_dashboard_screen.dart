import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme_ext.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/section_header.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/skeletons.dart';
import 'audit_logs_screen.dart';
import 'user_management_screen.dart';
import 'badge_definitions_screen.dart';
import 'homepage_editor_screen.dart';
import 'ai_usage_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});
  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  bool _loading = true;
  Map<String, dynamic> _data = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.adminGetDashboard();
      if (mounted) setState(() { _data = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Admin Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(icon: Icon(Icons.refresh_rounded, color: c.textSecondary), onPressed: _load),
        ],
      ),
      body: _loading
          ? const SkeletonDetail()
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.amber,
              child: AnimationLimiter(
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                  children: [
                    // Stats overview
                    AnimatedListItem(
                      index: 0,
                      child: const SectionHeader(title: 'Platform Overview'),
                    ),
                    const SizedBox(height: 12),
                    AnimatedListItem(
                      index: 1,
                      child: Row(
                        children: [
                          Expanded(child: StatCard(label: 'Users', value: '${_data['total_users'] ?? 0}', icon: Icons.people_rounded, accentColor: AppColors.blue)),
                          const SizedBox(width: 10),
                          Expanded(child: StatCard(label: 'Courses', value: '${_data['total_courses'] ?? 0}', icon: Icons.menu_book_rounded, accentColor: AppColors.purple)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    AnimatedListItem(
                      index: 2,
                      child: Row(
                        children: [
                          Expanded(child: StatCard(label: 'Maps', value: '${_data['total_maps'] ?? 0}', icon: Icons.account_tree_rounded, accentColor: AppColors.emerald)),
                          const SizedBox(width: 10),
                          Expanded(child: StatCard(label: 'Active Today', value: '${_data['active_today'] ?? 0}', icon: Icons.flash_on_rounded, accentColor: AppColors.amber)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Quick actions
                    AnimatedListItem(
                      index: 3,
                      child: const SectionHeader(title: 'Management'),
                    ),
                    const SizedBox(height: 12),
                    ..._buildActionCards(c),
                  ],
                ),
              ),
            ),
    );
  }

  List<Widget> _buildActionCards(AppColorScheme c) {
    final actions = [
      {'title': 'User Management', 'subtitle': 'Manage roles & accounts', 'icon': Icons.manage_accounts_rounded, 'color': AppColors.blue, 'screen': const UserManagementScreen()},
      {'title': 'Audit Logs', 'subtitle': 'View system activity', 'icon': Icons.history_rounded, 'color': AppColors.purple, 'screen': const AuditLogsScreen()},
      {'title': 'AI Token Usage', 'subtitle': 'Monitor Gemini usage per user', 'icon': Icons.bar_chart_rounded, 'color': AppColors.cyan, 'screen': const AiUsageScreen()},
      {'title': 'Badge Definitions', 'subtitle': 'Create & manage badges', 'icon': Icons.military_tech_rounded, 'color': AppColors.amber, 'screen': const BadgeDefinitionsScreen()},
      {'title': 'Homepage Editor', 'subtitle': 'Edit landing page content', 'icon': Icons.web_rounded, 'color': AppColors.emerald, 'screen': const HomepageEditorScreen()},
    ];

    return List.generate(actions.length, (i) {
      final a = actions[i];
      return AnimatedListItem(
        index: 4 + i,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: GlassCard(
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => a['screen'] as Widget)),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: (a['color'] as Color).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(a['icon'] as IconData, color: a['color'] as Color, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(a['title'] as String, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 2),
                      Text(a['subtitle'] as String, style: TextStyle(color: c.textSecondary, fontSize: 12)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: c.textMuted),
              ],
            ),
          ),
        ),
      );
    });
  }
}
