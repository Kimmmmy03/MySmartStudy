import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_bottom_sheet.dart';

// ─── Shared pastel palette ──────────────────────────────────────────────
const _pSlate    = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam  = Color(0xFF7BB5B0);
const _pPeach    = Color(0xFFD8A28E);
const _pSand     = Color(0xFFC9A86A);
const _pRose     = Color(0xFFC99999);

Color _darken(Color c, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(c);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

/// Present the assignment create/edit form as a glass bottom sheet.
/// Returns `true` if the form was saved successfully, `null`/`false` otherwise.
Future<bool?> showAssignmentFormSheet({
  required BuildContext context,
  required String courseId,
  Map<String, dynamic>? existingAssignment,
}) {
  return showGlassBottomSheet<bool>(
    context: context,
    builder: (ctx) => AssignmentFormSheet(
      courseId: courseId,
      existingAssignment: existingAssignment,
    ),
  );
}

/// Legacy wrapper — if this screen is still pushed as a full page somewhere,
/// it renders the sheet content inside a Scaffold.
class AssignmentFormScreen extends StatelessWidget {
  final String courseId;
  final Map<String, dynamic>? existingAssignment;
  const AssignmentFormScreen({
    super.key,
    required this.courseId,
    this.existingAssignment,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: c.textPrimary,
        title: Text(
          existingAssignment == null ? 'New Assignment' : 'Edit Assignment',
          style: TextStyle(
            color: c.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: AssignmentFormSheet(
        courseId: courseId,
        existingAssignment: existingAssignment,
        embedded: true,
      ),
    );
  }
}

class AssignmentFormSheet extends StatefulWidget {
  final String courseId;
  final Map<String, dynamic>? existingAssignment;
  /// When embedded in a normal page (not a bottom sheet), hide the drag
  /// handle / sheet chrome.
  final bool embedded;

  const AssignmentFormSheet({
    super.key,
    required this.courseId,
    this.existingAssignment,
    this.embedded = false,
  });

  @override
  State<AssignmentFormSheet> createState() => _AssignmentFormSheetState();
}

class _AssignmentFormSheetState extends State<AssignmentFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleCtrl;
  late final TextEditingController _descCtrl;
  final _titleFocus = FocusNode();
  final _descFocus = FocusNode();
  DateTime? _deadline;
  bool _loading = false;
  String? _deadlineError;
  bool _peerReviewEnabled = false;

  bool get _isEdit => widget.existingAssignment != null;

  @override
  void initState() {
    super.initState();
    final a = widget.existingAssignment;
    _titleCtrl = TextEditingController(text: a?['title']?.toString() ?? '');
    _descCtrl =
        TextEditingController(text: a?['description']?.toString() ?? '');
    if (a?['deadline'] != null) {
      _deadline = DateTime.tryParse(a!['deadline'].toString());
    }
    _peerReviewEnabled = a?['peer_review_enabled'] == true;
    _titleFocus.addListener(() => setState(() {}));
    _descFocus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _titleFocus.dispose();
    _descFocus.dispose();
    super.dispose();
  }

  Future<void> _pickDeadline() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _deadline ?? now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(
                primary: _pSlate,
                onPrimary: Colors.white,
              ),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: _deadline != null
          ? TimeOfDay.fromDateTime(_deadline!)
          : const TimeOfDay(hour: 23, minute: 59),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(
                primary: _pSlate,
                onPrimary: Colors.white,
              ),
        ),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;
    setState(() {
      _deadline =
          DateTime(date.year, date.month, date.day, time.hour, time.minute);
      _deadlineError = null;
    });
  }

  void _quickPickDeadline(Duration offset) {
    final now = DateTime.now();
    setState(() {
      _deadline = DateTime(
        now.year,
        now.month,
        now.day + offset.inDays,
        23,
        59,
      );
      _deadlineError = null;
    });
  }

  Future<void> _save() async {
    final formOk = _formKey.currentState!.validate();
    if (_deadline == null) {
      setState(() => _deadlineError = 'Please set a deadline');
    }
    if (!formOk || _deadline == null) return;
    setState(() => _loading = true);
    try {
      if (_isEdit) {
        await ApiService.updateAssignment(
          widget.existingAssignment!['id'].toString(),
          {
            'title': _titleCtrl.text.trim(),
            'description': _descCtrl.text.trim(),
            'deadline': _deadline!.toIso8601String(),
            'peer_review_enabled': _peerReviewEnabled,
          },
        );
      } else {
        await ApiService.createAssignment(
          courseId: widget.courseId,
          title: _titleCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          deadline: _deadline!.toIso8601String(),
          peerReviewEnabled: _peerReviewEnabled,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEdit ? 'Assignment updated' : 'Assignment created'),
          backgroundColor: _pSeafoam,
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: _pRose,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return AnimatedPadding(
      duration: const Duration(milliseconds: 150),
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.86,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollCtrl) => Form(
          key: _formKey,
          child: Column(
            children: [
              _header(c),
              Expanded(
                child: ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  children: [
                    _detailsCard(c),
                    const SizedBox(height: 12),
                    _deadlineCard(c),
                    const SizedBox(height: 12),
                    _peerReviewCard(c),
                  ],
                ),
              ),
              _actionBar(c),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Header ─────────────────────────────────────────────────────────
  Widget _header(dynamic c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 12, 12),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_pSlate, _pLavender],
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: _pSlate.withValues(alpha: 0.34),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              _isEdit ? Icons.edit_note_rounded : Icons.assignment_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _isEdit ? 'Edit Assignment' : 'New Assignment',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  _isEdit
                      ? 'Update the details and save to notify students.'
                      : 'Give it a title, brief, and a deadline.',
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: Icon(Icons.close_rounded, color: c.textSecondary),
            onPressed: _loading ? null : () => Navigator.pop(context, false),
          ),
        ],
      ),
    );
  }

  // ─── Details (title + description) ──────────────────────────────────
  Widget _detailsCard(dynamic c) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: c.surfaceCard.withValues(alpha: 0.50),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('DETAILS', c),
          const SizedBox(height: 10),
          _GlassField(
            controller: _titleCtrl,
            focusNode: _titleFocus,
            label: 'Title',
            hint: 'e.g. Chapter 3 reflection',
            icon: Icons.title_rounded,
            accent: _pSlate,
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _GlassField(
            controller: _descCtrl,
            focusNode: _descFocus,
            label: 'Description',
            hint: 'Briefly describe what students should submit…',
            icon: Icons.description_outlined,
            accent: _pLavender,
            maxLines: 4,
          ),
        ],
      ),
    );
  }

  // ─── Deadline picker ────────────────────────────────────────────────
  Widget _deadlineCard(dynamic c) {
    final hasDeadline = _deadline != null;
    final dueBadge = hasDeadline ? _dueBadge(_deadline!) : null;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: c.surfaceCard.withValues(alpha: 0.50),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('DEADLINE', c),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: _pickDeadline,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: hasDeadline
                    ? _pSlate.withValues(alpha: 0.12)
                    : c.surfaceInput.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: hasDeadline
                      ? _pSlate.withValues(alpha: 0.40)
                      : (_deadlineError != null
                          ? _pRose.withValues(alpha: 0.50)
                          : c.border),
                  width: 1.2,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: hasDeadline
                            ? const [_pSlate, _pLavender]
                            : [_darken(c.textMuted, 0.05), c.textMuted],
                      ),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(
                      Icons.event_rounded,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          hasDeadline ? 'Due on' : 'Set a deadline',
                          style: TextStyle(
                            color: c.textMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.9,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          hasDeadline
                              ? _formatDeadline(_deadline!)
                              : 'Tap to choose a date and time',
                          style: TextStyle(
                            color: hasDeadline
                                ? c.textPrimary
                                : c.textSecondary,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: c.textMuted,
                  ),
                ],
              ),
            ),
          ),
          if (_deadlineError != null)
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 4),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      color: _pRose, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    _deadlineError!,
                    style: const TextStyle(
                      color: _pRose,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          if (dueBadge != null) ...[
            const SizedBox(height: 10),
            Align(alignment: Alignment.centerLeft, child: dueBadge),
          ],
          const SizedBox(height: 12),
          Text(
            'QUICK PICKS',
            style: TextStyle(
              color: c.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _quickChip('Tomorrow', const Duration(days: 1), _pSlate),
              _quickChip('In 3 days', const Duration(days: 3), _pLavender),
              _quickChip('In a week', const Duration(days: 7), _pSeafoam),
              _quickChip('In 2 weeks', const Duration(days: 14), _pSand),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Peer review toggle ─────────────────────────────────────────────
  Widget _peerReviewCard(dynamic c) {
    final active = _peerReviewEnabled;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: c.surfaceCard.withValues(alpha: 0.50),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('VISIBILITY', c),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () =>
                setState(() => _peerReviewEnabled = !_peerReviewEnabled),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: active
                    ? _pLavender.withValues(alpha: 0.12)
                    : c.surfaceInput.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: active
                      ? _pLavender.withValues(alpha: 0.40)
                      : c.border,
                  width: 1.2,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: active
                            ? const [_pLavender, _pSlate]
                            : [_darken(c.textMuted, 0.05), c.textMuted],
                      ),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(
                      Icons.reviews_rounded,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Enable peer review',
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          active
                              ? 'Classmates can view and review each other’s submissions.'
                              : 'Submissions stay private — only you grade them.',
                          style: TextStyle(
                            color: c.textSecondary,
                            fontSize: 11.5,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _SwitchPill(active: active, accent: _pLavender),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Bottom action bar ──────────────────────────────────────────────
  Widget _actionBar(dynamic c) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16, 10, 16, MediaQuery.of(context).padding.bottom + 10,
      ),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: c.divider)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _PastelOutlineButton(
              label: 'Cancel',
              color: c.textSecondary,
              onPressed:
                  _loading ? null : () => Navigator.pop(context, false),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: _PastelButton(
              label: _loading
                  ? 'Saving…'
                  : (_isEdit ? 'Update' : 'Create'),
              icon: _isEdit ? Icons.save_rounded : Icons.add_task_rounded,
              colors: const [_pSlate, _pLavender],
              busy: _loading,
              onPressed: _loading ? null : _save,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  Widget _quickChip(String label, Duration d, Color color) {
    return GestureDetector(
      onTap: () => _quickPickDeadline(d),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.38)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.schedule_rounded,
                size: 12, color: _darken(color, 0.18)),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: _darken(color, 0.22),
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text, dynamic c) {
    return Text(
      text,
      style: TextStyle(
        color: c.textMuted,
        fontSize: 10.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.1,
      ),
    );
  }

  Widget? _dueBadge(DateTime dt) {
    final now = DateTime.now();
    final diff = dt.difference(now);
    Color color;
    IconData icon;
    String text;
    if (diff.isNegative) {
      color = _pRose;
      icon = Icons.warning_amber_rounded;
      text = 'Already past — set a future date';
    } else if (diff.inHours < 24) {
      color = _pPeach;
      icon = Icons.bolt_rounded;
      text = 'Due in ${diff.inHours}h ${diff.inMinutes % 60}m';
    } else if (diff.inDays < 7) {
      color = _pSand;
      icon = Icons.timelapse_rounded;
      text = 'Due in ${diff.inDays}d ${diff.inHours % 24}h';
    } else {
      color = _pSeafoam;
      icon = Icons.event_available_rounded;
      text = 'Due in ${diff.inDays} days';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.36)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: _darken(color, 0.2)),
          const SizedBox(width: 5),
          Text(
            text,
            style: TextStyle(
              color: _darken(color, 0.22),
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDeadline(DateTime dt) {
    const months = [
      'Jan','Feb','Mar','Apr','May','Jun',
      'Jul','Aug','Sep','Oct','Nov','Dec',
    ];
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '${dt.day} ${months[dt.month - 1]} ${dt.year} · $h:$m';
  }
}

// ════════════════════════════════════════════════════════════════════════
// Reusable widgets
// ════════════════════════════════════════════════════════════════════════

class _GlassField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final String label;
  final String? hint;
  final IconData icon;
  final Color accent;
  final int maxLines;
  final TextInputAction? textInputAction;
  final String? Function(String?)? validator;

  const _GlassField({
    required this.controller,
    required this.focusNode,
    required this.label,
    this.hint,
    required this.icon,
    required this.accent,
    this.maxLines = 1,
    this.textInputAction,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final focused = focusNode.hasFocus;
    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      maxLines: maxLines,
      textInputAction: textInputAction,
      style: TextStyle(
        color: c.textPrimary,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: TextStyle(
          color: focused ? accent : c.textMuted,
          fontWeight: FontWeight.w700,
        ),
        hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 12, right: 10),
          child: Icon(icon, size: 18, color: focused ? accent : c.textMuted),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 40),
        filled: true,
        fillColor: focused
            ? accent.withValues(alpha: 0.08)
            : c.surfaceInput.withValues(alpha: 0.55),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _pRose),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _pRose, width: 1.5),
        ),
      ),
      validator: validator,
    );
  }
}

class _PastelButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final List<Color> colors;
  final VoidCallback? onPressed;
  final bool busy;

  const _PastelButton({
    required this.label,
    this.icon,
    required this.colors,
    this.onPressed,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: colors),
            borderRadius: BorderRadius.circular(14),
            boxShadow: disabled
                ? null
                : [
                    BoxShadow(
                      color: colors.first.withValues(alpha: 0.36),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (busy)
                const SizedBox(
                  width: 17, height: 17,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2, color: Colors.white,
                  ),
                )
              else if (icon != null)
                Icon(icon, color: Colors.white, size: 17),
              if (busy || icon != null) const SizedBox(width: 7),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PastelOutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color? color;

  const _PastelOutlineButton({
    required this.label,
    this.onPressed,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final accent = color ?? c.textSecondary;
    final disabled = onPressed == null;
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: accent.withValues(alpha: 0.40)),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: accent,
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SwitchPill extends StatelessWidget {
  final bool active;
  final Color accent;

  const _SwitchPill({required this.active, required this.accent});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      width: 44,
      height: 26,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: active
            ? accent.withValues(alpha: 0.35)
            : c.surfaceInput.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: active ? accent.withValues(alpha: 0.65) : c.border,
          width: 1.2,
        ),
      ),
      child: Align(
        alignment: active ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: active ? accent : c.textMuted,
            shape: BoxShape.circle,
            boxShadow: active
                ? [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.5),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
        ),
      ),
    );
  }
}
