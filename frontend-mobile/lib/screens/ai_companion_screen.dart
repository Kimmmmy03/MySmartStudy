import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/section_header.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/empty_state.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/skeletons.dart';
import 'ai_learning_style_screen.dart';

// ── Pastel palette (matches home/grades/others) ────────────────────────────
const _pLavender   = Color(0xFFBFA8D9); // primary — SmartBuddy brand
const _pSky        = Color(0xFFA9C9E8); // calm / info / low priority
const _pSage       = Color(0xFFA8C9A8); // success / save
const _pSand       = Color(0xFFF5D79E); // medium priority / highlight
const _pPeach      = Color(0xFFF0A48C); // motivational / warm
const _pMutedRose  = Color(0xFFE89988); // high priority / destructive
const _pPeriwinkle = Color(0xFFB4C2E0); // secondary

Color _darken(Color c, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(c);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

class AiCompanionScreen extends StatefulWidget {
  const AiCompanionScreen({super.key});
  @override
  State<AiCompanionScreen> createState() => _AiCompanionScreenState();
}

class _AiCompanionScreenState extends State<AiCompanionScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // VARK gate / profile
  bool _checkingProfile = true;
  bool _hasProfile = false;
  String? _learningStyle;
  List<String> _strengths = [];
  List<String> _weaknesses = [];

  // Today tab
  Map<String, dynamic>? _guide;
  bool _loadingGuide = false;
  String? _guideError;
  final Set<int> _expandedRecs = {};

  // Timetable tab
  final _timetableCtrl = TextEditingController();
  final _semesterLabelCtrl = TextEditingController();
  Map<String, dynamic>? _timetableResult;
  bool _analyzingTimetable = false;
  String? _uploadedFileName;
  List<Map<String, dynamic>> _savedTimetables = [];
  bool _loadingSaved = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _init();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _timetableCtrl.dispose();
    _semesterLabelCtrl.dispose();
    super.dispose();
  }

  // ── Init / loading ────────────────────────────────────────────────────────

  Future<void> _init() async {
    setState(() => _checkingProfile = true);
    try {
      final profile = await ApiService.aiGetLearningProfile();
      if (profile != null &&
          profile is Map &&
          (profile['learning_style'] ?? '').toString().isNotEmpty) {
        _hasProfile = true;
        _learningStyle = profile['learning_style'].toString();
        _strengths = List<String>.from(profile['strengths'] ?? []);
        _weaknesses = List<String>.from(profile['weaknesses'] ?? []);
      } else {
        _hasProfile = false;
      }
    } catch (_) {
      _hasProfile = false;
    }
    if (!mounted) return;
    setState(() => _checkingProfile = false);
    if (_hasProfile) {
      _loadGuide();
      _loadSavedTimetables();
    }
  }

  Future<void> _loadGuide() async {
    setState(() {
      _loadingGuide = true;
      _guideError = null;
    });
    try {
      final data = await ApiService.aiDailyGuide();
      if (mounted) setState(() {
        _guide = data;
        _loadingGuide = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _guideError = 'Could not load today\'s guide. Pull down to retry.';
        _loadingGuide = false;
      });
    }
  }

  Future<void> _loadSavedTimetables() async {
    setState(() => _loadingSaved = true);
    try {
      final data = await ApiService.aiListTimetables();
      if (mounted) setState(() {
        _savedTimetables = data.map((e) => Map<String, dynamic>.from(e)).toList();
        _loadingSaved = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingSaved = false);
    }
  }

  void _onProfileComplete(String style) {
    setState(() {
      _hasProfile = true;
      _learningStyle = style;
    });
    _init();
  }

  void _retakeAssessment() {
    HapticFeedback.lightImpact();
    setState(() => _hasProfile = false);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  String get _todayFormatted {
    final now = DateTime.now();
    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return '${days[now.weekday - 1]}, ${now.day} ${months[now.month]} ${now.year}';
  }

  int _parseAmPm(String timeStr) {
    final part = timeStr.split('-').first.trim();
    final m = RegExp(r'(\d{1,2}):(\d{2})\s*(AM|PM)', caseSensitive: false).firstMatch(part);
    if (m == null) return 9999;
    var h = int.parse(m.group(1)!);
    final mm = int.parse(m.group(2)!);
    final ap = m.group(3)!.toUpperCase();
    if (ap == 'PM' && h != 12) h += 12;
    if (ap == 'AM' && h == 12) h = 0;
    return h * 60 + mm;
  }

  List<Map<String, dynamic>> get _sortedRecs {
    final recs = (_guide?['recommendations'] as List? ?? [])
        .map((r) => Map<String, dynamic>.from(r))
        .toList();
    recs.sort((a, b) {
      final tA = a['suggested_time']?.toString() ?? '';
      final tB = b['suggested_time']?.toString() ?? '';
      if (tA.isNotEmpty && tB.isNotEmpty) {
        final cmp = _parseAmPm(tA).compareTo(_parseAmPm(tB));
        if (cmp != 0) return cmp;
      }
      const order = {'high': 0, 'medium': 1, 'low': 2};
      final pa = order[a['priority']?.toString().toLowerCase()] ?? 1;
      final pb = order[b['priority']?.toString().toLowerCase()] ?? 1;
      return pa.compareTo(pb);
    });
    return recs;
  }

  String get _prioritySummary {
    final recs = _sortedRecs;
    if (recs.isEmpty) return 'No tasks';
    final high = recs.where((r) => r['priority']?.toString().toLowerCase() == 'high').length;
    final parts = <String>['${recs.length} task${recs.length == 1 ? '' : 's'}'];
    if (high > 0) parts.add('$high high priority');
    return parts.join(' \u2022 ');
  }

  Color _priorityColor(String p) {
    switch (p.toLowerCase()) {
      case 'high': return _pMutedRose;
      case 'medium': return _pSand;
      case 'low': return _pSky;
      default: return _pSky;
    }
  }

  IconData _styleIcon(String s) {
    switch (s.toLowerCase()) {
      case 'visual': return Icons.visibility_rounded;
      case 'auditory': return Icons.hearing_rounded;
      case 'reading': return Icons.menu_book_rounded;
      case 'kinesthetic': return Icons.pan_tool_rounded;
      default: return Icons.psychology_rounded;
    }
  }

  String _styleDescription(String s) {
    switch (s.toLowerCase()) {
      case 'visual':
        return 'You learn best through diagrams, charts, videos, and spatial understanding. Try mind maps and color-coded notes.';
      case 'auditory':
        return 'You learn best by listening — lectures, discussions, and verbal explanations work great for you.';
      case 'reading':
        return 'You prefer reading and writing as your main learning channel. Textbooks and written notes are your strength.';
      case 'kinesthetic':
        return 'You learn best through hands-on experience, practice, and physical activities. Labs and projects suit you well.';
      default:
        return 'Your learning style is balanced across multiple modalities. Try mixing different study techniques.';
    }
  }

  // ── Timetable actions ─────────────────────────────────────────────────────

  Future<void> _analyzeTimetable() async {
    if (_timetableCtrl.text.trim().length < 10) return;
    HapticFeedback.mediumImpact();
    setState(() => _analyzingTimetable = true);
    try {
      final r = await ApiService.aiAnalyzeTimetable(_timetableCtrl.text.trim());
      if (mounted) setState(() {
        _timetableResult = r;
        _analyzingTimetable = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _analyzingTimetable = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Analysis failed: $e'), backgroundColor: _darken(_pMutedRose)),
        );
      }
    }
  }

  Future<void> _uploadTimetablePdf() async {
    final picker = ImagePicker();
    final result = await picker.pickMedia();
    if (result == null) return;
    if (!result.path.toLowerCase().endsWith('.pdf')) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: const Text('Please select a PDF file'), backgroundColor: _darken(_pMutedRose)),
        );
      }
      return;
    }
    HapticFeedback.lightImpact();
    setState(() {
      _analyzingTimetable = true;
      _uploadedFileName = result.name;
    });
    try {
      final data = await ApiService.aiUploadTimetablePdf(result.path);
      if (mounted) setState(() {
        _timetableResult = data;
        _analyzingTimetable = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _analyzingTimetable = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: _darken(_pMutedRose)),
        );
      }
    }
  }

  Future<void> _saveTimetable() async {
    if (_timetableResult == null) return;
    HapticFeedback.mediumImpact();
    final now = DateTime.now();
    final label = _semesterLabelCtrl.text.trim().isEmpty
        ? 'Semester ${now.month <= 6 ? 2 : 1} ${now.year}/${now.year + 1}'
        : _semesterLabelCtrl.text.trim();
    try {
      await ApiService.aiSaveTimetable({
        'parsed_schedule': _timetableResult!['schedule'] ?? [],
        'recommended_study_times': _timetableResult!['study_slots'] ?? [],
        'semester_label': label,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: const Text('Timetable saved!'), backgroundColor: _darken(_pSage)),
        );
        _semesterLabelCtrl.clear();
        _loadSavedTimetables();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e'), backgroundColor: _darken(_pMutedRose)),
        );
      }
    }
  }

  Future<void> _deleteTimetable(String id) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Timetable',
      message: 'Delete this saved timetable?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok != true) return;
    try {
      await ApiService.aiDeleteTimetable(id);
      _loadSavedTimetables();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e'), backgroundColor: _darken(_pMutedRose)),
        );
      }
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return _buildBody(context);
  }

  Widget _buildBody(BuildContext context) {
    final c = context.colors;

    if (_checkingProfile) {
      return Scaffold(
        backgroundColor: c.surface,
        appBar: _brandAppBar(c, showTabs: false),
        body: const SafeArea(child: SkeletonDetail()),
      );
    }

    if (!_hasProfile) {
      return Scaffold(
        backgroundColor: c.surface,
        appBar: _brandAppBar(c, showTabs: false),
        body: AiLearningStyleScreen(onComplete: _onProfileComplete),
      );
    }

    return Scaffold(
      backgroundColor: c.surface,
      appBar: _brandAppBar(c, showTabs: true),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildTodayTab(c),
          _buildTimetableTab(c),
          _buildProfileTab(c),
        ],
      ),
    );
  }

  PreferredSizeWidget _brandAppBar(AppColorScheme c, {required bool showTabs}) {
    return AppBar(
      toolbarHeight: 70,
      backgroundColor: Colors.transparent,
      foregroundColor: c.textPrimary,
      scrolledUnderElevation: 0,
      title: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_pLavender, _darken(_pLavender, 0.15)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Image.asset('assets/images/ai-brain-logo.png', width: 50, height: 50),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('SmartBuddy',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                if (_learningStyle != null)
                  Text(
                    '${_learningStyle![0].toUpperCase()}${_learningStyle!.substring(1)} Learner',
                    style: TextStyle(fontSize: 11, color: c.textMuted),
                  ),
              ],
            ),
          ),
        ],
      ),
      bottom: showTabs
          ? TabBar(
              controller: _tabController,
              indicatorColor: _pLavender,
              indicatorWeight: 3,
              labelColor: _darken(_pLavender, 0.2),
              unselectedLabelColor: c.textMuted,
              labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.normal, fontSize: 13),
              tabs: const [
                Tab(text: 'Today'),
                Tab(text: 'Timetable'),
                Tab(text: 'Profile'),
              ],
            )
          : null,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1 — Today
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildTodayTab(AppColorScheme c) {
    if (_loadingGuide && _guide == null) {
      return const SkeletonDetail();
    }

    return RefreshIndicator(
      onRefresh: _loadGuide,
      color: _pLavender,
      child: AnimationLimiter(
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
          children: [
            if (_guideError != null) ...[
              AnimatedListItem(
                index: 0,
                child: GlassCard(
                  borderColor: _pMutedRose.withOpacity(0.3),
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    Icon(Icons.error_outline_rounded, color: _darken(_pMutedRose), size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(_guideError!,
                        style: TextStyle(color: c.textSecondary, fontSize: 13))),
                  ]),
                ),
              ),
              const SizedBox(height: 14),
            ],

            // Greeting
            AnimatedListItem(index: 1, child: _greetingCard(c)),
            const SizedBox(height: 14),

            // Motivational
            if (_guide?['motivational_message'] != null) ...[
              AnimatedListItem(index: 2, child: _motivationalCard(c)),
              const SizedBox(height: 12),
            ],

            // Schedule summary
            if (_guide?['daily_schedule_summary'] != null) ...[
              AnimatedListItem(index: 3, child: _scheduleSummaryCard(c)),
              const SizedBox(height: 20),
            ],

            // Today's focus
            if (_sortedRecs.isNotEmpty) ...[
              AnimatedListItem(
                index: 4,
                child: const SectionHeader(
                    title: "Today's Focus", icon: Icons.track_changes_rounded),
              ),
              const SizedBox(height: 12),
              ...List.generate(_sortedRecs.length, (i) => AnimatedListItem(
                    index: 5 + i,
                    child: _recommendationCard(c, _sortedRecs[i], i),
                  )),
            ] else ...[
              AnimatedListItem(
                index: 4,
                child: const EmptyState(
                  icon: Icons.celebration_rounded,
                  title: 'All caught up!',
                  subtitle:
                      "You've completed all your study tasks for today.\nGreat work — keep the momentum going!",
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _greetingCard(AppColorScheme c) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _pLavender.withOpacity(0.18),
            _pPeriwinkle.withOpacity(0.14),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _pLavender.withOpacity(0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$_greeting!',
              style: TextStyle(
                  color: c.textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(_todayFormatted,
              style: TextStyle(color: c.textSecondary, fontSize: 13)),
          const SizedBox(height: 12),
          BadgeChip(label: _prioritySummary, color: _darken(_pLavender, 0.12)),
        ],
      ),
    );
  }

  Widget _motivationalCard(AppColorScheme c) {
    return GlassCard(
      borderColor: _pPeach.withOpacity(0.28),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _pPeach.withOpacity(0.18),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(Icons.auto_awesome_rounded,
                color: _darken(_pPeach, 0.14), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _guide!['motivational_message'].toString(),
              style: TextStyle(
                  color: c.textPrimary, fontSize: 14, height: 1.45, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  Widget _scheduleSummaryCard(AppColorScheme c) {
    return GlassCard(
      borderColor: _pSky.withOpacity(0.28),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _pSky.withOpacity(0.18),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(Icons.schedule_rounded,
                color: _darken(_pSky, 0.14), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(_guide!['daily_schedule_summary'].toString(),
                style: TextStyle(color: c.textPrimary, fontSize: 13, height: 1.4)),
          ),
        ],
      ),
    );
  }

  Widget _recommendationCard(AppColorScheme c, Map<String, dynamic> rec, int index) {
    final priority = (rec['priority'] ?? 'medium').toString();
    final pColor = _priorityColor(priority);
    final isExpanded = _expandedRecs.contains(index);
    final suggestedTime = (rec['suggested_time'] ?? '').toString();
    final course = (rec['course'] ?? '').toString();
    final topic = (rec['topic'] ?? '').toString();
    final reason = (rec['reason'] ?? '').toString();
    final estTime = (rec['estimated_time'] ?? '').toString();

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() {
          if (isExpanded) {
            _expandedRecs.remove(index);
          } else {
            _expandedRecs.add(index);
          }
        });
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: c.surfaceCard.withOpacity(context.isDark ? 0.6 : 1.0),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 5, color: _darken(pColor, 0.1)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (course.isNotEmpty)
                        Text(course,
                            style: TextStyle(
                                color: _darken(_pLavender, 0.18),
                                fontSize: 12,
                                fontWeight: FontWeight.w600)),
                      if (course.isNotEmpty) const SizedBox(height: 4),
                      Text(topic,
                          style: TextStyle(
                              color: c.textPrimary,
                              fontSize: 15,
                              fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      if (suggestedTime.isNotEmpty) ...[
                        BadgeChip(label: suggestedTime, color: _darken(_pSky, 0.12)),
                        const SizedBox(height: 6),
                      ],
                      if (reason.isNotEmpty)
                        AnimatedCrossFade(
                          duration: const Duration(milliseconds: 200),
                          crossFadeState: isExpanded
                              ? CrossFadeState.showSecond
                              : CrossFadeState.showFirst,
                          firstChild: Text(reason,
                              style: TextStyle(
                                  color: c.textSecondary, fontSize: 13, height: 1.4),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
                          secondChild: Text(reason,
                              style: TextStyle(
                                  color: c.textSecondary, fontSize: 13, height: 1.4)),
                        ),
                      const SizedBox(height: 8),
                      Row(children: [
                        if (estTime.isNotEmpty) ...[
                          Icon(Icons.schedule_rounded, color: c.textMuted, size: 14),
                          const SizedBox(width: 4),
                          Text(estTime,
                              style: TextStyle(color: c.textMuted, fontSize: 12)),
                        ],
                        const Spacer(),
                        BadgeChip(
                            label: priority.toUpperCase(),
                            color: _darken(pColor, 0.15)),
                      ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2 — Timetable
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildTimetableTab(AppColorScheme c) {
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      children: [
        // Upload PDF
        _uploadPdfCard(c),
        const SizedBox(height: 14),

        Row(children: [
          Expanded(child: Divider(color: c.divider)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text('or paste text',
                style: TextStyle(color: c.textMuted, fontSize: 12)),
          ),
          Expanded(child: Divider(color: c.divider)),
        ]),
        const SizedBox(height: 14),

        TextField(
          controller: _timetableCtrl,
          maxLines: 6,
          style: TextStyle(color: c.textPrimary, fontSize: 13),
          decoration: AppTheme.inputDecoration(context,
                  label: 'Paste your timetable here...',
                  prefixIcon: Icons.text_snippet_rounded)
              .copyWith(
            hintText:
                'e.g.\nMonday 8am-10am: Mathematics\nMonday 2pm-4pm: Science',
            hintStyle: TextStyle(color: c.textMuted),
            prefixIcon: null,
          ),
        ),
        const SizedBox(height: 12),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _analyzingTimetable ? null : _analyzeTimetable,
            icon: _analyzingTimetable
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.analytics_rounded, size: 18),
            label: Text(_analyzingTimetable ? 'Analyzing...' : 'Analyze'),
            style: ElevatedButton.styleFrom(
              backgroundColor: _darken(_pLavender, 0.08),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),

        if (_analyzingTimetable && _timetableResult == null)
          Padding(
            padding: const EdgeInsets.only(top: 28),
            child: Column(children: [
              const CircularProgressIndicator(color: _pLavender),
              const SizedBox(height: 12),
              Text('Analyzing your timetable...',
                  style: TextStyle(color: c.textSecondary, fontSize: 13)),
            ]),
          ),

        if (_timetableResult != null) ...[
          const SizedBox(height: 22),
          _timetableResults(c),
          const SizedBox(height: 14),
          _saveTimetableSection(c),
        ],

        // Saved timetables section
        const SizedBox(height: 28),
        _savedTimetablesSection(c),
      ],
    );
  }

  Widget _uploadPdfCard(AppColorScheme c) {
    return GestureDetector(
      onTap: _analyzingTimetable ? null : _uploadTimetablePdf,
      child: GlassCard(
        borderColor: _pLavender.withOpacity(0.3),
        padding: const EdgeInsets.all(18),
        child: Row(children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _pLavender.withOpacity(0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.upload_file_rounded,
                color: _darken(_pLavender, 0.15), size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Upload Timetable PDF',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15)),
                const SizedBox(height: 2),
                Text(
                  _uploadedFileName ?? 'AI will read and suggest amendments',
                  style: TextStyle(
                    color: _uploadedFileName != null
                        ? _darken(_pSage, 0.15)
                        : c.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.picture_as_pdf_rounded,
              color: _pMutedRose.withOpacity(0.6), size: 28),
        ]),
      ),
    );
  }

  Widget _saveTimetableSection(AppColorScheme c) {
    return GlassCard(
      borderColor: _pSage.withOpacity(0.3),
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: _pSage.withOpacity(0.18),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(Icons.save_rounded,
                color: _darken(_pSage, 0.18), size: 16),
          ),
          const SizedBox(width: 10),
          Text('Save Timetable',
              style: TextStyle(
                  color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.bold)),
        ]),
        const SizedBox(height: 10),
        TextField(
          controller: _semesterLabelCtrl,
          style: TextStyle(color: c.textPrimary, fontSize: 13),
          decoration: AppTheme.inputDecoration(context,
              label: 'Semester label (e.g. Semester 2 2025/2026)',
              prefixIcon: Icons.label_rounded),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _saveTimetable,
            icon: const Icon(Icons.save_rounded, size: 18),
            label: const Text('Save to My Timetables'),
            style: ElevatedButton.styleFrom(
              backgroundColor: _darken(_pSage, 0.1),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _timetableResults(AppColorScheme c) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if ((_timetableResult!['schedule'] as List?)?.isNotEmpty == true) ...[
        const SectionHeader(
            title: 'Parsed Schedule', icon: Icons.calendar_today_rounded),
        const SizedBox(height: 10),
        ...(_timetableResult!['schedule'] as List).map((entry) {
          final e = Map<String, dynamic>.from(entry);
          final day = e['day']?.toString() ?? '';
          final slots = (e['slots'] as List?) ?? [];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(day,
                    style: TextStyle(
                        color: _darken(_pLavender, 0.2),
                        fontSize: 14,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ...slots.map((slot) {
                  final s = slot is Map
                      ? Map<String, dynamic>.from(slot)
                      : <String, dynamic>{'text': slot.toString()};
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _darken(_pLavender, 0.15)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          s['time'] != null
                              ? '${s['time']} — ${s['subject'] ?? s['text'] ?? ''}'
                              : s['text']?.toString() ?? slot.toString(),
                          style: TextStyle(color: c.textSecondary, fontSize: 13),
                        ),
                      ),
                    ]),
                  );
                }),
              ]),
            ),
          );
        }),
        const SizedBox(height: 8),
      ],
      if ((_timetableResult!['study_slots'] as List?)?.isNotEmpty == true) ...[
        const SectionHeader(title: 'Study Slots', icon: Icons.schedule_rounded),
        const SizedBox(height: 10),
        SizedBox(
          height: 90,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: (_timetableResult!['study_slots'] as List).length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final s = Map<String, dynamic>.from(
                  (_timetableResult!['study_slots'] as List)[i]);
              return Container(
                width: 170,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _pSage.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _pSage.withOpacity(0.28)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Row(children: [
                      Icon(Icons.schedule_rounded,
                          color: _darken(_pSage, 0.18), size: 16),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          '${s['day'] ?? ''} ${s['time'] ?? ''}',
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ]),
                    const SizedBox(height: 6),
                    Text(
                      s['suggestion']?.toString() ?? '',
                      style: TextStyle(color: c.textSecondary, fontSize: 11),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
      ],
      if ((_timetableResult!['issues'] as List?)?.isNotEmpty == true) ...[
        const SectionHeader(title: 'Issues Found', icon: Icons.warning_rounded),
        const SizedBox(height: 10),
        ...(_timetableResult!['issues'] as List).map((issue) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GlassCard(
                borderColor: _pMutedRose.withOpacity(0.28),
                padding: const EdgeInsets.all(12),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.warning_rounded,
                      color: _darken(_pMutedRose, 0.15), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(issue.toString(),
                          style: TextStyle(color: c.textPrimary, fontSize: 13))),
                ]),
              ),
            )),
        const SizedBox(height: 12),
      ],
      if ((_timetableResult!['amendments'] as List?)?.isNotEmpty == true) ...[
        const SectionHeader(
            title: 'Suggested Amendments', icon: Icons.edit_note_rounded),
        const SizedBox(height: 10),
        ...(_timetableResult!['amendments'] as List).map((a) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GlassCard(
                padding: const EdgeInsets.all(12),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.edit_note_rounded,
                      color: _darken(_pLavender, 0.2), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(a.toString(),
                          style: TextStyle(color: c.textPrimary, fontSize: 13))),
                ]),
              ),
            )),
        const SizedBox(height: 12),
      ],
      if ((_timetableResult!['suggestions'] as List?)?.isNotEmpty == true) ...[
        const SectionHeader(title: 'Tips', icon: Icons.lightbulb_rounded),
        const SizedBox(height: 10),
        ...(_timetableResult!['suggestions'] as List).map((tip) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(Icons.lightbulb_rounded,
                    color: _darken(_pSand, 0.2), size: 18),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(tip.toString(),
                        style: TextStyle(
                            color: c.textSecondary, fontSize: 13, height: 1.4))),
              ]),
            )),
      ],
    ]);
  }

  Widget _savedTimetablesSection(AppColorScheme c) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionHeader(
          title: 'Saved Timetables', icon: Icons.folder_rounded),
      const SizedBox(height: 10),
      if (_loadingSaved)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: SkeletonList(itemCount: 3, padding: EdgeInsets.zero),
        )
      else if (_savedTimetables.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: GlassCard(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Icon(Icons.calendar_today_rounded, color: c.textMuted, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'No saved timetables yet. Analyze and save one to see it here.',
                  style: TextStyle(color: c.textSecondary, fontSize: 13),
                ),
              ),
            ]),
          ),
        )
      else
        ...List.generate(_savedTimetables.length, (i) {
          final tt = _savedTimetables[i];
          final label = tt['semester_label']?.toString() ?? 'Timetable ${i + 1}';
          final createdAt = tt['created_at']?.toString() ?? '';
          final schedule = (tt['parsed_schedule'] as List?) ?? [];
          final studyTimes = (tt['recommended_study_times'] as List?) ?? [];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassCard(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _pSky.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Icon(Icons.table_chart_rounded,
                        color: _darken(_pSky, 0.18), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(label,
                        style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.bold)),
                  ),
                  GestureDetector(
                    onTap: () => _deleteTimetable(tt['id']?.toString() ?? ''),
                    child: Icon(Icons.delete_outline_rounded,
                        size: 20, color: c.textMuted),
                  ),
                ]),
                if (createdAt.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text('Saved: ${createdAt.substring(0, 10)}',
                      style: TextStyle(color: c.textMuted, fontSize: 11)),
                ],
                const SizedBox(height: 8),
                Row(children: [
                  BadgeChip(
                      label: '${schedule.length} days',
                      color: _darken(_pSky, 0.15)),
                  const SizedBox(width: 8),
                  BadgeChip(
                      label: '${studyTimes.length} study slots',
                      color: _darken(_pSage, 0.15)),
                ]),
              ]),
            ),
          );
        }),
    ]);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 3 — Profile
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildProfileTab(AppColorScheme c) {
    return AnimationLimiter(
      child: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
        children: [
          // Learning style hero
          AnimatedListItem(index: 0, child: _learningStyleCard(c)),

          if (_strengths.isNotEmpty) ...[
            const SizedBox(height: 12),
            AnimatedListItem(
              index: 1,
              child: _chipSection(c,
                  title: 'Strengths',
                  icon: Icons.trending_up_rounded,
                  iconColor: _darken(_pSage, 0.15),
                  items: _strengths,
                  chipColor: _darken(_pSage, 0.15)),
            ),
          ],

          if (_weaknesses.isNotEmpty) ...[
            const SizedBox(height: 12),
            AnimatedListItem(
              index: 2,
              child: _chipSection(c,
                  title: 'Areas to Improve',
                  icon: Icons.flag_rounded,
                  iconColor: _darken(_pMutedRose, 0.1),
                  items: _weaknesses,
                  chipColor: _darken(_pMutedRose, 0.1)),
            ),
          ],

          const SizedBox(height: 24),
          Center(
            child: TextButton.icon(
              onPressed: _retakeAssessment,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retake Learning Style Assessment'),
              style: TextButton.styleFrom(
                foregroundColor: _darken(_pLavender, 0.2),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _learningStyleCard(AppColorScheme c) {
    final style = _learningStyle ?? 'balanced';
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _pLavender.withOpacity(0.18),
            _pPeriwinkle.withOpacity(0.12),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _pLavender.withOpacity(0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: _pLavender.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_styleIcon(style),
                  color: _darken(_pLavender, 0.2), size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Learning Style',
                      style: TextStyle(color: c.textMuted, fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    '${style[0].toUpperCase()}${style.substring(1)} Learner',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 17,
                        fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 12),
          Text(_styleDescription(style),
              style: TextStyle(color: c.textSecondary, fontSize: 13, height: 1.5)),
        ],
      ),
    );
  }

  Widget _chipSection(AppColorScheme c,
      {required String title,
      required IconData icon,
      required Color iconColor,
      required List<String> items,
      required Color chipColor}) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, color: iconColor, size: 18),
          const SizedBox(width: 8),
          Text(title,
              style: TextStyle(
                  color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children:
              items.map((it) => BadgeChip(label: it, color: chipColor)).toList(),
        ),
      ]),
    );
  }
}
