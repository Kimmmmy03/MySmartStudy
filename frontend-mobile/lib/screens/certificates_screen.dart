import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/section_header.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

class CertificatesScreen extends StatefulWidget {
  const CertificatesScreen({super.key});
  @override
  State<CertificatesScreen> createState() => _CertificatesScreenState();
}

class _CertificatesScreenState extends State<CertificatesScreen> {
  List<Map<String, dynamic>> _certificates = [];
  List<Map<String, dynamic>> _progress = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService.getMyCertificates(),
        ApiService.getCourseProgress(),
      ]);
      if (!mounted) return;
      setState(() {
        _certificates = results[0].map((c) => Map<String, dynamic>.from(c)).toList();
        _progress = results[1].map((p) => Map<String, dynamic>.from(p)).toList();
        _loading = false;
      });
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
        title: const Text('Certificates', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const SkeletonList(itemCount: 5)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.amber,
              child: AnimationLimiter(
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                  children: [
                    if (_certificates.isNotEmpty) ...[
                      AnimatedListItem(
                        index: 0,
                        child: SectionHeader(
                          title: 'My Certificates',
                        ),
                      ),
                      const SizedBox(height: 12),
                      ..._certificates.asMap().entries.map((e) => AnimatedListItem(
                        index: 1 + e.key,
                        child: _certCard(e.value),
                      )),
                      const SizedBox(height: 24),
                    ],
                    AnimatedListItem(
                      index: _certificates.length + 1,
                      child: const SectionHeader(title: 'Available Courses'),
                    ),
                    const SizedBox(height: 12),
                    if (_progress.isEmpty)
                      AnimatedListItem(
                        index: _certificates.length + 2,
                        child: const EmptyState(
                          icon: Icons.school_rounded,
                          title: 'No courses enrolled',
                          subtitle: 'Join a course to track your progress',
                        ),
                      )
                    else
                      ..._progress.asMap().entries.map((e) => AnimatedListItem(
                        index: _certificates.length + 2 + e.key,
                        child: _progressCard(e.value),
                      )),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _certCard(Map<String, dynamic> cert) {
    final c = context.colors;
    final courseName = cert['course_name']?.toString() ?? 'Course';
    final certNumber = cert['certificate_number']?.toString() ?? '';
    final issuedAt = cert['issued_at']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        gradient: LinearGradient(
          colors: [
            AppColors.amber.withOpacity(context.isDark ? 0.15 : 0.08),
            AppColors.purple.withOpacity(context.isDark ? 0.1 : 0.04),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderColor: AppColors.amber.withOpacity(0.3),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.amber.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.workspace_premium_rounded, color: AppColors.amber, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(courseName, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 4),
                  if (certNumber.isNotEmpty)
                    Text('Cert: $certNumber', style: TextStyle(color: c.textMuted, fontSize: 11)),
                  if (issuedAt.isNotEmpty)
                    Text(
                      'Issued: ${issuedAt.length >= 10 ? issuedAt.substring(0, 10) : issuedAt}',
                      style: TextStyle(color: c.textMuted, fontSize: 11),
                    ),
                ],
              ),
            ),
            BadgeChip(label: 'Earned', color: AppColors.emerald, icon: Icons.verified_rounded),
          ],
        ),
      ),
    );
  }

  Widget _progressCard(Map<String, dynamic> prog) {
    final c = context.colors;
    final courseName = prog['course_name']?.toString() ?? 'Course';
    final pct = prog['completion_percentage'] ?? 0;
    final eligible = pct >= 100;
    final courseId = prog['course_id']?.toString() ?? '';
    final alreadyClaimed = _certificates.any((cert) => cert['course_id'] == courseId);
    final progressColor = pct >= 80 ? AppColors.emerald : pct >= 50 ? AppColors.amber : AppColors.red;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: progressColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(Icons.menu_book_rounded, color: progressColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(courseName, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: (pct as num) / 100,
                      minHeight: 8,
                      backgroundColor: c.surfaceElevated,
                      valueColor: AlwaysStoppedAnimation(progressColor),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('$pct% complete', style: TextStyle(color: c.textMuted, fontSize: 11)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            if (alreadyClaimed)
              const Icon(Icons.check_circle_rounded, color: AppColors.emerald, size: 28)
            else if (eligible)
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.amber,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () async {
                  HapticFeedback.mediumImpact();
                  try {
                    await ApiService.claimCertificate(courseId);
                    _load();
                    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Certificate claimed!')));
                  } catch (e) {
                    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.red));
                  }
                },
                child: const Text('Claim', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              )
            else
              Icon(Icons.lock_outline_rounded, color: c.textMuted, size: 24),
          ],
        ),
      ),
    );
  }
}
