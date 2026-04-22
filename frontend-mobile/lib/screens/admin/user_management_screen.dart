import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme_ext.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/avatar_widget.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/search_bar_widget.dart' as w;
import '../../widgets/empty_state.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/skeletons.dart';
import '../../widgets/confirmation_dialog.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});
  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  List<Map<String, dynamic>> _users = [];
  bool _loading = true;
  String? _roleFilter;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.adminGetUsers(role: _roleFilter, search: _search.isNotEmpty ? _search : null);
      if (mounted) setState(() { _users = raw.map((u) => Map<String, dynamic>.from(u)).toList(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changeRole(Map<String, dynamic> user) async {
    final current = user['role']?.toString() ?? 'student';
    final roles = ['student', 'lecturer', 'admin'];
    final selected = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final c = context.colors;
        return Dialog(
          backgroundColor: c.surfaceCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Change Role', style: TextStyle(color: c.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(user['display_name']?.toString() ?? user['email']?.toString() ?? '', style: TextStyle(color: c.textSecondary, fontSize: 13)),
                const SizedBox(height: 16),
                ...roles.map((r) => ListTile(
                  leading: Icon(
                    r == current ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: r == current ? _roleColor(r) : c.textMuted,
                  ),
                  title: Text(r.toUpperCase(), style: TextStyle(color: c.textPrimary, fontSize: 14)),
                  onTap: () => Navigator.pop(ctx, r),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                )),
              ],
            ),
          ),
        );
      },
    );
    if (selected != null && selected != current) {
      if (!mounted) return;
      final name = user['display_name']?.toString() ?? user['email']?.toString() ?? 'this user';
      final ok = await showConfirmationDialog(
        context: context,
        title: 'Change Role',
        message: "Change $name's role from ${current.toUpperCase()} to ${selected.toUpperCase()}?",
        confirmLabel: 'Confirm',
      );
      if (ok != true) return;
      try {
        await ApiService.adminUpdateUserRole(user['id']?.toString() ?? '', selected);
        _load();
      } catch (_) {}
    }
  }

  Future<void> _deleteUser(Map<String, dynamic> user) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete User',
      message: 'Permanently delete ${user['display_name'] ?? user['email']}? This cannot be undone.',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok != true) return;
    try {
      await ApiService.adminDeleteUser(user['id']?.toString() ?? '');
      _load();
    } catch (_) {}
  }

  Color _roleColor(String role) {
    switch (role) {
      case 'lecturer': return AppColors.purple;
      case 'admin': return AppColors.amber;
      default: return AppColors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('User Management', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: Column(
        children: [
          // Search & filter
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Column(
              children: [
                w.SearchBarWidget(
                  hintText: 'Search users...',
                  padding: EdgeInsets.zero,
                  onChanged: (v) { _search = v; _load(); },
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _filterChip('All', null, c),
                      const SizedBox(width: 8),
                      _filterChip('Students', 'student', c),
                      const SizedBox(width: 8),
                      _filterChip('Lecturers', 'lecturer', c),
                      const SizedBox(width: 8),
                      _filterChip('Admins', 'admin', c),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // User list
          Expanded(
            child: _loading
                ? const SkeletonList(itemCount: 6)
                : _users.isEmpty
                    ? const Center(child: EmptyState(icon: Icons.people_outline, title: 'No users found'))
                    : RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.amber,
                        child: AnimationLimiter(
                          child: ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                            itemCount: _users.length,
                            itemBuilder: (_, i) => AnimatedListItem(
                              index: i,
                              child: _buildUserCard(_users[i], c),
                            ),
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String? role, AppColorScheme c) {
    final isActive = _roleFilter == role;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _roleFilter = role);
        _load();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.amber.withOpacity(0.15) : c.surfaceInput,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isActive ? AppColors.amber : c.border),
        ),
        child: Text(label, style: TextStyle(color: isActive ? AppColors.amber : c.textSecondary, fontSize: 13, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal)),
      ),
    );
  }

  Widget _buildUserCard(Map<String, dynamic> user, AppColorScheme c) {
    final name = user['display_name']?.toString() ?? 'Unknown';
    final email = user['email']?.toString() ?? '';
    final role = user['role']?.toString() ?? 'student';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            AvatarWidget(name: name, imageUrl: user['photo_url']?.toString(), size: 40),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                  Text(email, style: TextStyle(color: c.textMuted, fontSize: 12)),
                  const SizedBox(height: 4),
                  BadgeChip(label: role.toUpperCase(), color: _roleColor(role)),
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert_rounded, color: c.textMuted, size: 20),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              color: c.surfaceCard,
              onSelected: (v) {
                if (v == 'role') _changeRole(user);
                if (v == 'delete') _deleteUser(user);
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'role', child: Row(children: [Icon(Icons.swap_horiz_rounded, color: c.textSecondary, size: 18), const SizedBox(width: 8), Text('Change Role', style: TextStyle(color: c.textPrimary, fontSize: 13))])),
                PopupMenuItem(value: 'delete', child: Row(children: [const Icon(Icons.delete_rounded, color: AppColors.red, size: 18), const SizedBox(width: 8), Text('Delete', style: const TextStyle(color: AppColors.red, fontSize: 13))])),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
