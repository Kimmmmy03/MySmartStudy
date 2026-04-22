import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../utils/app_colors.dart';
import '../../utils/app_theme_ext.dart';

class MonthlyComparisonChart extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const MonthlyComparisonChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    if (data.isEmpty) return const SizedBox.shrink();

    final bars = <BarChartGroupData>[];
    for (var i = 0; i < data.length; i++) {
      final current = (data[i]['current'] ?? 0).toDouble();
      final previous = (data[i]['previous'] ?? 0).toDouble();
      bars.add(BarChartGroupData(
        x: i,
        barRods: [
          BarChartRodData(
            toY: previous,
            width: 10,
            color: AppColors.purple.withOpacity(0.5),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
          ),
          BarChartRodData(
            toY: current,
            width: 10,
            color: AppColors.blue,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
          ),
        ],
        barsSpace: 4,
      ));
    }

    return Column(
      children: [
        AspectRatio(
          aspectRatio: 1.8,
          child: BarChart(
            BarChartData(
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) => FlLine(color: c.divider, strokeWidth: 0.5),
              ),
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 28,
                    getTitlesWidget: (value, meta) {
                      final i = value.toInt();
                      if (i < 0 || i >= data.length) return const SizedBox.shrink();
                      final label = data[i]['label']?.toString() ?? '${i + 1}';
                      return Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(label, style: TextStyle(color: c.textMuted, fontSize: 10)),
                      );
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 32,
                    getTitlesWidget: (value, meta) => Text(
                      value.toInt().toString(),
                      style: TextStyle(color: c.textMuted, fontSize: 10),
                    ),
                  ),
                ),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: false),
              barGroups: bars,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(width: 10, height: 10, decoration: BoxDecoration(color: AppColors.purple.withOpacity(0.5), borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 6),
            Text('Previous', style: TextStyle(color: c.textSecondary, fontSize: 12)),
            const SizedBox(width: 16),
            Container(width: 10, height: 10, decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 6),
            Text('Current', style: TextStyle(color: c.textSecondary, fontSize: 12)),
          ],
        ),
      ],
    );
  }
}
