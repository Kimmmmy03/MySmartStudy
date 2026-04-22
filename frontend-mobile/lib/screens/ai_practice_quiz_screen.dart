import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_theme_ext.dart';

// ── Pastel palette ──
const _pLavender   = Color(0xFFBFA8D9);
const _pSky        = Color(0xFFA9C9E8);
const _pSage       = Color(0xFFA8C9A8);
const _pPeach      = Color(0xFFF0A48C);
const _pSand       = Color(0xFFF5D79E);
const _pRose       = Color(0xFFF0B8A8);
const _pPeriwinkle = Color(0xFFB4C2E0);
const _pSeafoam    = Color(0xFF9FD4C0);
const _pMutedRose  = Color(0xFFE89988);
const _pSlate      = Color(0xFF8BB5DC);

const _questionPalette = <Color>[
  _pPeach,
  _pSky,
  _pLavender,
  _pSage,
  _pRose,
  _pPeriwinkle,
  _pSand,
  _pSeafoam,
];

Color _accentFor(int i) => _questionPalette[i % _questionPalette.length];

Color _darken(Color color, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

class AiPracticeQuizScreen extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> questions;
  const AiPracticeQuizScreen(
      {super.key, required this.title, required this.questions});

  @override
  State<AiPracticeQuizScreen> createState() => _AiPracticeQuizScreenState();
}

class _AiPracticeQuizScreenState extends State<AiPracticeQuizScreen> {
  final Map<int, String> _answers = {};
  bool _submitted = false;
  int _score = 0;
  int _current = 0;
  late final PageController _pageCtrl;
  DateTime? _startedAt;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _pageCtrl = PageController();
    _startedAt = DateTime.now();
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  void _submit() async {
    final total = widget.questions.length;
    final answered = _answers.length;

    if (answered < total) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => _buildConfirmDialog(ctx, answered, total),
      );
      if (confirm != true) return;
    }

    HapticFeedback.mediumImpact();
    int correct = 0;
    for (int i = 0; i < total; i++) {
      final correctAnswer =
          widget.questions[i]['correct_answer']?.toString() ?? '';
      if (_answers[i] == correctAnswer) correct++;
    }
    setState(() {
      _score = correct;
      _submitted = true;
      if (_startedAt != null) {
        _elapsed = DateTime.now().difference(_startedAt!);
      }
    });
  }

  void _reset() {
    HapticFeedback.lightImpact();
    setState(() {
      _answers.clear();
      _submitted = false;
      _score = 0;
      _current = 0;
      _startedAt = DateTime.now();
      _elapsed = Duration.zero;
    });
    _pageCtrl.jumpToPage(0);
  }

  void _jumpTo(int i) {
    HapticFeedback.selectionClick();
    setState(() => _current = i);
    _pageCtrl.animateToPage(i,
        duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '${m}m ${s}s';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final total = widget.questions.length;

    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: Text(
          widget.title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: total == 0
          ? _emptyState(c)
          : _submitted
              ? _buildResultsView(c)
              : _buildQuizView(c, total),
    );
  }

  // ── Empty state ─────────────────────────────────────────
  Widget _emptyState(c) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_darken(_pPeach, 0.06), _darken(_pPeach, 0.22)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.quiz_rounded,
                  color: Colors.white, size: 36),
            ),
            const SizedBox(height: 16),
            Text('No quiz questions',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text('This quiz has no questions to show.',
                style: TextStyle(color: c.textSecondary, fontSize: 13),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  // ── Quiz flow (one question per page) ───────────────────
  Widget _buildQuizView(c, int total) {
    final answered = _answers.length;
    final progress = total > 0 ? answered / total : 0.0;

    return Column(
      children: [
        // Top progress strip
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    'Question ${_current + 1} of $total',
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _pPeach.withOpacity(0.16),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: _pPeach.withOpacity(0.45), width: 1),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_rounded,
                            size: 12, color: _darken(_pPeach, 0.25)),
                        const SizedBox(width: 4),
                        Text(
                          '$answered/$total answered',
                          style: TextStyle(
                            color: _darken(_pPeach, 0.25),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: progress),
                  duration: const Duration(milliseconds: 400),
                  builder: (_, v, __) => LinearProgressIndicator(
                    value: v,
                    minHeight: 6,
                    backgroundColor: c.surfaceElevated,
                    valueColor:
                        AlwaysStoppedAnimation(_darken(_pPeach, 0.12)),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Paged questions
        Expanded(
          child: PageView.builder(
            controller: _pageCtrl,
            itemCount: total,
            onPageChanged: (i) => setState(() => _current = i),
            itemBuilder: (_, i) => _buildQuestionPage(i, c),
          ),
        ),

        // Bottom: pill navigator + nav buttons
        _buildBottomControls(c, total),
      ],
    );
  }

  Widget _buildQuestionPage(int index, c) {
    final q = widget.questions[index];
    final text = q['question']?.toString() ?? '';
    final type = q['type']?.toString() ?? 'mcq';
    final options =
        (q['options'] as List?)?.map((o) => o.toString()).toList() ?? [];
    final correctAnswer = q['correct_answer']?.toString() ?? '';
    final selected = _answers[index];
    final accent = _accentFor(index);

    final choices = type == 'true_false'
        ? [('True', 'true'), ('False', 'false')]
        : options
            .asMap()
            .entries
            .map((e) => (e.value, e.key.toString()))
            .toList();

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildQuestionCard(index, text, accent),
          const SizedBox(height: 18),
          ...choices.asMap().entries.map((entry) {
            final (label, value) = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _buildOption(
                qIndex: index,
                label: label,
                value: value,
                letter: String.fromCharCode(65 + entry.key),
                selected: selected,
                correctAnswer: correctAnswer,
                accent: accent,
                c: c,
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildQuestionCard(int index, String text, Color accent) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent,
            accent.withOpacity(0.80),
            _darken(accent, 0.05),
          ],
          stops: const [0.0, 0.55, 1.0],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withOpacity(0.30), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: _darken(accent, 0.15).withOpacity(0.40),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -30,
            right: -30,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.12),
              ),
            ),
          ),
          Positioned(
            bottom: -20,
            left: -20,
            child: Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.07),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Q${index + 1}',
                        style: TextStyle(
                          color: _darken(accent, 0.30),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  text,
                  style: TextStyle(
                    color: _darken(accent, 0.48),
                    fontSize: 18,
                    height: 1.45,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.05,
                    shadows: [
                      Shadow(
                        color: Colors.white.withOpacity(0.35),
                        blurRadius: 5,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOption({
    required int qIndex,
    required String label,
    required String value,
    required String letter,
    required String? selected,
    required String correctAnswer,
    required Color accent,
    required c,
  }) {
    final isSelected = selected == value;

    Color borderColor = c.border;
    Color bgColor = c.surfaceCard;
    Color letterBg = c.surfaceElevated;
    Color letterFg = c.textMuted;

    if (isSelected) {
      borderColor = _darken(accent, 0.10);
      bgColor = accent.withOpacity(0.14);
      letterBg = _darken(accent, 0.10);
      letterFg = Colors.white;
    }

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _answers[qIndex] = value);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: borderColor, width: isSelected ? 1.6 : 1),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: accent.withOpacity(0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: letterBg,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Center(
                child: Text(
                  letter,
                  style: TextStyle(
                    color: letterFg,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 14.5,
                  height: 1.4,
                  fontWeight:
                      isSelected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ),
            if (isSelected)
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: _darken(accent, 0.10),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: Colors.white, size: 14),
              ),
          ],
        ),
      ),
    );
  }

  // ── Bottom: pill navigator + nav buttons + submit ───────
  Widget _buildBottomControls(c, int total) {
    final canGoBack = _current > 0;
    final isLast = _current == total - 1;
    final allAnswered = _answers.length == total;

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border, width: 1)),
      ),
      padding: EdgeInsets.fromLTRB(
          16, 10, 16, 10 + MediaQuery.of(context).padding.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Question pills navigator
          SizedBox(
            height: 32,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: total,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final isCurrent = i == _current;
                final isAnswered = _answers.containsKey(i);
                Color bg = c.surfaceCard;
                Color border = c.border;
                Color fg = c.textMuted;
                if (isCurrent) {
                  bg = _darken(_pPeach, 0.10);
                  border = _darken(_pPeach, 0.10);
                  fg = Colors.white;
                } else if (isAnswered) {
                  bg = _pPeach.withOpacity(0.16);
                  border = _pPeach.withOpacity(0.45);
                  fg = _darken(_pPeach, 0.25);
                }
                return GestureDetector(
                  onTap: () => _jumpTo(i),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: border, width: 1),
                    ),
                    child: Center(
                      child: Text(
                        '${i + 1}',
                        style: TextStyle(
                          color: fg,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          // Prev / (Next or Submit)
          Row(
            children: [
              _squareBtn(
                icon: Icons.arrow_back_rounded,
                enabled: canGoBack,
                onTap: () => _jumpTo(_current - 1),
                c: c,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: isLast
                    ? ElevatedButton.icon(
                        onPressed: allAnswered
                            ? _submit
                            : () => _submit(), // will confirm
                        icon: const Icon(Icons.check_rounded,
                            color: Colors.white, size: 18),
                        label: Text(
                          allAnswered
                              ? 'Submit Answers'
                              : 'Submit (${_answers.length}/$total)',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _darken(_pPeach, 0.12),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                          elevation: 4,
                          shadowColor:
                              _darken(_pPeach, 0.18).withOpacity(0.55),
                        ),
                      )
                    : ElevatedButton.icon(
                        onPressed: () => _jumpTo(_current + 1),
                        icon: const Icon(Icons.arrow_forward_rounded,
                            color: Colors.white, size: 18),
                        label: const Text(
                          'Next',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _darken(_pPeach, 0.12),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                          elevation: 4,
                          shadowColor:
                              _darken(_pPeach, 0.18).withOpacity(0.55),
                        ),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _squareBtn({
    required IconData icon,
    required bool enabled,
    required VoidCallback onTap,
    required c,
  }) {
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 180),
      opacity: enabled ? 1.0 : 0.35,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: _pPeach.withOpacity(0.14),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _pPeach.withOpacity(0.45), width: 1),
          ),
          child: Icon(icon, color: _darken(_pPeach, 0.20), size: 22),
        ),
      ),
    );
  }

  Widget _buildConfirmDialog(BuildContext ctx, int answered, int total) {
    final c = ctx.colors;
    return Dialog(
      backgroundColor: c.surface,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: _pSand.withOpacity(0.20),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _pSand.withOpacity(0.50), width: 1),
              ),
              child: Icon(Icons.info_rounded,
                  color: _darken(_pSand, 0.25), size: 30),
            ),
            const SizedBox(height: 14),
            Text('Submit incomplete quiz?',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              "You've answered $answered of $total questions. Unanswered questions will be marked incorrect.",
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: c.textSecondary, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(color: c.border, width: 1),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text('Keep going',
                        style: TextStyle(
                            color: c.textPrimary,
                            fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _darken(_pPeach, 0.12),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Submit',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Results view ────────────────────────────────────────
  Widget _buildResultsView(c) {
    final total = widget.questions.length;
    final pct = total > 0 ? _score / total : 0.0;
    final wrong = _answers.entries
        .where((e) =>
            e.value !=
            (widget.questions[e.key]['correct_answer']?.toString() ?? ''))
        .length;
    final skipped = total - _answers.length;

    Color heroAccent;
    String heroLabel;
    IconData heroIcon;
    if (pct >= 0.9) {
      heroAccent = _pSage;
      heroLabel = 'Excellent!';
      heroIcon = Icons.celebration_rounded;
    } else if (pct >= 0.7) {
      heroAccent = _pSeafoam;
      heroLabel = 'Great job!';
      heroIcon = Icons.emoji_events_rounded;
    } else if (pct >= 0.5) {
      heroAccent = _pSand;
      heroLabel = 'Keep practising';
      heroIcon = Icons.trending_up_rounded;
    } else {
      heroAccent = _pMutedRose;
      heroLabel = 'Room to grow';
      heroIcon = Icons.refresh_rounded;
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            children: [
              // Hero score card
              _buildHeroScore(heroAccent, heroLabel, heroIcon, pct),
              const SizedBox(height: 14),
              // Stats row
              Row(
                children: [
                  Expanded(
                      child: _statCard(
                          'Correct', '$_score', _pSage, Icons.check_rounded, c)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: _statCard('Wrong', '$wrong', _pMutedRose,
                          Icons.close_rounded, c)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: _statCard('Skipped', '$skipped', _pSlate,
                          Icons.remove_rounded, c)),
                ],
              ),
              const SizedBox(height: 10),
              if (_elapsed.inSeconds > 0)
                _statBar(
                    'Time taken', _formatDuration(_elapsed),
                    Icons.schedule_rounded, _pPeriwinkle, c),
              const SizedBox(height: 20),
              // Review header
              Row(
                children: [
                  Icon(Icons.fact_check_rounded,
                      color: _darken(_pPeach, 0.20), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Question Review',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Review cards
              ...List.generate(total, (i) => _buildReviewCard(i, c)),
            ],
          ),
        ),
        // Bottom CTA
        Container(
          decoration: BoxDecoration(
            color: c.surface,
            border: Border(top: BorderSide(color: c.border, width: 1)),
          ),
          padding: EdgeInsets.fromLTRB(
              20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(Icons.arrow_back_rounded,
                      color: c.textPrimary, size: 18),
                  label: Text('Exit',
                      style: TextStyle(
                          color: c.textPrimary,
                          fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    side: BorderSide(color: c.border, width: 1),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: _reset,
                  icon: const Icon(Icons.replay_rounded,
                      color: Colors.white, size: 18),
                  label: const Text('Try Again',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _darken(_pPeach, 0.12),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 4,
                    shadowColor:
                        _darken(_pPeach, 0.18).withOpacity(0.55),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeroScore(
      Color accent, String label, IconData icon, double pct) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent,
            accent.withOpacity(0.80),
            _darken(accent, 0.05),
          ],
          stops: const [0.0, 0.55, 1.0],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withOpacity(0.30), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: _darken(accent, 0.15).withOpacity(0.45),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -40,
            right: -30,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.14),
              ),
            ),
          ),
          Positioned(
            bottom: -30,
            left: -20,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.08),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.85),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(icon, color: _darken(accent, 0.25), size: 36),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label.toUpperCase(),
                        style: TextStyle(
                          color: _darken(accent, 0.42),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: pct * 100),
                        duration: const Duration(milliseconds: 900),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, __) => Text(
                          '${v.round()}%',
                          style: TextStyle(
                            color: _darken(accent, 0.48),
                            fontSize: 38,
                            fontWeight: FontWeight.bold,
                            height: 1.05,
                            letterSpacing: -0.5,
                            shadows: [
                              Shadow(
                                color: Colors.white.withOpacity(0.35),
                                blurRadius: 5,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$_score of ${widget.questions.length} correct',
                        style: TextStyle(
                          color: _darken(accent, 0.40),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCard(
      String label, String value, Color accent, IconData icon, c) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: accent.withOpacity(0.14),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withOpacity(0.45), width: 1),
      ),
      child: Column(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: _darken(accent, 0.12),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: Colors.white, size: 16),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
                color: c.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _statBar(
      String label, String value, IconData icon, Color accent, c) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: accent.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withOpacity(0.40), width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: _darken(accent, 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: Colors.white, size: 14),
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
                color: c.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
                color: c.textPrimary,
                fontSize: 13.5,
                fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewCard(int i, c) {
    final q = widget.questions[i];
    final text = q['question']?.toString() ?? '';
    final type = q['type']?.toString() ?? 'mcq';
    final correctAnswer = q['correct_answer']?.toString() ?? '';
    final explanation = q['explanation']?.toString() ?? '';
    final selected = _answers[i];
    final options =
        (q['options'] as List?)?.map((o) => o.toString()).toList() ?? [];

    String readableFor(String? v) {
      if (v == null) return '—';
      if (type == 'true_false') return v == 'true' ? 'True' : 'False';
      final idx = int.tryParse(v);
      if (idx != null && idx >= 0 && idx < options.length) return options[idx];
      return v;
    }

    final bool skipped = selected == null;
    final bool isCorrect = !skipped && selected == correctAnswer;

    Color accent;
    IconData icon;
    String label;
    if (isCorrect) {
      accent = _pSage;
      icon = Icons.check_circle_rounded;
      label = 'Correct';
    } else if (skipped) {
      accent = _pSlate;
      icon = Icons.remove_circle_outline_rounded;
      label = 'Skipped';
    } else {
      accent = _pMutedRose;
      icon = Icons.cancel_rounded;
      label = 'Incorrect';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: c.surfaceCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: accent.withOpacity(0.35), width: 1),
        ),
        child: Theme(
          data: Theme.of(context)
              .copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(
                horizontal: 14, vertical: 4),
            childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            iconColor: c.textSecondary,
            collapsedIconColor: c.textSecondary,
            leading: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_darken(accent, 0.05), _darken(accent, 0.22)],
                ),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Center(
                child: Text(
                  '${i + 1}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            title: Text(
              text,
              style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  height: 1.3),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  Icon(icon,
                      color: _darken(accent, 0.15), size: 13),
                  const SizedBox(width: 4),
                  Text(
                    label,
                    style: TextStyle(
                      color: _darken(accent, 0.25),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
            children: [
              _reviewLine('Your answer', readableFor(selected),
                  isCorrect ? _pSage : _pMutedRose, c),
              const SizedBox(height: 6),
              _reviewLine(
                  'Correct answer', readableFor(correctAnswer), _pSage, c),
              if (explanation.isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _pSand.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: _pSand.withOpacity(0.45), width: 1),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(
                          color: _darken(_pSand, 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.lightbulb_rounded,
                            color: Colors.white, size: 15),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'EXPLANATION',
                              style: TextStyle(
                                color: _darken(_pSand, 0.30),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              explanation,
                              style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 12.5,
                                height: 1.45,
                              ),
                            ),
                          ],
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
    );
  }

  Widget _reviewLine(String label, String value, Color accent, c) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: accent.withOpacity(0.16),
            borderRadius: BorderRadius.circular(7),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: _darken(accent, 0.25),
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
