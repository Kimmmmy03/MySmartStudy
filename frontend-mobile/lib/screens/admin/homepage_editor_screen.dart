import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme.dart';
import '../../utils/app_theme_ext.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/section_header.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/skeletons.dart';

class HomepageEditorScreen extends StatefulWidget {
  const HomepageEditorScreen({super.key});
  @override
  State<HomepageEditorScreen> createState() => _HomepageEditorScreenState();
}

class _HomepageEditorScreenState extends State<HomepageEditorScreen> {
  List<Map<String, dynamic>> _content = [];
  bool _loading = true;
  bool _saving = false;

  final _titleCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  String _type = 'announcement';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.adminGetHomepageContent();
      if (mounted) setState(() { _content = raw.map((c) => Map<String, dynamic>.from(c)).toList(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty) return;
    HapticFeedback.mediumImpact();
    setState(() => _saving = true);
    try {
      await ApiService.adminUpdateHomepageContent({
        'title': _titleCtrl.text.trim(),
        'body': _bodyCtrl.text.trim(),
        'type': _type,
      });
      _titleCtrl.clear();
      _bodyCtrl.clear();
      _load();
    } catch (_) {}
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Homepage Editor', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          // Add content form
          const SectionHeader(title: 'Add Content'),
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Type selector
                Row(
                  children: ['announcement', 'feature', 'news'].map((t) {
                    final isActive = _type == t;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setState(() => _type = t),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: isActive ? AppColors.amber.withOpacity(0.15) : c.surfaceInput,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: isActive ? AppColors.amber : c.border),
                          ),
                          child: Text(t, style: TextStyle(color: isActive ? AppColors.amber : c.textSecondary, fontSize: 12, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal)),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _titleCtrl,
                  style: TextStyle(color: c.textPrimary, fontSize: 13),
                  decoration: AppTheme.inputDecoration(context, label: 'Title', prefixIcon: Icons.title_rounded),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _bodyCtrl,
                  style: TextStyle(color: c.textPrimary, fontSize: 13),
                  maxLines: 4,
                  decoration: AppTheme.inputDecoration(context, label: 'Content', prefixIcon: Icons.article_rounded),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.publish_rounded, size: 18),
                    label: Text(_saving ? 'Publishing...' : 'Publish'),
                    style: AppTheme.gradientButtonStyle(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Existing content
          const SectionHeader(title: 'Current Content'),
          const SizedBox(height: 12),
          if (_loading)
            const SkeletonList(itemCount: 4)
          else if (_content.isEmpty)
            const EmptyState(icon: Icons.web_rounded, title: 'No content yet')
          else
            ..._content.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GlassCard(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.amber.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            (item['type']?.toString() ?? 'content').toUpperCase(),
                            style: const TextStyle(color: AppColors.amber, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          (item['created_at']?.toString() ?? '').length >= 10 ? item['created_at'].toString().substring(0, 10) : '',
                          style: TextStyle(color: c.textMuted, fontSize: 11),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(item['title']?.toString() ?? '', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    if (item['body'] != null && item['body'].toString().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(item['body'].toString(), style: TextStyle(color: c.textSecondary, fontSize: 13), maxLines: 3, overflow: TextOverflow.ellipsis),
                    ],
                  ],
                ),
              ),
            )),
        ],
      ),
    );
  }
}
