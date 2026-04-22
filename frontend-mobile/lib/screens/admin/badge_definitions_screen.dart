import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme.dart';
import '../../utils/app_theme_ext.dart';
import '../../widgets/glass_card.dart';

import '../../widgets/empty_state.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/confirmation_dialog.dart';
import '../../widgets/skeletons.dart';

class BadgeDefinitionsScreen extends StatefulWidget {
  const BadgeDefinitionsScreen({super.key});
  @override
  State<BadgeDefinitionsScreen> createState() => _BadgeDefinitionsScreenState();
}

class _BadgeDefinitionsScreenState extends State<BadgeDefinitionsScreen> {
  List<Map<String, dynamic>> _badges = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.adminGetBadgeDefinitions();
      if (mounted) setState(() { _badges = raw.map((b) => Map<String, dynamic>.from(b)).toList(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final c = context.colors;
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final iconCtrl = TextEditingController(text: 'star');

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: c.surfaceCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Create Badge', style: TextStyle(color: c.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                style: TextStyle(color: c.textPrimary, fontSize: 13),
                decoration: AppTheme.inputDecoration(context, label: 'Badge Name', prefixIcon: Icons.military_tech_rounded),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: descCtrl,
                style: TextStyle(color: c.textPrimary, fontSize: 13),
                maxLines: 2,
                decoration: AppTheme.inputDecoration(context, label: 'Description', prefixIcon: Icons.description_rounded),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: iconCtrl,
                style: TextStyle(color: c.textPrimary, fontSize: 13),
                decoration: AppTheme.inputDecoration(context, label: 'Icon name', prefixIcon: Icons.emoji_emotions_rounded),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: TextStyle(color: c.textSecondary))),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: AppTheme.gradientButtonStyle(),
                    child: const Text('Create'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (result == true && nameCtrl.text.trim().isNotEmpty) {
      HapticFeedback.mediumImpact();
      try {
        await ApiService.adminCreateBadge({
          'name': nameCtrl.text.trim(),
          'description': descCtrl.text.trim(),
          'icon': iconCtrl.text.trim(),
        });
        _load();
      } catch (_) {}
    }
    nameCtrl.dispose();
    descCtrl.dispose();
    iconCtrl.dispose();
  }

  Future<void> _delete(String id) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Badge',
      message: 'Delete this badge definition?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok != true) return;
    try {
      await ApiService.adminDeleteBadge(id);
      _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Badge Definitions', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        backgroundColor: AppColors.amber,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('New Badge', style: TextStyle(color: Colors.white)),
      ),
      body: _loading
          ? const SkeletonList(itemCount: 5)
          : _badges.isEmpty
              ? const Center(child: EmptyState(icon: Icons.military_tech_outlined, title: 'No badges defined', subtitle: 'Create your first badge'))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.amber,
                  child: AnimationLimiter(
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                      itemCount: _badges.length,
                      itemBuilder: (_, i) {
                        final badge = _badges[i];
                        return AnimatedListItem(
                          index: i,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: GlassCard(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: AppColors.amber.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(Icons.military_tech_rounded, color: AppColors.amber, size: 22),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(badge['name']?.toString() ?? 'Badge', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                                        if (badge['description'] != null)
                                          Text(badge['description'].toString(), style: TextStyle(color: c.textSecondary, fontSize: 12), maxLines: 2),
                                      ],
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () => _delete(badge['id']?.toString() ?? ''),
                                    child: Icon(Icons.delete_outline_rounded, size: 20, color: c.textMuted),
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
