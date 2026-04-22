import 'dart:ui';
import 'package:flutter/material.dart';
import '../utils/app_theme_ext.dart';

/// Glassmorphic card matching the web's .glass-card class.
/// Dark: rgba(255,255,255,0.04) bg, 24px blur, rgba(255,255,255,0.08) border.
/// Light: rgba(255,255,255,0.65) bg, 24px blur, subtle shadow.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final double borderRadius;
  final Color? borderColor;
  final double blurSigma;
  final VoidCallback? onTap;
  final Gradient? gradient;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
    this.borderRadius = 16,
    this.borderColor,
    this.blurSigma = 24,
    this.onTap,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isDark = context.isDark;

    final bgColor = isDark
        ? Colors.white.withOpacity(0.04)
        : Colors.white.withOpacity(0.65);

    final border = borderColor ?? (isDark
        ? Colors.white.withOpacity(0.08)
        : Colors.black.withOpacity(0.06));

    Widget card = ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: gradient == null ? bgColor : null,
            gradient: gradient,
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(color: border),
            boxShadow: isDark
                ? null
                : [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: child,
        ),
      ),
    );

    if (onTap != null) {
      card = GestureDetector(
        onTap: onTap,
        child: card,
      );
    }

    return Padding(padding: margin, child: card);
  }
}
