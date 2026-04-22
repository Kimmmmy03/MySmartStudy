import 'package:flutter/material.dart';
import '../utils/app_colors.dart';

/// A gradient button that adapts to user role (student=blue, lecturer=purple, admin=amber).
class GradientButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final String role;
  final IconData? icon;
  final bool isLoading;
  final bool isExpanded;
  final double height;

  const GradientButton({
    super.key,
    required this.label,
    this.onPressed,
    this.role = 'student',
    this.icon,
    this.isLoading = false,
    this.isExpanded = true,
    this.height = 52,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = AppColors.gradientForRole(role);
    final disabled = onPressed == null || isLoading;

    Widget child = Container(
      height: height,
      decoration: BoxDecoration(
        gradient: disabled ? null : gradient,
        color: disabled ? Colors.grey.withOpacity(0.3) : null,
        borderRadius: BorderRadius.circular(14),
        boxShadow: disabled
            ? null
            : [
                BoxShadow(
                  color: AppColors.accentForRole(role).withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Center(
            child: isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Colors.white,
                    ),
                  )
                : Row(
                    mainAxisSize:
                        isExpanded ? MainAxisSize.max : MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, color: Colors.white, size: 20),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (!isExpanded && icon != null)
                        const SizedBox(width: 8),
                    ],
                  ),
          ),
        ),
      ),
    );

    if (!isExpanded) {
      child = IntrinsicWidth(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: child,
        ),
      );
    }

    return child;
  }
}
