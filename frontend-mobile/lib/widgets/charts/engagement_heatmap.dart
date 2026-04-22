import 'package:flutter/material.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme_ext.dart';

class EngagementHeatmap extends StatelessWidget {
  final Map<String, dynamic> data;
  const EngagementHeatmap({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final hours = (data['hours'] as List?) ?? List.generate(24, (i) => i);
    final heatmap = (data['heatmap'] as List?) ?? [];

    if (heatmap.isEmpty) return const SizedBox.shrink();

    // Find max value for normalization
    num maxVal = 1;
    for (final row in heatmap) {
      if (row is List) {
        for (final cell in row) {
          if (cell is num && cell > maxVal) maxVal = cell;
        }
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hour labels
        Padding(
          padding: const EdgeInsets.only(left: 36),
          child: Row(
            children: List.generate(
              hours.length > 12 ? 12 : hours.length,
              (i) {
                final h = i * (hours.length > 12 ? 2 : 1);
                return Expanded(
                  child: Text(
                    '${h}h',
                    style: TextStyle(color: c.textMuted, fontSize: 8),
                    textAlign: TextAlign.center,
                  ),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 4),
        // Grid
        ...List.generate(days.length, (dayIdx) {
          final row = dayIdx < heatmap.length && heatmap[dayIdx] is List
              ? (heatmap[dayIdx] as List)
              : <dynamic>[];

          return Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Row(
              children: [
                SizedBox(
                  width: 32,
                  child: Text(days[dayIdx], style: TextStyle(color: c.textMuted, fontSize: 10)),
                ),
                const SizedBox(width: 4),
                ...List.generate(
                  hours.length > 12 ? 12 : hours.length,
                  (hIdx) {
                    final idx = hIdx * (hours.length > 12 ? 2 : 1);
                    final val = idx < row.length && row[idx] is num ? (row[idx] as num).toDouble() : 0.0;
                    final intensity = val / maxVal;
                    return Expanded(
                      child: Container(
                        height: 18,
                        margin: const EdgeInsets.all(1),
                        decoration: BoxDecoration(
                          color: AppColors.blue.withOpacity(intensity * 0.8 + 0.05),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 8),
        // Legend
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Text('Less', style: TextStyle(color: c.textMuted, fontSize: 10)),
            const SizedBox(width: 4),
            ...List.generate(5, (i) => Container(
              width: 14,
              height: 14,
              margin: const EdgeInsets.symmetric(horizontal: 1),
              decoration: BoxDecoration(
                color: AppColors.blue.withOpacity(i * 0.2 + 0.05),
                borderRadius: BorderRadius.circular(2),
              ),
            )),
            const SizedBox(width: 4),
            Text('More', style: TextStyle(color: c.textMuted, fontSize: 10)),
          ],
        ),
      ],
    );
  }
}
