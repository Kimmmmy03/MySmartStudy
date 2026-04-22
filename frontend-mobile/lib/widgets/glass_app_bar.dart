import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_theme_ext.dart';

/// Glassmorphic app bar with blur effect, consistent with design system.
class GlassAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool showBackButton;
  final double blurSigma;
  final Widget? bottom;
  final double bottomHeight;

  const GlassAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.showBackButton = true,
    this.blurSigma = 15,
    this.bottom,
    this.bottomHeight = 0,
  });

  @override
  Size get preferredSize => Size.fromHeight(kToolbarHeight + bottomHeight);

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isDark = context.isDark;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
        child: Container(
          color: isDark
              ? c.surface.withOpacity(0.7)
              : c.surface.withOpacity(0.85),
          child: AppBar(
            title: Text(
              title,
              style: TextStyle(
                color: c.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            leading: leading ??
                (showBackButton && Navigator.canPop(context)
                    ? IconButton(
                        icon: Icon(Icons.arrow_back_rounded, color: c.textPrimary),
                        onPressed: () => Navigator.pop(context),
                      )
                    : null),
            actions: actions,
            backgroundColor: Colors.transparent,
            elevation: 0,
            scrolledUnderElevation: 0,
            systemOverlayStyle: isDark
                ? SystemUiOverlayStyle.light
                : SystemUiOverlayStyle.dark,
            bottom: bottom != null
                ? PreferredSize(
                    preferredSize: Size.fromHeight(bottomHeight),
                    child: bottom!,
                  )
                : null,
          ),
        ),
      ),
    );
  }
}
