import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme_ext.dart';

class MapPopularityChart extends StatelessWidget {
  final Map<String, dynamic> data;
  const MapPopularityChart({super.key, required this.data});

  static const _colors = [AppColors.blue, AppColors.purple, AppColors.emerald, AppColors.amber, AppColors.cyan, AppColors.red];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final types = (data['types'] as List?) ?? [];
    final counts = (data['counts'] as List?) ?? [];
    if (types.isEmpty || counts.isEmpty) return const SizedBox.shrink();

    final total = counts.fold<num>(0, (sum, v) => sum + (v is num ? v : 0));
    if (total == 0) return const SizedBox.shrink();

    final sections = <PieChartSectionData>[];
    for (var i = 0; i < types.length && i < counts.length; i++) {
      final value = (counts[i] is num ? counts[i] : 0).toDouble();
      final pct = (value / total * 100).round();
      final color = _colors[i % _colors.length];
      sections.add(PieChartSectionData(
        value: value,
        title: '$pct%',
        color: color,
        radius: 50,
        titleStyle: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
      ));
    }

    return Column(
      children: [
        AspectRatio(
          aspectRatio: 1.4,
          child: PieChart(PieChartData(
            sections: sections,
            centerSpaceRadius: 40,
            sectionsSpace: 2,
          )),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: List.generate(types.length, (i) {
            final color = _colors[i % _colors.length];
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
                const SizedBox(width: 6),
                Text(types[i].toString(), style: TextStyle(color: c.textSecondary, fontSize: 12)),
              ],
            );
          }),
        ),
      ],
    );
  }
}
