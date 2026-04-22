import 'package:flutter/material.dart';
import '../utils/app_theme_ext.dart';

/// A glassmorphic search bar consistent with the design system.
class SearchBarWidget extends StatelessWidget {
  final TextEditingController? controller;
  final String hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;
  final EdgeInsetsGeometry padding;

  const SearchBarWidget({
    super.key,
    this.controller,
    this.hintText = 'Search...',
    this.onChanged,
    this.onClear,
    this.padding = const EdgeInsets.symmetric(horizontal: 20),
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return Padding(
      padding: padding,
      child: Container(
        decoration: BoxDecoration(
          color: c.surfaceInput,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border),
        ),
        child: TextField(
          controller: controller,
          onChanged: onChanged,
          style: TextStyle(color: c.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
            prefixIcon: Icon(Icons.search_rounded, color: c.textMuted, size: 20),
            suffixIcon: controller != null &&
                    controller!.text.isNotEmpty &&
                    onClear != null
                ? IconButton(
                    icon: Icon(Icons.close_rounded, color: c.textMuted, size: 18),
                    onPressed: onClear,
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
          ),
        ),
      ),
    );
  }
}
