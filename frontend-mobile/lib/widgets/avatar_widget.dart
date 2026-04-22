import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';

/// Consistent avatar widget with image, fallback initials, and optional online indicator.
class AvatarWidget extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double size;
  final String role;
  final bool showBorder;
  final bool showOnline;

  const AvatarWidget({
    super.key,
    this.imageUrl,
    required this.name,
    this.size = 44,
    this.role = 'student',
    this.showBorder = false,
    this.showOnline = false,
  });

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final gradient = AppColors.gradientForRole(role);

    Widget avatar;
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      avatar = CachedNetworkImage(
        imageUrl: imageUrl!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, __) => _initialsAvatar(gradient),
        errorWidget: (_, __, ___) => _initialsAvatar(gradient),
      );
    } else {
      avatar = _initialsAvatar(gradient);
    }

    Widget result = ClipRRect(
      borderRadius: BorderRadius.circular(size / 2),
      child: SizedBox(width: size, height: size, child: avatar),
    );

    if (showBorder) {
      result = Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: gradient,
        ),
        child: Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: context.colors.surface,
          ),
          child: result,
        ),
      );
    }

    if (showOnline) {
      result = Stack(
        children: [
          result,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.28,
              height: size * 0.28,
              decoration: BoxDecoration(
                color: AppColors.emerald,
                shape: BoxShape.circle,
                border: Border.all(
                  color: context.colors.surface,
                  width: 2,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return result;
  }

  Widget _initialsAvatar(LinearGradient gradient) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(gradient: gradient),
      child: Center(
        child: Text(
          _initials,
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.36,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
