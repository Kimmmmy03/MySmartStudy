import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme_ext.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/section_header.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/skeletons.dart';

// ── Feature meta ──────────────────────────────────────────────────────────────
const _features = [
  'companion',
  'study_materials',
  'study_plan',
  'grading',
  'plagiarism',
  'mindmap_buddy',
  'import',
  'images',
];

const _featureLabels = {
  'companion': 'Companion',
  'study_materials': 'Study Materials',
  'study_plan': 'Study Plan',
  'grading': 'Grading',
  'plagiarism': 'Plagiarism',
  'mindmap_buddy': 'Mind Map Buddy',
  'import': 'Import',
  'images': 'Images',
};

const _featureColors = {
  'companion': AppColors.blue,
  'study_materials': AppColors.purple,
  'study_plan': AppColors.cyan,
  'grading': AppColors.amber,
  'plagiarism': Color(0xFFf87171),
  'mindmap_buddy': AppColors.emerald,
  'import': AppColors.pink,
  'images': Color(0xFFfb923c),
};

// ── Screen ────────────────────────────────────────────────────────────────────
class AiUsageScreen extends StatefulWidget {
  const AiUsageScreen({super.key});
  @override
  State<AiUsageScreen> createState() => _AiUsageScreenState();
}

class _AiUsageScreenState extends State<AiUsageScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _usage = [];
  Map<String, dynamic> _summary = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.adminGetAiUsage();
      if (mounted) {
        setState(() {
          _usage = List.from(data['usage'] ?? []);
          _summary = Map<String, dynamic>.from(data['summary'] ?? {});
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  // ── Top feature label ──────────────────────────────────────────────────────
  String _topFeature() {
    if (_summary.isEmpty) return '—';
    final byFeature = _summary['by_feature'] as Map? ?? {};
    if (byFeature.isEmpty) return '—';
    String top = byFeature.keys.first;
    int topVal = (byFeature[top] ?? 0) as int;
    for (final k in byFeature.keys) {
      final v = (byFeature[k] ?? 0) as int;
      if (v > topVal) { top = k; topVal = v; }
    }
    return _featureLabels[top] ?? top;
  }

  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('AI Token Usage', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: c.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const SkeletonDetail()
          : _error != null
              ? _buildError(c)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.blue,
                  child: AnimationLimiter(
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics()),
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                      children: [
                        AnimatedListItem(index: 0, child: _buildSummaryCards(c)),
                        const SizedBox(height: 20),
                        AnimatedListItem(
                          index: 1,
                          child: const SectionHeader(title: 'Combined Feature Breakdown'),
                        ),
                        const SizedBox(height: 8),
                        AnimatedListItem(index: 2, child: _buildGlobalFeatureBar(c)),
                        const SizedBox(height: 4),
                        AnimatedListItem(index: 3, child: _buildLegend(c)),
                        const SizedBox(height: 20),
                        AnimatedListItem(
                          index: 4,
                          child: const SectionHeader(title: 'Per-User Usage'),
                        ),
                        const SizedBox(height: 8),
                        if (_usage.isEmpty)
                          AnimatedListItem(
                            index: 5,
                            child: _buildEmpty(c),
                          )
                        else
                          ...List.generate(_usage.length, (i) => AnimatedListItem(
                            index: 5 + i,
                            child: _UserRow(
                              record: Map<String, dynamic>.from(_usage[i]),
                              onQuotaSaved: _load,
                            ),
                          )),
                      ],
                    ),
                  ),
                ),
    );
  }

  // ── Summary cards ─────────────────────────────────────────────────────────
  Widget _buildSummaryCards(AppColorScheme c) {
    final totalTokens = (_summary['total_tokens'] ?? 0) as int;
    final totalCalls = (_summary['total_calls'] ?? 0) as int;
    final activeUsers = _usage.length;

    return Column(children: [
      Row(children: [
        Expanded(child: _SummaryCard(
          label: 'Total Tokens',
          value: _fmt(totalTokens),
          icon: Icons.token_rounded,
          color: AppColors.blue,
        )),
        const SizedBox(width: 10),
        Expanded(child: _SummaryCard(
          label: 'Total Calls',
          value: _fmt(totalCalls),
          icon: Icons.bolt_rounded,
          color: AppColors.purple,
        )),
      ]),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: _SummaryCard(
          label: 'Top Feature',
          value: _topFeature(),
          icon: Icons.star_rounded,
          color: AppColors.amber,
          small: true,
        )),
        const SizedBox(width: 10),
        Expanded(child: _SummaryCard(
          label: 'Active Users',
          value: '$activeUsers',
          icon: Icons.people_rounded,
          color: AppColors.emerald,
        )),
      ]),
    ]);
  }

  // ── Global stacked bar ─────────────────────────────────────────────────────
  Widget _buildGlobalFeatureBar(AppColorScheme c) {
    final byFeature = (_summary['by_feature'] as Map?) ?? {};
    final total = _features.fold<int>(
        0, (s, f) => s + ((byFeature[f] ?? 0) as int));

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: SizedBox(
            height: 18,
            child: total == 0
                ? Container(color: Colors.white.withOpacity(0.06))
                : Row(children: _features.map((f) {
                    final v = (byFeature[f] ?? 0) as int;
                    final frac = v / total;
                    if (frac <= 0) return const SizedBox.shrink();
                    return Flexible(
                      flex: (frac * 1000).round(),
                      child: Tooltip(
                        message: '${_featureLabels[f]}: ${_fmt(v)} tokens (${(frac * 100).toStringAsFixed(1)}%)',
                        child: Container(color: _featureColors[f]),
                      ),
                    );
                  }).toList()),
          ),
        ),
      ]),
    );
  }

  // ── Legend ─────────────────────────────────────────────────────────────────
  Widget _buildLegend(AppColorScheme c) {
    return Wrap(
      spacing: 10,
      runSpacing: 6,
      children: _features.map((f) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(
            color: _featureColors[f], borderRadius: BorderRadius.circular(2),
          )),
          const SizedBox(width: 5),
          Text(_featureLabels[f]!, style: TextStyle(color: c.textSecondary, fontSize: 11)),
        ],
      )).toList(),
    );
  }

  Widget _buildEmpty(AppColorScheme c) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 40),
    child: Center(
      child: Column(children: [
        Icon(Icons.bar_chart_rounded, color: c.textMuted, size: 48),
        const SizedBox(height: 12),
        Text('No AI activity recorded yet.', style: TextStyle(color: c.textSecondary)),
        const SizedBox(height: 4),
        Text('Usage is tracked automatically when AI features are used.',
            style: TextStyle(color: c.textMuted, fontSize: 12), textAlign: TextAlign.center),
      ]),
    ),
  );

  Widget _buildError(AppColorScheme c) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.error_outline_rounded, color: c.textMuted, size: 40),
        const SizedBox(height: 12),
        Text('Failed to load usage data', style: TextStyle(color: c.textSecondary)),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: _load, child: const Text('Retry')),
      ]),
    ),
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
class _SummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool small;
  const _SummaryCard({
    required this.label, required this.value,
    required this.icon, required this.color, this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(
            color: c.textPrimary, fontWeight: FontWeight.bold,
            fontSize: small ? 13 : 16,
          ), maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(label, style: TextStyle(color: c.textSecondary, fontSize: 11)),
        ])),
      ]),
    );
  }
}

// ── Per-user row ──────────────────────────────────────────────────────────────
class _UserRow extends StatefulWidget {
  final Map<String, dynamic> record;
  final VoidCallback onQuotaSaved;
  const _UserRow({required this.record, required this.onQuotaSaved});
  @override
  State<_UserRow> createState() => _UserRowState();
}

class _UserRowState extends State<_UserRow> {
  bool _editingQuota = false;
  late TextEditingController _quotaCtrl;
  bool _savingQuota = false;

  @override
  void initState() {
    super.initState();
    final q = widget.record['imageQuotaLimit'];
    _quotaCtrl = TextEditingController(text: q != null ? '$q' : '');
  }

  @override
  void dispose() {
    _quotaCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveQuota() async {
    final text = _quotaCtrl.text.trim();
    final int? val = text.isEmpty ? null : int.tryParse(text);
    setState(() => _savingQuota = true);
    try {
      await ApiService.adminSetUserImageQuota(widget.record['userId'] as String, val);
      if (mounted) {
        setState(() { _editingQuota = false; _savingQuota = false; });
        widget.onQuotaSaved();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _savingQuota = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final record = widget.record;
    final displayName = record['displayName'] as String? ?? 'Unknown';
    final email = record['email'] as String? ?? '';
    final totalTokens = (record['total_tokens'] ?? 0) as int;
    final totalCalls = (record['total_calls'] ?? 0) as int;
    final quotaLimit = record['imageQuotaLimit'];

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Header row
          Row(children: [
            // Avatar circle
            Container(
              width: 38, height: 38,
              decoration: BoxDecoration(
                color: AppColors.blue.withOpacity(0.18),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                  style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(displayName, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(email, style: TextStyle(color: c.textSecondary, fontSize: 11),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ])),
            // Token + call counts
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(_fmt(totalTokens), style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
              Text('${_fmt(totalCalls)} calls', style: TextStyle(color: c.textSecondary, fontSize: 11)),
            ]),
          ]),

          const SizedBox(height: 10),

          // Feature breakdown bar
          _FeatureBar(record: record, totalTokens: totalTokens),

          const SizedBox(height: 10),

          // Image quota row
          Row(children: [
            Icon(Icons.image_rounded, size: 14, color: c.textSecondary),
            const SizedBox(width: 6),
            Text('Image Quota: ', style: TextStyle(color: c.textSecondary, fontSize: 12)),
            if (!_editingQuota) ...[
              Text(
                quotaLimit != null ? '$quotaLimit/day' : 'Default (3/day)',
                style: TextStyle(
                  color: quotaLimit != null ? AppColors.amber : c.textMuted,
                  fontWeight: quotaLimit != null ? FontWeight.w600 : FontWeight.normal,
                  fontSize: 12,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => setState(() => _editingQuota = true),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.blue.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('Edit', style: TextStyle(color: AppColors.blue, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ),
            ] else ...[
              Expanded(
                child: Row(children: [
                  Expanded(
                    child: SizedBox(
                      height: 32,
                      child: TextField(
                        controller: _quotaCtrl,
                        keyboardType: TextInputType.number,
                        style: TextStyle(color: c.textPrimary, fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'blank = default',
                          hintStyle: TextStyle(color: c.textMuted, fontSize: 12),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          isDense: true,
                          filled: true,
                          fillColor: c.surface.withOpacity(0.5),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(color: AppColors.blue.withOpacity(0.3)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(color: AppColors.blue.withOpacity(0.2)),
                          ),
                        ),
                        onSubmitted: (_) => _saveQuota(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  _savingQuota
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.blue))
                      : GestureDetector(
                          onTap: _saveQuota,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.emerald.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Icon(Icons.check_rounded, color: AppColors.emerald, size: 16),
                          ),
                        ),
                  const SizedBox(width: 4),
                  GestureDetector(
                    onTap: () => setState(() => _editingQuota = false),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(Icons.close_rounded, color: c.textMuted, size: 16),
                    ),
                  ),
                ]),
              ),
            ],
          ]),
        ]),
      ),
    );
  }
}

// ── Per-user feature breakdown bar ────────────────────────────────────────────
class _FeatureBar extends StatelessWidget {
  final Map<String, dynamic> record;
  final int totalTokens;
  const _FeatureBar({required this.record, required this.totalTokens});

  String _fmt(int n) {
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  @override
  Widget build(BuildContext context) {
    if (totalTokens == 0) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: Container(height: 8, color: Colors.white.withOpacity(0.06)),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: SizedBox(
        height: 8,
        child: Row(
          children: _features.map((f) {
            final v = (record['${f}_tokens'] ?? 0) as int;
            final frac = v / totalTokens;
            if (frac <= 0) return const SizedBox.shrink();
            return Flexible(
              flex: (frac * 1000).round(),
              child: Tooltip(
                message: '${_featureLabels[f]}: ${_fmt(v)} tokens (${(frac * 100).toStringAsFixed(1)}%)',
                child: Container(color: _featureColors[f]),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
