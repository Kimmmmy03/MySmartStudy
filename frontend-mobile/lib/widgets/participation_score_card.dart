import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import 'glass_card.dart';
import 'badge_chip.dart';

class ParticipationScoreCard extends StatefulWidget {
  final String courseId;
  const ParticipationScoreCard({super.key, required this.courseId});
  @override
  State<ParticipationScoreCard> createState() => _ParticipationScoreCardState();
}

class _ParticipationScoreCardState extends State<ParticipationScoreCard> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService.getParticipation(widget.courseId);
      if (mounted) setState(() { _data = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    if (_loading) {
      return GlassCard(
        padding: const EdgeInsets.all(16),
        child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.blue, strokeWidth: 2))),
      );
    }

    if (_data == null) return const SizedBox.shrink();

    final score = (_data!['score'] ?? _data!['participation_score'] ?? 0).toDouble();
    final maxScore = (_data!['max_score'] ?? 100).toDouble();
    final pct = maxScore > 0 ? score / maxScore : 0.0;
    final color = pct >= 0.7 ? AppColors.emerald : pct >= 0.4 ? AppColors.amber : AppColors.red;

    final breakdown = _data!['breakdown'] as Map<String, dynamic>? ?? {};

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(Icons.trending_up_rounded, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Participation Score', style: TextStyle(color: c.textSecondary, fontSize: 12)),
                    Row(
                      children: [
                        Text('${score.toStringAsFixed(0)}', style: TextStyle(color: c.textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
                        Text(' / ${maxScore.toStringAsFixed(0)}', style: TextStyle(color: c.textMuted, fontSize: 14)),
                        const SizedBox(width: 8),
                        BadgeChip(label: '${(pct * 100).round()}%', color: color),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: c.surfaceElevated,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          if (breakdown.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...breakdown.entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(e.key.replaceAll('_', ' '), style: TextStyle(color: c.textSecondary, fontSize: 12)),
                  Text('${e.value}', style: TextStyle(color: c.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }
}
