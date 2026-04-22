import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';

// ── Sunrise pastel palette (shared with SmartBuddy / lecturer screens) ──
const _pLavender  = Color(0xFFBFA8D9);
const _pSky       = Color(0xFFA9C9E8);
const _pSage      = Color(0xFFA8C9A8);
const _pSand      = Color(0xFFF5D79E);
const _pMutedRose = Color(0xFFE89988);

// Synced with web (QUICK_WINS / STRUGGLES) so reflection notes parse the same
// way on both ends.
const _kWins = <_ChipOption>[
  _ChipOption('Completed all assignments', Icons.menu_book_rounded),
  _ChipOption('Studied with classmates',    Icons.groups_rounded),
  _ChipOption('Created mind maps',          Icons.psychology_rounded),
  _ChipOption('Managed my time well',       Icons.schedule_rounded),
  _ChipOption('Learned something new',      Icons.auto_awesome_rounded),
];

const _kStruggles = <String>[
  'Felt overwhelmed with workload',
  'Hard to stay focused',
  "Didn't understand some topics",
  'Missed some deadlines',
  'Needed more help from lecturer',
];

const _kConfidenceLabels = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
const _kConfidenceColors = [_pMutedRose, _pMutedRose, _pSand, _pSage, _pSage];

class _ChipOption {
  final String label;
  final IconData icon;
  const _ChipOption(this.label, this.icon);
}

class WeeklyReflectionModal extends StatefulWidget {
  const WeeklyReflectionModal({super.key});

  static Future<bool?> show(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const WeeklyReflectionModal(),
    );
  }

  @override
  State<WeeklyReflectionModal> createState() => _WeeklyReflectionModalState();
}

class _WeeklyReflectionModalState extends State<WeeklyReflectionModal> {
  int _confidence = 3;
  final _notesCtrl = TextEditingController();
  final Set<String> _wins = {};
  final Set<String> _struggles = {};
  bool _submitting = false;

  List<Map<String, dynamic>> _history = [];
  bool _historyLoading = true;
  bool _historyExpanded = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    try {
      final rows = await ApiService.getReflections(limit: 3);
      if (!mounted) return;
      setState(() {
        _history = rows.map((r) => Map<String, dynamic>.from(r as Map)).toList();
        _historyLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  String _buildNotes() {
    final parts = <String>[];
    if (_wins.isNotEmpty) parts.add('Wins: ${_wins.join(', ')}');
    if (_struggles.isNotEmpty) parts.add('Challenges: ${_struggles.join(', ')}');
    final extra = _notesCtrl.text.trim();
    if (extra.isNotEmpty) parts.add(extra);
    return parts.join(' | ');
  }

  Future<void> _submit() async {
    HapticFeedback.mediumImpact();
    setState(() => _submitting = true);
    try {
      await ApiService.createReflection({
        'confidence': _confidence,
        'notes': _buildNotes(),
        'week_label': '',
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save: $e'),
            backgroundColor: _pMutedRose,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.55,
      maxChildSize: 0.96,
      expand: false,
      builder: (_, scrollController) => Container(
        decoration: BoxDecoration(
          color: c.surfaceCard,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          border: Border(top: BorderSide(color: c.border)),
        ),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: c.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            _header(c),
            const SizedBox(height: 22),
            _sectionLabel(c, 'Confidence Level'),
            const SizedBox(height: 10),
            _confidenceRow(),
            const SizedBox(height: 6),
            Center(
              child: Text(
                _kConfidenceLabels[_confidence - 1],
                style: TextStyle(
                  color: _kConfidenceColors[_confidence - 1],
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(height: 22),
            _sectionLabel(c, 'What went well?'),
            const SizedBox(height: 10),
            _winsChips(c),
            const SizedBox(height: 22),
            _sectionLabel(c, 'Any challenges?'),
            const SizedBox(height: 10),
            _struggleChips(c),
            const SizedBox(height: 22),
            _sectionLabel(c, 'Anything else? (optional)'),
            const SizedBox(height: 10),
            _notesField(c),
            const SizedBox(height: 22),
            _historySection(c),
            const SizedBox(height: 20),
            _submitButton(),
          ],
        ),
      ),
    );
  }

  // ── Header ──
  Widget _header(dynamic c) {
    return Row(
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_pSand, _pMutedRose],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: _pSand.withValues(alpha: 0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Icon(Icons.star_rounded, color: Colors.white, size: 26),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Weekly Reflection',
                style: TextStyle(
                  color: c.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 17,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'How was your learning this week?',
                style: TextStyle(color: c.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.close_rounded, color: c.textMuted),
          splashRadius: 20,
        ),
      ],
    );
  }

  Widget _sectionLabel(dynamic c, String text) => Text(
        text.toUpperCase(),
        style: TextStyle(
          color: c.textMuted,
          fontWeight: FontWeight.w600,
          fontSize: 11,
          letterSpacing: 0.8,
        ),
      );

  // ── Confidence stars ──
  Widget _confidenceRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(5, (i) {
        final n = i + 1;
        final filled = n <= _confidence;
        return GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() => _confidence = n);
          },
          behavior: HitTestBehavior.opaque,
          child: AnimatedScale(
            scale: filled ? 1.0 : 0.9,
            duration: const Duration(milliseconds: 150),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Icon(
                filled ? Icons.star_rounded : Icons.star_outline_rounded,
                size: 38,
                color: filled ? _pSand : const Color(0xFF5C6590),
                shadows: filled
                    ? [BoxShadow(color: _pSand.withValues(alpha: 0.5), blurRadius: 10)]
                    : null,
              ),
            ),
          ),
        );
      }),
    );
  }

  // ── Wins chips ──
  Widget _winsChips(dynamic c) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _kWins.map((w) {
        final active = _wins.contains(w.label);
        return _chip(
          c: c,
          label: w.label,
          icon: w.icon,
          active: active,
          activeColor: _pSage,
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() {
              if (active) {
                _wins.remove(w.label);
              } else {
                _wins.add(w.label);
              }
            });
          },
        );
      }).toList(),
    );
  }

  Widget _struggleChips(dynamic c) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _kStruggles.map((s) {
        final active = _struggles.contains(s);
        return _chip(
          c: c,
          label: s,
          active: active,
          activeColor: _pMutedRose,
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() {
              if (active) {
                _struggles.remove(s);
              } else {
                _struggles.add(s);
              }
            });
          },
        );
      }).toList(),
    );
  }

  Widget _chip({
    required dynamic c,
    required String label,
    IconData? icon,
    required bool active,
    required Color activeColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active
              ? activeColor.withValues(alpha: 0.18)
              : c.surfaceInput,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? activeColor.withValues(alpha: 0.6) : c.border,
            width: active ? 1.3 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: active ? activeColor : c.textMuted),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                color: active ? activeColor : c.textSecondary,
                fontSize: 12,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Notes field ──
  Widget _notesField(dynamic c) {
    return TextField(
      controller: _notesCtrl,
      maxLines: 3,
      style: TextStyle(color: c.textPrimary, fontSize: 13),
      decoration: InputDecoration(
        hintText: 'Share your thoughts...',
        hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
        filled: true,
        fillColor: c.surfaceInput,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: _pLavender, width: 1.3),
        ),
        contentPadding: const EdgeInsets.all(14),
      ),
    );
  }

  // ── History section ──
  Widget _historySection(dynamic c) {
    if (_historyLoading) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: c.textMuted),
            ),
            const SizedBox(width: 10),
            Text(
              'Loading history…',
              style: TextStyle(color: c.textMuted, fontSize: 12),
            ),
          ],
        ),
      );
    }
    if (_history.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: c.surfaceInput,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _historyExpanded = !_historyExpanded);
            },
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: _pSky.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.history_rounded, color: _pSky, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Recent reflections',
                          style: TextStyle(
                            color: c.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        Text(
                          '${_history.length} saved',
                          style: TextStyle(color: c.textMuted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _historyExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.expand_more_rounded, color: c.textMuted),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            child: _historyExpanded
                ? Column(
                    children: _history
                        .map((r) => _historyEntry(c, r))
                        .toList(),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _historyEntry(dynamic c, Map<String, dynamic> r) {
    final confidence = (r['confidence'] as num?)?.toInt() ?? 0;
    final notes = (r['notes'] as String?)?.trim() ?? '';
    final weekLabel = (r['week_label'] as String?) ?? '';
    final shortNotes = notes.length > 120 ? '${notes.substring(0, 120)}…' : notes;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: c.divider)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  weekLabel.isNotEmpty ? weekLabel : 'Reflection',
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(5, (i) {
                  return Icon(
                    i < confidence ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 12,
                    color: i < confidence ? _pSand : c.textMuted,
                  );
                }),
              ),
            ],
          ),
          if (shortNotes.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              shortNotes,
              style: TextStyle(color: c.textMuted, fontSize: 12, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }

  // ── Submit ──
  Widget _submitButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton.icon(
        onPressed: _submitting ? null : _submit,
        icon: _submitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.send_rounded, size: 18),
        label: Text(
          _submitting ? 'Submitting…' : 'Submit Reflection',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: _pLavender,
          foregroundColor: Colors.white,
          disabledBackgroundColor: _pLavender.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
          shadowColor: _pLavender.withValues(alpha: 0.4),
        ),
      ),
    );
  }
}
