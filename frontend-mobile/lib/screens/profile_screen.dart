import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../models/user_profile.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../utils/badge_utils.dart';
import '../widgets/badge_icon_widget.dart';
import '../utils/companion_prefs.dart';
import '../utils/theme_provider.dart';
import '../utils/locale_provider.dart';
import '../widgets/floating_nav_bar.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/glass_card.dart';
import '../widgets/gradient_button.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/skeletons.dart';
import 'admin/admin_dashboard_screen.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/theme_switcher.dart';
import '../l10n/app_strings.dart';
import 'main_shell.dart';
import 'achievements_screen.dart';
import 'activity_screen.dart';

// ── IPG Kampus Perempuan Melayu Melaka — reference lists ─────────────────────

const _kDepartments = [
  'Jabatan Sains Sosial',
  'Jabatan Pengajian Melayu',
  'Jabatan Pendidikan Jasmani dan Kesihatan',
  'Jabatan Teknologi Pendidikan',
  'Jabatan Matematik dan Sains',
  'Jabatan Pengajian Islam',
  'Jabatan Bahasa Inggeris',
  'Jabatan Pengajian Cina',
  'Jabatan Pengajian Tamil',
  'Jabatan Ilmu Pendidikan',
  'Jabatan Hal Ehwal Pelajar',
];

// Class / Unit options — covers the main IPG pathways:
//   PPISMP (foundation), PISMP (bachelor), DPLI/KPLD/PISP (post-graduate).
// Specializations (opsyen) follow the canonical KPM bidang tawar list.
const _kClassUnits = [
  // PISMP (Bachelor — Pendidikan Rendah)
  'PISMP Bahasa Melayu',
  'PISMP Bahasa Inggeris (TESL)',
  'PISMP Bahasa Cina (SJKC)',
  'PISMP Bahasa Tamil (SJKT)',
  'PISMP Bahasa Arab',
  'PISMP Matematik',
  'PISMP Sains',
  'PISMP Sejarah',
  'PISMP Reka Bentuk & Teknologi (RBT)',
  'PISMP Teknologi Maklumat & Komunikasi (TMK)',
  'PISMP Pendidikan Islam',
  'PISMP Pendidikan Moral',
  'PISMP Pendidikan Jasmani & Kesihatan',
  'PISMP Pendidikan Seni Visual',
  'PISMP Pendidikan Muzik',
  'PISMP Pendidikan Awal Kanak-kanak (PAKK)',
  'PISMP Pendidikan Khas (Masalah Pembelajaran)',
  'PISMP Pendidikan Khas (Masalah Pendengaran)',
  'PISMP Pendidikan Khas (Masalah Penglihatan)',
  'PISMP Bimbingan & Kaunseling',

  // PPISMP (Foundation)
  'PPISMP Bahasa Melayu',
  'PPISMP Bahasa Inggeris (TESL)',
  'PPISMP Bahasa Cina',
  'PPISMP Bahasa Tamil',
  'PPISMP Bahasa Arab',
  'PPISMP Matematik',
  'PPISMP Sains',
  'PPISMP Sejarah',
  'PPISMP Reka Bentuk & Teknologi',
  'PPISMP Pendidikan Islam',
  'PPISMP Pendidikan Jasmani & Kesihatan',
  'PPISMP Pendidikan Seni Visual',
  'PPISMP Pendidikan Muzik',
  'PPISMP Pendidikan Awal Kanak-kanak',
  'PPISMP Pendidikan Khas (Masalah Pembelajaran)',
  'PPISMP Bimbingan & Kaunseling',

  // Post-graduate / Master's pathways
  'DPLI Pendidikan Rendah',
  'KPLD Pendidikan Rendah',
  'PISP Pendidikan Rendah',
];

// ─────────────────────────────────────────────────────────────────────────────

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  // ── Data state ───────────────────────────────────────────────────────────────
  Map<String, dynamic>? _me;
  bool _loading = true;
  bool _saving = false;
  bool _companionEnabled = true;

  // ── Editable form state ──────────────────────────────────────────────────────
  late final TextEditingController _nameCtrl;
  String _classUnit  = '';
  int    _year       = 1;
  int    _semester   = 1;
  String _department = '';

  String _origName       = '';
  String _origClass      = '';
  int    _origYear       = 1;
  int    _origSemester   = 1;
  String _origDepartment = '';

  bool get _isStudent => (_me?['role'] ?? 'student').toString() == 'student';

  bool get _isDirty =>
      _nameCtrl.text.trim() != _origName ||
      (_isStudent && _classUnit != _origClass) ||
      _year       != _origYear       ||
      _semester   != _origSemester   ||
      _department != _origDepartment;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _nameCtrl.addListener(() => setState(() {}));
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  void _initFormFromData() {
    int _toInt(dynamic v, int fallback) {
      if (v == null) return fallback;
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString()) ?? fallback;
    }

    final name = (_me?['display_name'] ?? '').toString();
    final cls  = (_me?['class_name']   ?? '').toString();
    final yr   = _toInt(_me?['year'],     1);
    final sem  = _toInt(_me?['semester'], 1);
    final dept = (_me?['department']   ?? '').toString();

    _nameCtrl.text = name;
    _classUnit     = cls;
    _year          = yr;
    _semester      = sem;
    _department    = dept;

    _origName       = name;
    _origClass      = cls;
    _origYear       = yr;
    _origSemester   = sem;
    _origDepartment = dept;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.getMe(),
        CompanionPrefs.isEnabled(),
      ]);
      if (mounted) {
        _me               = results[0] as Map<String, dynamic>;
        _companionEnabled = results[1] as bool;
        _initFormFromData();
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  Future<void> _saveProfile() async {
    if (!_isDirty || _saving) return;
    HapticFeedback.mediumImpact();
    setState(() => _saving = true);
    final role = (_me?['role'] ?? 'student').toString();
    try {
      final updates = <String, dynamic>{
        'display_name': _nameCtrl.text.trim(),
      };
      if (role == 'student') {
        updates['class_name'] = _classUnit;
        updates['year']       = _year;
        updates['semester']   = _semester;
      }
      if (role == 'lecturer') {
        updates['department'] = _department;
      }
      await ApiService.updateMe(updates);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Profile updated successfully!'),
          backgroundColor: AppColors.emerald,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: AppColors.red,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Avatar ───────────────────────────────────────────────────────────────────

  Future<void> _pickAvatar() async {
    HapticFeedback.lightImpact();
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery, maxWidth: 512);
    if (img == null) return;
    try {
      await ApiService.uploadAvatar(img.path);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Avatar updated!'),
          backgroundColor: AppColors.emerald,
        ));
        _load();
        context.findAncestorStateOfType<MainShellState>()?.refreshHomeProfile();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: AppColors.red),
        );
      }
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  Future<void> _logout() async {
    final s = S.of(context);
    final confirm = await showConfirmationDialog(
      context: context,
      title: s.logOut,
      message: s.logOutConfirm,
      isDanger: true,
      confirmLabel: s.logOut,
    );
    if (confirm != true) return;
    await FirebaseAuth.instance.signOut();
  }

  // ── Language picker ──────────────────────────────────────────────────────────

  void _showLanguagePicker() {
    final c = context.colors;
    final s = S.of(context);
    final localeProvider = LocaleScope.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: c.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: c.textMuted.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(s.language,
                style: TextStyle(color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            _languageOption('English', '🇬🇧', const Locale('en'), localeProvider, c),
            const SizedBox(height: 10),
            _languageOption('Bahasa Melayu', '🇲🇾', const Locale('ms'), localeProvider, c),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _languageOption(String label, String flag, Locale locale,
      LocaleProvider provider, AppColorScheme c) {
    final isSelected = provider.locale.languageCode == locale.languageCode;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        provider.setLocale(locale);
        Navigator.pop(context);
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.blue.withValues(alpha: 0.1) : Colors.transparent,
          border: Border.all(
            color: isSelected ? AppColors.blue : c.border,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Text(flag, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 14),
            Expanded(
              child: Text(label,
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  )),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: AppColors.blue, size: 22),
          ],
        ),
      ),
    );
  }

  // ── Generic picker ───────────────────────────────────────────────────────────

  void _showPicker({
    required String title,
    required List<String> options,
    required String selected,
    required void Function(String) onSelect,
    bool allowEmpty = true,
    Color? accent,
  }) {
    final c = context.colors;
    final isDark = context.isDark;
    final role = (_me?['role'] ?? 'student').toString();
    final a = accent ?? AppColors.accentForRole(role);

    showGlassBottomSheet(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36, height: 4,
            margin: const EdgeInsets.fromLTRB(0, 12, 0, 0),
            decoration: BoxDecoration(color: c.border, borderRadius: BorderRadius.circular(2)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(title,
                  style: TextStyle(color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
            ),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 380),
            child: ListView.builder(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              itemCount: options.length + (allowEmpty ? 1 : 0),
              itemBuilder: (_, i) {
                final isEmptyRow = allowEmpty && i == 0;
                final opt   = isEmptyRow ? '' : options[allowEmpty ? i - 1 : i];
                final label = isEmptyRow ? 'Not specified' : opt;
                final isSel = opt == selected;
                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    Navigator.pop(ctx);
                    onSelect(opt);
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: isSel
                          ? a.withValues(alpha: 0.11)
                          : (isDark
                              ? Colors.white.withValues(alpha: 0.04)
                              : Colors.black.withValues(alpha: 0.03)),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(
                        color: isSel ? a.withValues(alpha: 0.30) : Colors.transparent,
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            label,
                            style: TextStyle(
                              color: isSel ? a : (isEmptyRow ? c.textMuted : c.textPrimary),
                              fontSize: 14,
                              fontWeight: isSel ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                        ),
                        if (isSel)
                          Container(
                            width: 22, height: 22,
                            decoration: BoxDecoration(
                              color: a.withValues(alpha: 0.13),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(Icons.check_rounded, color: a, size: 14),
                          ),
                      ],
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

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isDark = context.isDark;
    final s = S.of(context);

    if (_loading || _me == null) {
      return const Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(child: SkeletonProfile()),
      );
    }

    final role       = (_me?['role'] ?? 'student').toString();
    final isStudent  = role == 'student';
    final isLecturer = role == 'lecturer';
    final name       = (_me?['display_name'] ?? 'User').toString();
    final email      = (_me?['email'] ?? '').toString();
    // Users signed in with Google (only) don't have a Firebase password,
    // so hide the reset-password tile for them.
    final fbUser     = FirebaseAuth.instance.currentUser;
    final hasPasswordProvider = fbUser?.providerData
            .any((p) => p.providerId == 'password') ??
        false;
    final profile    = UserProfile.fromApi(_me!);
    final photoUrl   = profile.avatarUrl;
    final badges     = List<String>.from(_me?['badges'] ?? []);
    final points     = (_me?['points'] ?? 0) as int;
    final streak     = (_me?['streak'] ?? 0) as int;
    final themeProvider  = ThemeScope.of(context);
    final localeProvider = LocaleScope.of(context);
    final accent     = AppColors.accentForRole(role);
    final roleGrad   = AppColors.gradientForRole(role);

    // Warm pastel sunset/sunrise gradient exclusively for the banner overlay
    final pSlate     = const Color(0xFF8BB5DC);
    final pLavender  = const Color(0xFFBFA8D9);
    final pPeach     = const Color(0xFFF0A48C);
    final pSand      = const Color(0xFFF5D79E);
    final pRose      = const Color(0xFFF0B8A8);
    
    final heroGradientPair = isLecturer
        ? [pLavender, pRose]
        : (role == 'admin' ? [pPeach, pSand] : [pSlate, pPeach]);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        slivers: [

          // ── Hero ────────────────────────────────────────────────────────
          SliverAppBar(
            expandedHeight: isStudent ? 316 : 272,
            pinned: true,
            stretch: true,
            backgroundColor: isDark
                ? const Color(0xFF0A0A1A).withValues(alpha: 0.96)
                : Colors.white.withValues(alpha: 0.96),
            foregroundColor: Colors.white,
            scrolledUnderElevation: 0,
            elevation: 0,
            title: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                child: Text(
                  'My Profile',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              collapseMode: CollapseMode.parallax,
              stretchModes: const [StretchMode.zoomBackground],
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // Campus Background Image
                  Image.asset(
                    'assets/patterns/profile_banner_ipg_melaka.png',
                    fit: BoxFit.cover,
                  ),
                  // Gradient Theme Overlay
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          heroGradientPair[0].withValues(alpha: 0.70),
                          heroGradientPair[1].withValues(alpha: 0.70),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),
                  // Dark bottom vignette specifically for white text readability
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.65),
                          ],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          stops: const [0.4, 1.0],
                        ),
                      ),
                    ),
                  ),
                  // Decorative orbs
                  Stack(
                    children: [
                      Positioned(top: -70, right: -70, child: _orb(230, 0.09)),
                    Positioned(bottom: 10, left: -50, child: _orb(140, 0.06)),
                    Positioned(top: 90, right: 50,   child: _orb(65,  0.07)),
                    Positioned(top: 170, left: 20,   child: _orb(42,  0.05)),
                    Positioned(bottom: 60, right: 30, child: _orb(30, 0.04)),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 26),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            // ── Avatar ──────────────────────────────
                            GestureDetector(
                              onTap: _pickAvatar,
                              child: Stack(
                                alignment: Alignment.bottomRight,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(3),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      gradient: LinearGradient(
                                        colors: [
                                          Colors.white.withValues(alpha: 0.85),
                                          Colors.white.withValues(alpha: 0.35),
                                        ],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.28),
                                          blurRadius: 26,
                                          offset: const Offset(0, 8),
                                        ),
                                      ],
                                    ),
                                    child: AvatarWidget(
                                      imageUrl: photoUrl,
                                      name: name,
                                      size: 100,
                                      role: role,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.all(7),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [accent, accent.withValues(alpha: 0.7)],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.white, width: 2.5),
                                      boxShadow: [
                                        BoxShadow(
                                          color: accent.withValues(alpha: 0.55),
                                          blurRadius: 12,
                                        ),
                                      ],
                                    ),
                                    child: const Icon(Icons.camera_alt_rounded,
                                        color: Colors.white, size: 13),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            // ── Name ─────────────────────────────────
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                name,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            // ── Email ─────────────────────────────────
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.email_outlined,
                                    size: 12, color: Colors.white.withValues(alpha: 0.6)),
                                const SizedBox(width: 4),
                                Text(email,
                                    style: TextStyle(
                                        color: Colors.white.withValues(alpha: 0.65),
                                        fontSize: 12)),
                              ],
                            ),
                            const SizedBox(height: 10),
                            // ── Pill row ──────────────────────────────
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                _HeaderPill(label: role.toUpperCase()),
                                if (isStudent) ...[
                                  const SizedBox(width: 8),
                                  _HeaderPill(
                                    label: 'Lv.${(points ~/ 100) + 1}',
                                    icon: Icons.star_rounded,
                                  ),
                                ],
                                if (isLecturer && _department.isNotEmpty) ...[
                                  const SizedBox(width: 8),
                                  _HeaderPill(
                                    label: _department.replaceFirst('Jabatan ', 'Jab. '),
                                    icon: Icons.business_rounded,
                                  ),
                                ],
                              ],
                            ),
                            // ── XP bar (student) ──────────────────────
                            if (isStudent) ...[
                              const SizedBox(height: 12),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: Column(
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '${points % 100} / 100 XP',
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.75),
                                            fontSize: 11, fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        Text(
                                          'Next Lv.${(points ~/ 100) + 2}',
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.75),
                                            fontSize: 11, fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 5),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(6),
                                      child: LinearProgressIndicator(
                                        value: (points % 100) / 100.0,
                                        minHeight: 6,
                                        backgroundColor: Colors.white.withValues(alpha: 0.18),
                                        valueColor: const AlwaysStoppedAnimation(Colors.white),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

          // ── Body ────────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: AnimationLimiter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: AnimationConfiguration.toStaggeredList(
                  duration: const Duration(milliseconds: 380),
                  childAnimationBuilder: (w) => SlideAnimation(
                    verticalOffset: 24.0,
                    child: FadeInAnimation(child: w),
                  ),
                  children: [
                    const SizedBox(height: 20),

                    // ── Stat cards ───────────────────────────────────────
                    if (isStudent) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Row(
                          children: [
                            Expanded(child: _gradStatCard(
                              value: '$points', label: s.points,
                              icon: Icons.star_rounded,
                              grad: const LinearGradient(
                                colors: [Color(0xFFF59E0B), Color(0xFFF97316)],
                                begin: Alignment.topLeft, end: Alignment.bottomRight,
                              ),
                              c: c, isDark: isDark,
                            )),
                            const SizedBox(width: 10),
                            Expanded(child: _gradStatCard(
                              value: '$streak', label: s.streak,
                              icon: Icons.local_fire_department_rounded,
                              grad: const LinearGradient(
                                colors: [Color(0xFFF97316), Color(0xFFEF4444)],
                                begin: Alignment.topLeft, end: Alignment.bottomRight,
                              ),
                              c: c, isDark: isDark,
                            )),
                            const SizedBox(width: 10),
                            Expanded(child: _gradStatCard(
                              value: '${badges.length}', label: s.badges,
                              icon: Icons.emoji_events_rounded,
                              grad: LinearGradient(
                                colors: [accent, accent.withValues(alpha: 0.65)],
                                begin: Alignment.topLeft, end: Alignment.bottomRight,
                              ),
                              c: c, isDark: isDark,
                            )),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // ── Quick info card ──────────────────────────────────
                    if ((isStudent && (_classUnit.isNotEmpty || _year > 0)) ||
                        (isLecturer && _department.isNotEmpty)) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: GlassCard(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(9),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [accent, accent.withValues(alpha: 0.7)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: [
                                    BoxShadow(
                                      color: accent.withValues(alpha: 0.30),
                                      blurRadius: 8, offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  isLecturer ? Icons.business_rounded : Icons.school_rounded,
                                  color: Colors.white, size: 18,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (isStudent && _classUnit.isNotEmpty)
                                      Text(
                                        _classUnit,
                                        style: TextStyle(
                                          color: c.textPrimary,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    if (isLecturer && _department.isNotEmpty)
                                      Text(
                                        _department,
                                        style: TextStyle(
                                          color: c.textPrimary,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    if (isStudent) ...[
                                      const SizedBox(height: 3),
                                      Text(
                                        'Year $_year  ·  Semester $_semester',
                                        style: TextStyle(color: c.textMuted, fontSize: 11),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                decoration: BoxDecoration(
                                  color: accent.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: accent.withValues(alpha: 0.22)),
                                ),
                                child: Text(
                                  'IPG',
                                  style: TextStyle(
                                    color: accent,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // ── Edit Profile ─────────────────────────────────────
                    _buildSectionHeader('Edit Profile', Icons.manage_accounts_rounded, accent, c),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: GlassCard(
                        padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Full Name
                            TextField(
                              controller: _nameCtrl,
                              textCapitalization: TextCapitalization.words,
                              style: TextStyle(color: c.textPrimary, fontSize: 14),
                              decoration: AppTheme.inputDecoration(
                                context,
                                label: 'Full Name',
                                prefixIcon: Icons.person_rounded,
                              ),
                            ),
                            const SizedBox(height: 14),
                            // Email (read-only)
                            _readOnlyField(Icons.email_rounded, email, c, isDark),
                            const SizedBox(height: 14),
                            // Class / Unit + Year + Semester (student only)
                            if (isStudent) ...[
                              _dropdownField(
                                value: _classUnit,
                                hint: 'Class / Unit',
                                icon: Icons.class_rounded,
                                accent: accent, c: c, isDark: isDark,
                                onTap: () => _showPicker(
                                  title: 'Class / Unit',
                                  options: _kClassUnits,
                                  selected: _classUnit,
                                  onSelect: (v) => setState(() => _classUnit = v),
                                  accent: accent,
                                ),
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(child: _dropdownField(
                                    value: 'Year $_year',
                                    icon: Icons.calendar_today_rounded,
                                    accent: accent, c: c, isDark: isDark,
                                    onTap: () => _showPicker(
                                      title: 'Academic Year',
                                      options: const ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
                                      selected: 'Year $_year',
                                      allowEmpty: false,
                                      onSelect: (v) => setState(() =>
                                          _year = int.parse(v.split(' ').last)),
                                      accent: accent,
                                    ),
                                  )),
                                  const SizedBox(width: 12),
                                  Expanded(child: _dropdownField(
                                    value: 'Semester $_semester',
                                    icon: Icons.layers_rounded,
                                    accent: accent, c: c, isDark: isDark,
                                    onTap: () => _showPicker(
                                      title: 'Semester',
                                      options: const ['Semester 1', 'Semester 2'],
                                      selected: 'Semester $_semester',
                                      allowEmpty: false,
                                      onSelect: (v) => setState(() =>
                                          _semester = int.parse(v.split(' ').last)),
                                      accent: accent,
                                    ),
                                  )),
                                ],
                              ),
                            ],
                            // Department (lecturer)
                            if (isLecturer) ...[
                              const SizedBox(height: 14),
                              _dropdownField(
                                value: _department,
                                hint: 'Department',
                                icon: Icons.business_rounded,
                                accent: accent, c: c, isDark: isDark,
                                onTap: () => _showPicker(
                                  title: 'Department',
                                  options: _kDepartments,
                                  selected: _department,
                                  onSelect: (v) => setState(() => _department = v),
                                  accent: accent,
                                ),
                              ),
                            ],
                            const SizedBox(height: 22),
                            // Save button
                            AnimatedOpacity(
                              opacity: _isDirty ? 1.0 : 0.38,
                              duration: const Duration(milliseconds: 220),
                              child: GradientButton(
                                label: 'Save Changes',
                                icon: Icons.check_rounded,
                                role: role,
                                isLoading: _saving,
                                onPressed: _isDirty && !_saving ? _saveProfile : null,
                              ),
                            ),
                            if (_isDirty)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Center(
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.info_outline_rounded,
                                          size: 12, color: accent),
                                      const SizedBox(width: 4),
                                      Text(
                                        'You have unsaved changes',
                                        style: TextStyle(
                                          color: accent,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),

                    // ── Achievements ─────────────────────────────────────
                    if (isStudent && badges.isNotEmpty) ...[
                      const SizedBox(height: 12),

                      // Header
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Row(
                          children: [
                            Container(
                              width: 3.5, height: 22,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [AppColors.amber, Color(0xFFF97316)],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: AppColors.amber.withValues(alpha: 0.10),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.emoji_events_rounded,
                                  color: AppColors.amber, size: 14),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              s.achievements,
                              style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.1,
                              ),
                            ),
                            const Spacer(),
                            GestureDetector(
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const AchievementsScreen()),
                              ),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: AppColors.amber.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                      color: AppColors.amber.withValues(alpha: 0.25)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text('See All',
                                        style: TextStyle(
                                            color: AppColors.amber,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600)),
                                    const SizedBox(width: 2),
                                    const Icon(Icons.chevron_right_rounded,
                                        color: AppColors.amber, size: 14),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Progress card
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: GlassCard(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 13),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(9),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [AppColors.amber, Color(0xFFF97316)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.amber.withValues(alpha: 0.35),
                                      blurRadius: 10,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.workspace_premium_rounded,
                                    color: Colors.white, size: 20),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          '${badges.length} badge${badges.length != 1 ? "s" : ""} earned',
                                          style: TextStyle(
                                              color: c.textPrimary,
                                              fontSize: 13,
                                              fontWeight: FontWeight.w700),
                                        ),
                                        const Spacer(),
                                        Text(
                                          '${badges.length} / ${BadgeUtils.allBadges.length}',
                                          style: TextStyle(
                                              color: c.textMuted, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 7),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: TweenAnimationBuilder<double>(
                                        tween: Tween(
                                            begin: 0,
                                            end: badges.length /
                                                BadgeUtils.allBadges.length),
                                        duration: const Duration(milliseconds: 900),
                                        curve: Curves.easeOutCubic,
                                        builder: (_, val, __) =>
                                            LinearProgressIndicator(
                                          value: val,
                                          minHeight: 6,
                                          backgroundColor: c.surfaceElevated,
                                          valueColor:
                                              const AlwaysStoppedAnimation(
                                                  AppColors.amber),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Badge scroll
                      SizedBox(
                        height: 206,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 6),
                          itemCount: badges.length,
                          itemBuilder: (_, i) {
                            final badgeId = badges[i];
                            final info = BadgeUtils.getInfo(badgeId);
                            final grad = info?.gradient ??
                                const LinearGradient(
                                  colors: [AppColors.amber, Color(0xFFF97316)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                );
                            final primaryColor = grad.colors.first;
                            final bName =
                                info?.name ?? BadgeUtils.displayName(badgeId);
                            final bDesc = info?.description ?? '';

                            return GestureDetector(
                              onTap: () {
                                HapticFeedback.lightImpact();
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                      builder: (_) =>
                                          const AchievementsScreen()),
                                );
                              },
                              child: Container(
                                width: 148,
                                margin: EdgeInsets.only(
                                    right: i < badges.length - 1 ? 12 : 0),
                                decoration: BoxDecoration(
                                  color: isDark
                                      ? const Color(0xFF111128)
                                      : Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: primaryColor.withValues(alpha: 0.30),
                                    width: 1.5,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: primaryColor.withValues(alpha: 0.18),
                                      blurRadius: 16,
                                      offset: const Offset(0, 6),
                                    ),
                                  ],
                                ),
                                child: Stack(
                                  children: [
                                    Positioned(
                                      bottom: 0, left: 0, right: 0,
                                      child: Container(
                                        height: 64,
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              const BorderRadius.vertical(
                                                  bottom: Radius.circular(20)),
                                          gradient: LinearGradient(
                                            begin: Alignment.bottomCenter,
                                            end: Alignment.topCenter,
                                            colors: [
                                              primaryColor.withValues(alpha: 0.14),
                                              Colors.transparent,
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(
                                          12, 18, 12, 14),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.max,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.center,
                                        children: [
                                          Container(
                                            width: 80, height: 80,
                                            alignment: Alignment.center,
                                            decoration: BoxDecoration(
                                              gradient: grad,
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: primaryColor
                                                      .withValues(alpha: 0.35),
                                                  blurRadius: 12,
                                                  offset: const Offset(0, 4),
                                                ),
                                              ],
                                            ),
                                            child: info != null
                                                ? BadgeIconWidget(
                                                    badge: info,
                                                    size: 50,
                                                    animated: true,
                                                    earned: true,
                                                  )
                                                : Text(
                                                    BadgeUtils.emoji(badgeId),
                                                    style: const TextStyle(
                                                        fontSize: 30),
                                                  ),
                                          ),
                                          const SizedBox(height: 10),
                                          // Fixed-height area for name so all cards align
                                          SizedBox(
                                            height: 32,
                                            child: Align(
                                              alignment: Alignment.topCenter,
                                              child: Text(
                                                bName,
                                                style: TextStyle(
                                                  color: c.textPrimary,
                                                  fontSize: 12.5,
                                                  fontWeight: FontWeight.w700,
                                                  height: 1.2,
                                                ),
                                                textAlign: TextAlign.center,
                                                maxLines: 2,
                                                overflow:
                                                    TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ),
                                          // Fixed-height area for description
                                          SizedBox(
                                            height: 16,
                                            child: bDesc.isNotEmpty
                                                ? Text(
                                                    bDesc,
                                                    style: TextStyle(
                                                      color: c.textMuted,
                                                      fontSize: 9.5,
                                                      height: 1.3,
                                                    ),
                                                    textAlign:
                                                        TextAlign.center,
                                                    maxLines: 1,
                                                    overflow: TextOverflow
                                                        .ellipsis,
                                                  )
                                                : const SizedBox.shrink(),
                                          ),
                                          const Spacer(),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: primaryColor
                                                  .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                              border: Border.all(
                                                color: primaryColor
                                                    .withValues(alpha: 0.30),
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(Icons.check_circle_rounded,
                                                    color: primaryColor,
                                                    size: 11),
                                                const SizedBox(width: 4),
                                                Text('Earned',
                                                    style: TextStyle(
                                                        color: primaryColor,
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w600)),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],

                    // ── Admin ────────────────────────────────────────────
                    if (role == 'admin') ...[
                      const SizedBox(height: 12),
                      _buildSectionHeader(
                          'Administration', Icons.admin_panel_settings_rounded,
                          AppColors.amber, c),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: GlassCard(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const AdminDashboardScreen()),
                          ),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(9),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [AppColors.amber, Color(0xFFF97316)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(11),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.amber.withValues(alpha: 0.30),
                                      blurRadius: 10, offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.dashboard_rounded,
                                    color: Colors.white, size: 20),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Admin Dashboard',
                                        style: TextStyle(
                                            color: c.textPrimary,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 14)),
                                    Text('Manage users, badges & content',
                                        style: TextStyle(
                                            color: c.textSecondary, fontSize: 12)),
                                  ],
                                ),
                              ),
                              Icon(Icons.chevron_right_rounded,
                                  color: c.textMuted),
                            ],
                          ),
                        ),
                      ),
                    ],

                    // ── Settings ─────────────────────────────────────────
                    const SizedBox(height: 12),
                    _buildSectionHeader(s.settings, Icons.settings_rounded, accent, c),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: GlassCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            // Dark mode
                            GestureDetector(
                              onTapUp: (details) {
                                HapticFeedback.mediumImpact();
                                final switcher = ThemeSwitcher.of(context);
                                switcher.captureAndAnimate(
                                  details.globalPosition,
                                  () => themeProvider.toggle(),
                                );
                              },
                              child: _settingsTile(
                                icon: context.isDark
                                    ? Icons.dark_mode_rounded
                                    : Icons.light_mode_rounded,
                                iconColor: accent,
                                title: s.darkMode,
                                subtitle: s.toggleTheme,
                                trailing: Switch.adaptive(
                                  value: context.isDark,
                                  activeColor: accent,
                                  onChanged: (_) {
                                    HapticFeedback.mediumImpact();
                                    themeProvider.toggle();
                                  },
                                ),
                                c: c,
                              ),
                            ),
                            Divider(height: 1, thickness: 1, color: c.divider),
                            // Language
                            GestureDetector(
                              onTap: () {
                                HapticFeedback.lightImpact();
                                _showLanguagePicker();
                              },
                              child: _settingsTile(
                                icon: Icons.translate_rounded,
                                iconColor: accent,
                                title: s.language,
                                subtitle: s.languageSubtitle,
                                trailing: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: accent.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    localeProvider.isMalay ? 'BM' : 'EN',
                                    style: TextStyle(
                                        color: accent,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13),
                                  ),
                                ),
                                c: c,
                              ),
                            ),
                            // AI Companion (student only)
                            if (isStudent) ...[
                              Divider(height: 1, thickness: 1, color: c.divider),
                              _settingsTile(
                                icon: Icons.psychology_rounded,
                                iconColor: accent,
                                title: 'AI Companion',
                                subtitle: 'Smart study recommendations',
                                trailing: Switch.adaptive(
                                  value: _companionEnabled,
                                  activeColor: accent,
                                  onChanged: (val) {
                                    HapticFeedback.lightImpact();
                                    setState(() => _companionEnabled = val);
                                    CompanionPrefs.setEnabled(val);
                                    final shell =
                                        context.findAncestorStateOfType<
                                            MainShellState>();
                                    shell?.setCompanionEnabled(val);
                                  },
                                ),
                                c: c,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),

                    // ── Account ──────────────────────────────────────────
                    const SizedBox(height: 12),
                    _buildSectionHeader(s.account, Icons.person_rounded, accent, c),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        children: [
                          GlassCard(
                            padding: EdgeInsets.zero,
                            child: _actionTile(
                              icon: Icons.bar_chart_rounded,
                              title: s.activity,
                              subtitle: 'View your full activity history',
                              color: const Color(0xFFB4C2E0),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const ActivityScreen()),
                              ),
                              c: c,
                            ),
                          ),
                          if (hasPasswordProvider) ...[
                            const SizedBox(height: 10),
                            GlassCard(
                              padding: EdgeInsets.zero,
                              child: _actionTile(
                                icon: Icons.lock_reset_rounded,
                                title: s.resetPassword,
                                subtitle: s.resetPasswordSubtitle,
                                color: accent,
                                onTap: () async {
                                  if (email.isEmpty) return;
                                  try {
                                    await ApiService.requestPasswordReset(email);
                                    if (mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                        content: Text(s.resetPasswordSent),
                                        backgroundColor: AppColors.emerald,
                                      ));
                                    }
                                  } catch (e) {
                                    if (mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                        content: Text('Failed to send reset email: $e'),
                                        backgroundColor: AppColors.red,
                                      ));
                                    }
                                  }
                                },
                                c: c,
                              ),
                            ),
                          ],
                          const SizedBox(height: 10),
                          Container(
                            decoration: BoxDecoration(
                              color: AppColors.red.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: AppColors.red.withValues(alpha: 0.20),
                                width: 1,
                              ),
                            ),
                            child: _actionTile(
                              icon: Icons.logout_rounded,
                              title: s.logOut,
                              subtitle: s.logOutSubtitle,
                              color: AppColors.red,
                              onTap: _logout,
                              isDanger: true,
                              c: c,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // ── Footer ───────────────────────────────────────────
                    const SizedBox(height: 36),
                    Center(
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: c.border.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'MySmartStudy Mobile v1.0',
                              style: TextStyle(
                                  color: c.textMuted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'IPG Kampus Perempuan Melayu Melaka',
                            style: TextStyle(
                                color: c.textMuted.withValues(alpha: 0.55),
                                fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: FloatingNavBar.kTotalHeight + 24),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /// Circular decorative orb for the hero background.
  static Widget _orb(double size, double opacity) => Container(
        width: size, height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: opacity),
        ),
      );

  /// Gradient stat card (points / streak / badges).
  static Widget _gradStatCard({
    required String value,
    required String label,
    required IconData icon,
    required LinearGradient grad,
    required AppColorScheme c,
    required bool isDark,
  }) {
    final primary = grad.colors.first;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
      decoration: BoxDecoration(
        color: isDark
            ? primary.withValues(alpha: 0.08)
            : primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: primary.withValues(alpha: 0.22), width: 1),
        boxShadow: [
          BoxShadow(
            color: primary.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: grad,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: primary.withValues(alpha: 0.30),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 18),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: c.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  /// Section header with left accent bar + gradient icon.
  Widget _buildSectionHeader(
      String title, IconData icon, Color accent, AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 10),
      child: Row(
        children: [
          Container(
            width: 3.5, height: 22,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [accent, accent.withValues(alpha: 0.35)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: accent, size: 14),
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.1,
            ),
          ),
        ],
      ),
    );
  }

  /// Read-only email field styled consistently with the form inputs.
  static Widget _readOnlyField(
      IconData icon, String value, AppColorScheme c, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: c.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              style: TextStyle(color: c.textSecondary, fontSize: 14),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: c.border,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              'fixed',
              style: TextStyle(
                  color: c.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _dropdownField({
    required String value,
    String? hint,
    required IconData icon,
    required Color accent,
    required AppColorScheme c,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    final hasValue = value.isNotEmpty;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.black.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.10)
                : Colors.black.withValues(alpha: 0.08),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: hasValue ? accent : c.textMuted),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                hasValue ? value : (hint ?? 'Select…'),
                style: TextStyle(
                  color: hasValue ? c.textPrimary : c.textMuted,
                  fontSize: 14,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.keyboard_arrow_down_rounded, color: c.textMuted, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _settingsTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required Widget trailing,
    required AppColorScheme c,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                Text(subtitle,
                    style: TextStyle(color: c.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }

  Widget _actionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
    required AppColorScheme c,
    bool isDanger = false,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: isDanger ? AppColors.red : c.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  Text(subtitle,
                      style: TextStyle(color: c.textSecondary, fontSize: 12)),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: isDanger
                  ? AppColors.red.withValues(alpha: 0.5)
                  : c.textMuted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header pill ───────────────────────────────────────────────────────────────

class _HeaderPill extends StatelessWidget {
  final String label;
  final IconData? icon;

  const _HeaderPill({required this.label, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.20),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: Colors.white, size: 11),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              letterSpacing: 0.8,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
