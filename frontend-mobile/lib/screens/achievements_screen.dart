import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../models/user_profile.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../utils/badge_utils.dart';
import '../widgets/glass_card.dart';
import '../widgets/stat_card.dart';
import '../widgets/section_header.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/badge_icon_widget.dart';
import '../widgets/skeletons.dart';

class AchievementsScreen extends StatefulWidget {
  const AchievementsScreen({super.key});
  @override
  State<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<AchievementsScreen> {
  bool _loading = true;
  String? _error;
  UserProfile? _profile;
  List<BadgeInfo> _badgeDefs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      // Trigger server-side badge auto-award (mirrors web behaviour)
      try { await ApiService.checkMyBadges(); } catch (_) {}

      final results = await Future.wait([
        ApiService.getMe(),
        ApiService.getBadgeDefinitions(),
      ]);

      final profile = UserProfile.fromApi(results[0] as Map<String, dynamic>);
      final rawDefs = results[1] as List<dynamic>;

      // Build BadgeInfo list from API, fall back to local list if empty
      List<BadgeInfo> defs = rawDefs.isEmpty
          ? BadgeUtils.allBadges
          : rawDefs.map((r) => BadgeUtils.fromApi(Map<String, dynamic>.from(r))).toList();

      // Sort: earned first (same as web)
      final earnedSet = Set<String>.from(profile.badges);
      defs.sort((a, b) {
        final aE = earnedSet.contains(a.id) ? 0 : 1;
        final bE = earnedSet.contains(b.id) ? 0 : 1;
        return aE - bE;
      });

      if (mounted) {
        setState(() {
          _profile = profile;
          _badgeDefs = defs;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Achievements', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(icon: Icon(Icons.refresh_rounded, color: c.textSecondary), onPressed: _load),
        ],
      ),
      body: _loading
          ? const SkeletonGrid(itemCount: 6)
          : _error != null
              ? _buildError(c)
              : (_profile?.role == 'lecturer' || _profile?.role == 'admin')
                  ? _buildLecturerBlocked(c)
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.amber,
                      child: _buildContent(c),
                    ),
    );
  }

  Widget _buildLecturerBlocked(AppColorScheme colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline_rounded, color: colors.textMuted, size: 48),
            const SizedBox(height: 12),
            Text(
              'Achievements are available for students only.',
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(AppColorScheme colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 48),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: colors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _load,
              style: AppTheme.gradientButtonStyle(),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(AppColorScheme c) {
    final profile = _profile!;
    final int level = (profile.points ~/ 100) + 1;
    final int xpInLevel = profile.points % 100;
    final earnedSet = Set<String>.from(profile.badges);

    return AnimationLimiter(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          // ── Stats Row (matching web's 3 cards) ──────────────────────
          AnimatedListItem(
            index: 0,
            child: Row(
              children: [
                Expanded(
                  child: _statCard(
                    icon: Icons.monetization_on_rounded,
                    color: AppColors.amber,
                    value: profile.points.toString(),
                    label: 'Total Points',
                    animate: true,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _statCard(
                    icon: Icons.local_fire_department_rounded,
                    color: const Color(0xFFF97316),
                    value: '${profile.streak}',
                    label: 'Day Streak',
                    animate: profile.streak > 0,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _levelCard(level, xpInLevel, c),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Badges header ────────────────────────────────────────────
          AnimatedListItem(
            index: 1,
            child: Row(
              children: [
                const Icon(Icons.workspace_premium_rounded, color: AppColors.amber, size: 20),
                const SizedBox(width: 8),
                Text(
                  'My Badges',
                  style: TextStyle(color: c.textPrimary, fontSize: 17, fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                Text(
                  '${earnedSet.length}/${_badgeDefs.length} earned',
                  style: TextStyle(color: c.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Badge grid ───────────────────────────────────────────────
          AnimationLimiter(
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.75,
              ),
              itemCount: _badgeDefs.length,
              itemBuilder: (context, index) {
                final badge = _badgeDefs[index];
                final bool earned = earnedSet.contains(badge.id);
                return AnimationConfiguration.staggeredGrid(
                  position: index,
                  columnCount: 2,
                  duration: const Duration(milliseconds: 450),
                  child: ScaleAnimation(
                    scale: 0.85,
                    child: FadeInAnimation(
                      child: _buildBadgeCard(badge, earned, index),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Stat card matching web's glass-card style ──
  Widget _statCard({
    required IconData icon,
    required Color color,
    required String value,
    required String label,
    bool animate = false,
  }) {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, color.withOpacity(0.65)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: color.withOpacity(0.28), blurRadius: 10, offset: const Offset(0, 4))],
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.5,
            ),
          ),
          Text(label, style: TextStyle(color: c.textMuted, fontSize: 11)),
        ],
      ),
    );
  }

  // ── Level card with XP bar matching web's Lvl card ──
  Widget _levelCard(int level, int xpInLevel, AppColorScheme c) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.amber, Color(0xFFF97316)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: AppColors.amber.withOpacity(0.28), blurRadius: 10, offset: const Offset(0, 4))],
            ),
            child: const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            'Lvl $level',
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: xpInLevel / 100.0),
            duration: const Duration(milliseconds: 1000),
            curve: Curves.easeOutCubic,
            builder: (_, val, __) => ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Stack(
                children: [
                  Container(height: 6, decoration: BoxDecoration(color: c.surfaceElevated, borderRadius: BorderRadius.circular(4))),
                  FractionallySizedBox(
                    widthFactor: val,
                    child: Container(
                      height: 6,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [AppColors.amber, Color(0xFFF97316)]),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text('${100 - xpInLevel} XP to Lvl ${level + 1}', style: TextStyle(color: c.textMuted, fontSize: 9)),
        ],
      ),
    );
  }

  // ── Badge card matching web exactly ──
  Widget _buildBadgeCard(BadgeInfo badge, bool earned, int index) {
    final c = context.colors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        _showBadgeDetail(badge, earned);
      },
      child: AnimatedOpacity(
        opacity: earned ? 1.0 : 0.4,
        duration: const Duration(milliseconds: 300),
        child: Container(
          decoration: BoxDecoration(
            color: c.surfaceCard.withOpacity(context.isDark ? 0.5 : 0.85),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: earned ? badge.gradient.colors.first.withOpacity(0.3) : c.border,
              width: earned ? 1.5 : 1,
            ),
            boxShadow: earned
                ? [BoxShadow(
                    color: badge.gradient.colors.first.withOpacity(0.15),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  )]
                : null,
          ),
          padding: const EdgeInsets.fromLTRB(14, 18, 14, 14),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // ── Gradient icon container ──────────────────────────────
              Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: earned
                          ? badge.gradient
                          : const LinearGradient(
                              colors: [Color(0xFF374151), Color(0xFF4B5563)]),
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: earned
                          ? [
                              BoxShadow(
                                color: badge.gradient.colors.first
                                    .withOpacity(0.30),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              )
                            ]
                          : null,
                    ),
                    child: ColorFiltered(
                      colorFilter: earned
                          ? const ColorFilter.mode(
                              Colors.transparent, BlendMode.multiply)
                          : const ColorFilter.matrix([
                              0.2126, 0.7152, 0.0722, 0, 0,
                              0.2126, 0.7152, 0.0722, 0, 0,
                              0.2126, 0.7152, 0.0722, 0, 0,
                              0,      0,      0,      1, 0,
                            ]),
                      child: BadgeIconWidget(
                        badge: badge,
                        size: 46,
                        animated: earned,
                        earned: earned,
                      ),
                    ),
                  ),
                  if (earned)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: _ShimmerSweep(width: 72, height: 72),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              // Badge name
              Text(
                badge.name,
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.1,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              // Description — single line only to prevent overflow
              Text(
                badge.description,
                style: TextStyle(
                  color: c.textMuted,
                  fontSize: 10,
                  height: 1.3,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const Spacer(),
              // Earned / locked pill
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: earned
                      ? badge.gradient.colors.first.withOpacity(0.12)
                      : c.surfaceElevated,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: earned
                        ? badge.gradient.colors.first.withOpacity(0.35)
                        : c.border,
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      earned
                          ? Icons.check_circle_rounded
                          : Icons.lock_rounded,
                      color: earned ? badge.gradient.colors.first : c.textMuted,
                      size: 12,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      earned ? 'Earned' : 'Locked',
                      style: TextStyle(
                        color: earned ? badge.gradient.colors.first : c.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showBadgeDetail(BadgeInfo badge, bool earned) {
    final c = context.colors;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            decoration: BoxDecoration(
              color: c.surfaceCard.withOpacity(0.9),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              border: Border(top: BorderSide(color: c.border)),
            ),
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: c.textMuted.withOpacity(0.3), borderRadius: BorderRadius.circular(2)),
                ),
                const SizedBox(height: 24),
                // Large badge icon with gradient
                Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    gradient: earned ? badge.gradient : const LinearGradient(colors: [Color(0xFF374151), Color(0xFF4B5563)]),
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: earned
                        ? [BoxShadow(
                            color: badge.gradient.colors.first.withOpacity(0.4),
                            blurRadius: 24,
                            spreadRadius: 2,
                          )]
                        : null,
                  ),
                  child: BadgeIconWidget(badge: badge, size: 68, animated: earned, earned: earned),
                ),
                const SizedBox(height: 18),
                Text(
                  badge.name,
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  badge.description,
                  style: TextStyle(color: c.textSecondary, fontSize: 14, height: 1.5),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: earned ? badge.gradient : null,
                    color: earned ? null : c.surfaceElevated,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        earned ? Icons.check_circle_rounded : Icons.lock_rounded,
                        color: earned ? Colors.white : c.textMuted,
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        earned ? 'Earned' : 'Locked',
                        style: TextStyle(
                          color: earned ? Colors.white : c.textMuted,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Shimmer sweep animation (matches web's background-position shimmer) ──
class _ShimmerSweep extends StatefulWidget {
  final double width;
  final double height;
  const _ShimmerSweep({required this.width, required this.height});
  @override
  State<_ShimmerSweep> createState() => _ShimmerSweepState();
}

class _ShimmerSweepState extends State<_ShimmerSweep> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))
      ..repeat(reverse: false);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) {
        final x = -1.0 + _anim.value * 3.0;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment(x - 0.8, 0),
              end: Alignment(x + 0.8, 0),
              colors: [
                Colors.transparent,
                Colors.white.withOpacity(0.22),
                Colors.transparent,
              ],
            ),
          ),
        );
      },
    );
  }
}
