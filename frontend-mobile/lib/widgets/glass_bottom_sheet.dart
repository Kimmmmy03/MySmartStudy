import 'dart:ui';
import 'package:flutter/material.dart';
import '../utils/app_theme_ext.dart';

/// Shows a glassmorphic modal bottom sheet.
Future<T?> showGlassBottomSheet<T>({
  required BuildContext context,
  required Widget Function(BuildContext) builder,
  bool isDismissible = true,
  bool enableDrag = true,
  double? maxHeight,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    constraints: maxHeight != null
        ? BoxConstraints(maxHeight: maxHeight)
        : null,
    builder: (ctx) => _GlassSheetWrapper(
      maxHeight: maxHeight,
      child: builder(ctx),
    ),
  );
}

class _GlassSheetWrapper extends StatelessWidget {
  final Widget child;
  final double? maxHeight;

  const _GlassSheetWrapper({required this.child, this.maxHeight});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isDark = context.isDark;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          constraints: maxHeight != null
              ? BoxConstraints(maxHeight: maxHeight!)
              : null,
          decoration: BoxDecoration(
            color: isDark
                ? c.surfaceCard.withOpacity(0.85)
                : c.surfaceCard.withOpacity(0.95),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(
              top: BorderSide(color: c.border),
              left: BorderSide(color: c.border),
              right: BorderSide(color: c.border),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: c.textMuted.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 8),
              Flexible(child: child),
            ],
          ),
        ),
      ),
    );
  }
}
