import 'package:flutter/material.dart';

class RiveNavIcon extends StatelessWidget {
  final String artboardName;
  final IconData fallbackIcon;
  final bool selected;
  final double size;
  final Color? selectedColor;
  final Color? unselectedColor;

  const RiveNavIcon({
    super.key,
    required this.artboardName,
    required this.fallbackIcon,
    required this.selected,
    this.size = 24,
    this.selectedColor,
    this.unselectedColor,
  });

  @override
  Widget build(BuildContext context) {
    return Icon(
      fallbackIcon,
      size: size,
      color: selected ? selectedColor : unselectedColor,
    );
  }
}
