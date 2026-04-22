import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/avatar_widget.dart';

// ── Pastel palette (matches Courses / Announcements / Chat overhaul) ──────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam = Color(0xFF7BB5B0);
const _pRose = Color(0xFFC99999);

class AnnouncementFormScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  const AnnouncementFormScreen({super.key, required this.courseId, required this.courseName});
  @override
  State<AnnouncementFormScreen> createState() => _AnnouncementFormScreenState();
}

class _AnnouncementFormScreenState extends State<AnnouncementFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  bool _saving = false;
  bool _isLecturer = false;
  List<Map<String, dynamic>> _announcements = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final me = await ApiService.getMe();
      final raw = await ApiService.getAnnouncements(widget.courseId);
      if (!mounted) return;
      setState(() {
        _isLecturer = (me['role'] ?? 'student') == 'lecturer';
        _announcements = raw.map((a) => Map<String, dynamic>.from(a)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _post() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiService.createAnnouncement(
        widget.courseId,
        _titleCtrl.text.trim(),
        _contentCtrl.text.trim(),
      );
      if (mounted) {
        _titleCtrl.clear();
        _contentCtrl.clear();
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Announcement posted!'), backgroundColor: _pSeafoam),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: _pRose),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(String id) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Announcement',
      message: 'This announcement will be permanently deleted.',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok == true) {
      await ApiService.deleteAnnouncement(widget.courseId, id);
      _load();
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight),
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: AppBar(
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Announcements',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(widget.courseName,
                      style: TextStyle(fontSize: 12, color: c.textSecondary),
                      overflow: TextOverflow.ellipsis),
                ],
              ),
              backgroundColor: (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
              foregroundColor: c.textPrimary,
              elevation: 0,
              scrolledUnderElevation: 0,
              shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
            ),
          ),
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? Center(child: CircularProgressIndicator(color: _pSlate))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pSlate,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
                    children: [
                      if (_isLecturer) ...[
                        _composerCard(c),
                        const SizedBox(height: 20),
                      ],
                      if (_announcements.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 40),
                          child: EmptyState(
                            icon: Icons.campaign_rounded,
                            title: 'No announcements yet',
                            subtitle: 'Post one to get started',
                          ),
                        )
                      else
                        AnimationLimiter(
                          child: Column(
                            children: List.generate(
                              _announcements.length,
                              (i) => AnimatedListItem(
                                index: i,
                                child: _announcementCard(_announcements[i]),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _composerCard(dynamic c) {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_pSlate.withOpacity(0.22), _pLavender.withOpacity(0.18)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _pSlate.withOpacity(0.3)),
                  ),
                  child: const Icon(Icons.campaign_rounded, color: _pSlate, size: 18),
                ),
                const SizedBox(width: 10),
                const Text(
                  'NEW ANNOUNCEMENT',
                  style: TextStyle(
                    color: _pSlate,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _glassField(
              controller: _titleCtrl,
              hint: 'Title',
              icon: Icons.title_rounded,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 10),
            _glassField(
              controller: _contentCtrl,
              hint: 'Content',
              icon: Icons.notes_rounded,
              maxLines: 4,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_pSlate, _pLavender],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: _pSlate.withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                  label: Text(
                    _saving ? 'Posting…' : 'Post Announcement',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                  ),
                  onPressed: _saving ? null : _post,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _glassField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    final c = context.colors;
    final isDark = context.isDark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.06) : Colors.white.withOpacity(0.85),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06),
        ),
      ),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        style: TextStyle(color: c.textPrimary, fontSize: 14),
        validator: validator,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
          prefixIcon: Icon(icon, color: _pSlate, size: 18),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
    );
  }

  Widget _announcementCard(Map<String, dynamic> a) {
    final c = context.colors;
    final title = a['title']?.toString() ?? '';
    final content = a['content']?.toString() ?? '';
    final sender = a['sender_name']?.toString() ?? 'Unknown';
    final senderPhoto = a['sender_photo_url']?.toString() ?? '';
    final id = a['id']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_pSlate.withOpacity(0.2), _pLavender.withOpacity(0.16)],
                    ),
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: _pSlate.withOpacity(0.28)),
                  ),
                  child: const Icon(Icons.campaign_rounded, color: _pSlate, size: 16),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
                if (_isLecturer)
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _delete(id);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: _pRose.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: _pRose.withOpacity(0.28)),
                      ),
                      child: Icon(Icons.delete_outline_rounded, color: _pRose, size: 16),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              content,
              style: TextStyle(color: c.textSecondary, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                AvatarWidget(name: sender, imageUrl: senderPhoto, size: 18, role: 'lecturer'),
                const SizedBox(width: 6),
                Text(sender,
                    style: TextStyle(color: c.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
