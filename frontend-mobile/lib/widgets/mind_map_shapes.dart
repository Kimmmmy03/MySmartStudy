import 'dart:math';
import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Shape definitions matching the web React Flow custom-nodes.tsx exactly.
// Each shape has: id, display label, default width/height, default stroke color,
// category, and an icon builder for the palette.
// ─────────────────────────────────────────────────────────────────────────────

class ShapeDef {
  final String id;
  final String label;
  final double w, h;
  final String stroke;
  final String category; // basic, flowchart, creative, special
  final IconData icon;
  const ShapeDef(this.id, this.label, this.w, this.h, this.stroke, this.category, this.icon);
}

const List<ShapeDef> allShapes = [
  // ── BASIC ──
  ShapeDef('rectangle',    'Rectangle',   140, 60,  '#6366f1', 'basic',     Icons.crop_square),
  ShapeDef('roundedRect',  'Rounded',     140, 60,  '#8b5cf6', 'basic',     Icons.rounded_corner),
  ShapeDef('circle',       'Circle',       90, 90,  '#10b981', 'basic',     Icons.circle_outlined),
  ShapeDef('ellipse',      'Ellipse',     130, 80,  '#06b6d4', 'basic',     Icons.lens_outlined),
  ShapeDef('diamond',      'Diamond',     110, 110, '#f59e0b', 'basic',     Icons.diamond_outlined),
  ShapeDef('triangle',     'Triangle',    110, 100, '#ef4444', 'basic',     Icons.change_history),
  // ── FLOWCHART ──
  ShapeDef('parallelogram','Parallel',    140, 60,  '#f97316', 'flowchart', Icons.align_horizontal_left),
  ShapeDef('cylinder',     'Cylinder',    100, 90,  '#14b8a6', 'flowchart', Icons.storage_rounded),
  ShapeDef('database',     'Database',    100, 110, '#0ea5e9', 'flowchart', Icons.dns_rounded),
  ShapeDef('document',     'Document',    120, 80,  '#d946ef', 'flowchart', Icons.description_outlined),
  ShapeDef('hexagon',      'Hexagon',     120, 100, '#ec4899', 'flowchart', Icons.hexagon_outlined),
  ShapeDef('arrowShape',   'Arrow',       130, 60,  '#f43f5e', 'flowchart', Icons.arrow_forward),
  // ── CREATIVE ──
  ShapeDef('star',         'Star',        100, 100, '#eab308', 'creative',  Icons.star_outline),
  ShapeDef('cloud',        'Cloud',       150, 100, '#a78bfa', 'creative',  Icons.cloud_outlined),
  ShapeDef('callout',      'Callout',     140, 90,  '#38bdf8', 'creative',  Icons.chat_bubble_outline),
  ShapeDef('pentagon',     'Pentagon',    110, 110, '#f472b6', 'creative',  Icons.pentagon_outlined),
  ShapeDef('octagon',      'Octagon',     110, 110, '#fb923c', 'creative',  Icons.stop_outlined),
  ShapeDef('cross',        'Cross',       100, 100, '#a3e635', 'creative',  Icons.add_box_outlined),
  // ── SPECIAL ──
  ShapeDef('text',         'Text',        140, 50,  '#94a3b8', 'special',   Icons.text_fields),
  ShapeDef('image',        'Image',       160, 120, '#6366f1', 'special',   Icons.image_outlined),
  ShapeDef('group',        'Group',       240, 180, '#64748b', 'special',   Icons.select_all),
];

ShapeDef shapeDefById(String id) =>
    allShapes.firstWhere((s) => s.id == id, orElse: () => allShapes[1]); // default roundedRect

// ─────────────────────────────────────────────────────────────────────────────
// Path generators – return a Path for the given shape within (0,0)→(w,h).
// Matches the web custom-nodes.tsx SVG path generators exactly.
// ─────────────────────────────────────────────────────────────────────────────

Path shapePath(String shape, double w, double h) {
  switch (shape) {
    case 'rectangle':
      return Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), const Radius.circular(4)));
    case 'roundedRect':
      return Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), Radius.circular(min(14, min(w, h) * 0.2))));
    case 'circle':
      return Path()..addOval(Rect.fromLTWH(0, 0, w, h));
    case 'ellipse':
      return Path()..addOval(Rect.fromLTWH(0, 0, w, h));
    case 'diamond':
      return Path()
        ..moveTo(w / 2, 0)
        ..lineTo(w, h / 2)
        ..lineTo(w / 2, h)
        ..lineTo(0, h / 2)
        ..close();
    case 'triangle':
      return Path()
        ..moveTo(w / 2, 0)
        ..lineTo(w, h)
        ..lineTo(0, h)
        ..close();
    case 'hexagon':
      final dx = w * 0.25;
      return Path()
        ..moveTo(dx, 0)
        ..lineTo(w - dx, 0)
        ..lineTo(w, h / 2)
        ..lineTo(w - dx, h)
        ..lineTo(dx, h)
        ..lineTo(0, h / 2)
        ..close();
    case 'parallelogram':
      final skew = w * 0.2;
      return Path()
        ..moveTo(skew, 0)
        ..lineTo(w, 0)
        ..lineTo(w - skew, h)
        ..lineTo(0, h)
        ..close();
    case 'star':
      return _starPath(w, h, 5);
    case 'cloud':
      return _cloudPath(w, h);
    case 'callout':
      return _calloutPath(w, h);
    case 'cylinder':
      return _cylinderPath(w, h);
    case 'database':
      return _databasePath(w, h);
    case 'document':
      return _documentPath(w, h);
    case 'pentagon':
      return _regularPolygonPath(w, h, 5);
    case 'octagon':
      return _regularPolygonPath(w, h, 8);
    case 'cross':
      return _crossPath(w, h);
    case 'arrowShape':
      return _arrowShapePath(w, h);
    case 'text':
      return Path()..addRect(Rect.fromLTWH(0, 0, w, h));
    case 'image':
      return Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), const Radius.circular(8)));
    case 'group':
      return Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), const Radius.circular(12)));
    default:
      return Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, h), const Radius.circular(14)));
  }
}

Path _starPath(double w, double h, int points) {
  final path = Path();
  final cx = w / 2, cy = h / 2;
  final outerR = min(w, h) / 2;
  final innerR = outerR * 0.38;
  for (int i = 0; i < points * 2; i++) {
    final angle = (i * pi / points) - pi / 2;
    final r = i.isEven ? outerR : innerR;
    final x = cx + r * cos(angle);
    final y = cy + r * sin(angle);
    if (i == 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.close();
  return path;
}

Path _cloudPath(double w, double h) {
  final path = Path();
  // Cloud made of overlapping arcs — matches web's bezier cloud
  path.moveTo(w * 0.25, h * 0.8);
  path.cubicTo(w * 0.0, h * 0.8, w * 0.0, h * 0.5, w * 0.15, h * 0.4);
  path.cubicTo(w * 0.05, h * 0.2, w * 0.2, h * 0.0, w * 0.4, h * 0.1);
  path.cubicTo(w * 0.45, h * -0.05, w * 0.65, h * -0.05, w * 0.7, h * 0.1);
  path.cubicTo(w * 0.85, h * 0.0, w * 1.05, h * 0.2, w * 0.9, h * 0.4);
  path.cubicTo(w * 1.05, h * 0.55, w * 1.0, h * 0.8, w * 0.75, h * 0.8);
  path.close();
  return path;
}

Path _calloutPath(double w, double h) {
  final bodyH = h * 0.75;
  final r = min(12.0, bodyH * 0.2);
  final path = Path();
  path.addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, bodyH), Radius.circular(r)));
  // Tail triangle
  path.moveTo(w * 0.2, bodyH);
  path.lineTo(w * 0.1, h);
  path.lineTo(w * 0.35, bodyH);
  path.close();
  return path;
}

Path _cylinderPath(double w, double h) {
  final ellipseH = h * 0.18;
  final path = Path();
  // Top ellipse
  path.addOval(Rect.fromLTWH(0, 0, w, ellipseH * 2));
  // Body
  path.moveTo(0, ellipseH);
  path.lineTo(0, h - ellipseH);
  path.arcToPoint(Offset(w, h - ellipseH), radius: Radius.elliptical(w / 2, ellipseH), clockwise: false);
  path.lineTo(w, ellipseH);
  return path;
}

Path _databasePath(double w, double h) {
  final ellipseH = h * 0.14;
  final path = Path();
  // Three stacked ellipses + body
  path.addOval(Rect.fromLTWH(0, 0, w, ellipseH * 2));
  path.moveTo(0, ellipseH);
  path.lineTo(0, h - ellipseH);
  path.arcToPoint(Offset(w, h - ellipseH), radius: Radius.elliptical(w / 2, ellipseH), clockwise: false);
  path.lineTo(w, ellipseH);
  // Middle stripe
  path.moveTo(0, h * 0.35);
  path.arcToPoint(Offset(w, h * 0.35), radius: Radius.elliptical(w / 2, ellipseH), clockwise: false);
  return path;
}

Path _documentPath(double w, double h) {
  final path = Path();
  path.moveTo(0, 0);
  path.lineTo(w, 0);
  path.lineTo(w, h * 0.8);
  // Wavy bottom
  path.cubicTo(w * 0.75, h * 0.95, w * 0.5, h * 0.7, w * 0.25, h * 0.85);
  path.cubicTo(w * 0.12, h * 0.9, 0, h * 0.8, 0, h * 0.8);
  path.close();
  return path;
}

Path _regularPolygonPath(double w, double h, int sides) {
  final path = Path();
  final cx = w / 2, cy = h / 2;
  final r = min(w, h) / 2;
  for (int i = 0; i < sides; i++) {
    final angle = (i * 2 * pi / sides) - pi / 2;
    final x = cx + r * cos(angle);
    final y = cy + r * sin(angle);
    if (i == 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.close();
  return path;
}

Path _crossPath(double w, double h) {
  final armW = w * 0.33;
  final armH = h * 0.33;
  final path = Path();
  path.moveTo(armW, 0);
  path.lineTo(w - armW, 0);
  path.lineTo(w - armW, armH);
  path.lineTo(w, armH);
  path.lineTo(w, h - armH);
  path.lineTo(w - armW, h - armH);
  path.lineTo(w - armW, h);
  path.lineTo(armW, h);
  path.lineTo(armW, h - armH);
  path.lineTo(0, h - armH);
  path.lineTo(0, armH);
  path.lineTo(armW, armH);
  path.close();
  return path;
}

Path _arrowShapePath(double w, double h) {
  final notch = w * 0.15;
  final path = Path();
  path.moveTo(0, 0);
  path.lineTo(w - notch, 0);
  path.lineTo(w, h / 2);
  path.lineTo(w - notch, h);
  path.lineTo(0, h);
  path.lineTo(notch, h / 2);
  path.close();
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShapeNodePainter – paints a single node shape (fill + stroke + optional shadow)
// ─────────────────────────────────────────────────────────────────────────────

class ShapeNodePainter extends CustomPainter {
  final String shape;
  final Color fillColor;
  final Color strokeColor;
  final double strokeWidth;
  final bool shadow;
  final double opacity;
  final bool isSelected;
  final bool isConnectSource;
  final bool isDashed; // for group nodes

  ShapeNodePainter({
    required this.shape,
    required this.fillColor,
    required this.strokeColor,
    this.strokeWidth = 2,
    this.shadow = false,
    this.opacity = 1.0,
    this.isSelected = false,
    this.isConnectSource = false,
    this.isDashed = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final path = shapePath(shape, size.width, size.height);

    // Shadow
    if (shadow || isSelected) {
      final shadowPaint = Paint()
        ..color = (isSelected ? const Color(0xFF8b5cf6) : strokeColor).withOpacity(isSelected ? 0.3 : 0.2)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, isSelected ? 12 : 8);
      canvas.drawPath(path.shift(const Offset(0, 2)), shadowPaint);
    }

    // Fill
    if (shape != 'text' && shape != 'group') {
      final fillPaint = Paint()
        ..color = fillColor.withOpacity(opacity * fillColor.opacity)
        ..style = PaintingStyle.fill;
      canvas.drawPath(path, fillPaint);
    }

    // Stroke
    final effectiveStroke = isConnectSource
        ? const Color(0xFFf59e0b)
        : isSelected
            ? const Color(0xFF8b5cf6)
            : strokeColor;
    final effectiveWidth = (isSelected || isConnectSource) ? 3.0 : strokeWidth;

    if (isDashed || shape == 'group') {
      _drawDashedPath(canvas, path, effectiveStroke, effectiveWidth);
    } else {
      final strokePaint = Paint()
        ..color = effectiveStroke
        ..strokeWidth = effectiveWidth
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round;
      canvas.drawPath(path, strokePaint);
    }

    // Connection handle dots — visible on selected nodes (matches web's handle system)
    if (isSelected) {
      final hFill = Paint()
        ..color = const Color(0xFF8b5cf6)
        ..style = PaintingStyle.fill;
      final hBorder = Paint()
        ..color = Colors.white
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke;
      final handles = [
        Offset(size.width / 2, 0),
        Offset(size.width / 2, size.height),
        Offset(0, size.height / 2),
        Offset(size.width, size.height / 2),
      ];
      for (final p in handles) {
        canvas.drawCircle(p, 5.0, hFill);
        canvas.drawCircle(p, 5.0, hBorder);
      }
    }
  }

  void _drawDashedPath(Canvas canvas, Path path, Color color, double width) {
    final metrics = path.computeMetrics();
    final paint = Paint()
      ..color = color
      ..strokeWidth = width
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const dashLen = 8.0;
    const gapLen = 5.0;
    for (final metric in metrics) {
      double distance = 0;
      bool draw = true;
      while (distance < metric.length) {
        final next = distance + (draw ? dashLen : gapLen);
        if (draw) {
          final extracted = metric.extractPath(distance, min(next, metric.length));
          canvas.drawPath(extracted, paint);
        }
        distance = next;
        draw = !draw;
      }
    }
  }

  @override
  bool shouldRepaint(covariant ShapeNodePainter old) =>
      old.shape != shape ||
      old.fillColor != fillColor ||
      old.strokeColor != strokeColor ||
      old.strokeWidth != strokeWidth ||
      old.isSelected != isSelected ||
      old.isConnectSource != isConnectSource ||
      old.shadow != shadow ||
      old.opacity != opacity;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShapeClipper – clips child widgets to the shape path (for image nodes etc.)
// ─────────────────────────────────────────────────────────────────────────────

class ShapeClipper extends CustomClipper<Path> {
  final String shape;
  ShapeClipper(this.shape);

  @override
  Path getClip(Size size) => shapePath(shape, size.width, size.height);

  @override
  bool shouldReclip(covariant ShapeClipper old) => old.shape != shape;
}

// ─────────────────────────────────────────────────────────────────────────────
// EdgePainter – draws all edges with bezier curves, colored arrows, labels
// Matches the web custom-edges.tsx rendering.
// ─────────────────────────────────────────────────────────────────────────────

class MindMapEdgePainter extends CustomPainter {
  final List<EdgePaintData> edges;
  final String? highlightNodeId;

  MindMapEdgePainter({required this.edges, this.highlightNodeId});

  @override
  void paint(Canvas canvas, Size size) {
    for (final e in edges) {
      final isHighlighted = e.sourceId == highlightNodeId || e.targetId == highlightNodeId;
      final color = e.strokeColor;

      final paint = Paint()
        ..color = isHighlighted ? color : color.withOpacity(0.7)
        ..strokeWidth = isHighlighted ? 3 : e.strokeWidth
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      // Dash pattern
      if (e.strokeDash == 'dashed') {
        _drawDashedEdge(canvas, e, paint);
      } else if (e.strokeDash == 'dotted') {
        paint.strokeCap = StrokeCap.round;
        _drawDottedEdge(canvas, e, paint);
      } else {
        final path = _edgePath(e);
        canvas.drawPath(path, paint);
      }

      // Arrowhead at target
      if (e.targetArrow != 'none') {
        _drawArrowhead(canvas, e, color, isHighlighted);
      }

      // Label
      if (e.label != null && e.label!.isNotEmpty) {
        _drawLabel(canvas, e);
      }
    }
  }

  Path _edgePath(EdgePaintData e) {
    switch (e.edgeType) {
      case 'straight':
        return Path()
          ..moveTo(e.sx, e.sy)
          ..lineTo(e.tx, e.ty);
      case 'step':
        final my = (e.sy + e.ty) / 2;
        return Path()
          ..moveTo(e.sx, e.sy)
          ..lineTo(e.sx, my)
          ..lineTo(e.tx, my)
          ..lineTo(e.tx, e.ty);
      default: // bezier
        return Path()
          ..moveTo(e.sx, e.sy)
          ..cubicTo(e.sx, (e.sy + e.ty) / 2, e.tx, (e.sy + e.ty) / 2, e.tx, e.ty);
    }
  }

  void _drawDashedEdge(Canvas canvas, EdgePaintData e, Paint paint) {
    final path = _edgePath(e);
    final metrics = path.computeMetrics();
    const dash = 10.0, gap = 6.0;
    for (final m in metrics) {
      double d = 0;
      bool draw = true;
      while (d < m.length) {
        final next = d + (draw ? dash : gap);
        if (draw) canvas.drawPath(m.extractPath(d, min(next, m.length)), paint);
        d = next;
        draw = !draw;
      }
    }
  }

  void _drawDottedEdge(Canvas canvas, EdgePaintData e, Paint paint) {
    final path = _edgePath(e);
    final metrics = path.computeMetrics();
    const dot = 2.0, gap = 6.0;
    for (final m in metrics) {
      double d = 0;
      bool draw = true;
      while (d < m.length) {
        final next = d + (draw ? dot : gap);
        if (draw) canvas.drawPath(m.extractPath(d, min(next, m.length)), paint);
        d = next;
        draw = !draw;
      }
    }
  }

  void _drawArrowhead(Canvas canvas, EdgePaintData e, Color color, bool highlighted) {
    final angle = atan2(e.ty - e.sy, e.tx - e.sx);
    final arrowSize = (e.arrowSize ?? 10.0) * (highlighted ? 1.2 : 1.0);
    final arrowPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    switch (e.targetArrow) {
      case 'arrow':
      case 'block':
        final path = Path()
          ..moveTo(e.tx, e.ty)
          ..lineTo(e.tx - arrowSize * cos(angle - 0.4), e.ty - arrowSize * sin(angle - 0.4))
          ..lineTo(e.tx - arrowSize * cos(angle + 0.4), e.ty - arrowSize * sin(angle + 0.4))
          ..close();
        canvas.drawPath(path, arrowPaint);
        break;
      case 'openArrow':
        final strokePaint = Paint()
          ..color = color
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round;
        final path = Path()
          ..moveTo(e.tx - arrowSize * cos(angle - 0.5), e.ty - arrowSize * sin(angle - 0.5))
          ..lineTo(e.tx, e.ty)
          ..lineTo(e.tx - arrowSize * cos(angle + 0.5), e.ty - arrowSize * sin(angle + 0.5));
        canvas.drawPath(path, strokePaint);
        break;
      case 'diamond':
        final s = arrowSize * 0.7;
        final mx = e.tx - s * cos(angle);
        final my = e.ty - s * sin(angle);
        final path = Path()
          ..moveTo(e.tx, e.ty)
          ..lineTo(mx + s * 0.5 * cos(angle + pi / 2), my + s * 0.5 * sin(angle + pi / 2))
          ..lineTo(mx - s * cos(angle), my - s * sin(angle))
          ..lineTo(mx - s * 0.5 * cos(angle + pi / 2), my - s * 0.5 * sin(angle + pi / 2))
          ..close();
        canvas.drawPath(path, arrowPaint);
        break;
      case 'circle':
        final r = arrowSize * 0.4;
        canvas.drawCircle(Offset(e.tx - r * cos(angle), e.ty - r * sin(angle)), r, arrowPaint);
        break;
      case 'thinArrow':
        final strokePaint = Paint()
          ..color = color
          ..strokeWidth = 1.5
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round;
        final path = Path()
          ..moveTo(e.tx - arrowSize * 0.8 * cos(angle - 0.3), e.ty - arrowSize * 0.8 * sin(angle - 0.3))
          ..lineTo(e.tx, e.ty)
          ..lineTo(e.tx - arrowSize * 0.8 * cos(angle + 0.3), e.ty - arrowSize * 0.8 * sin(angle + 0.3));
        canvas.drawPath(path, strokePaint);
        break;
      default: // 'none' or unknown
        break;
    }
  }

  void _drawLabel(Canvas canvas, EdgePaintData e) {
    final mx = (e.sx + e.tx) / 2;
    final my = (e.sy + e.ty) / 2;
    final tp = TextPainter(
      text: TextSpan(
        text: e.label,
        style: TextStyle(
          color: e.labelColor ?? Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    tp.layout(maxWidth: 120);
    final bgRect = Rect.fromCenter(center: Offset(mx, my), width: tp.width + 12, height: tp.height + 6);
    canvas.drawRRect(
      RRect.fromRectAndRadius(bgRect, const Radius.circular(4)),
      Paint()..color = e.labelBgColor ?? const Color(0xFF1a1a28),
    );
    tp.paint(canvas, Offset(mx - tp.width / 2, my - tp.height / 2));
  }

  @override
  bool shouldRepaint(covariant MindMapEdgePainter old) => true;
}

/// Data transfer object for edge painting — avoids passing model objects to painter.
class EdgePaintData {
  final String sourceId, targetId;
  final double sx, sy, tx, ty;
  final Color strokeColor;
  final double strokeWidth;
  final String edgeType; // bezier, straight, step
  final String targetArrow; // none, arrow, openArrow, diamond, circle, block, thinArrow
  final String? strokeDash; // null, dashed, dotted
  final String? label;
  final Color? labelColor, labelBgColor;
  final double? arrowSize;

  EdgePaintData({
    required this.sourceId,
    required this.targetId,
    required this.sx,
    required this.sy,
    required this.tx,
    required this.ty,
    required this.strokeColor,
    this.strokeWidth = 2,
    this.edgeType = 'bezier',
    this.targetArrow = 'block',
    this.strokeDash,
    this.label,
    this.labelColor,
    this.labelBgColor,
    this.arrowSize,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid pattern painter — dot grid matching web's ReactFlow background
// ─────────────────────────────────────────────────────────────────────────────

class GridPatternPainter extends CustomPainter {
  final double gridSize;
  final Color dotColor;
  final String pattern; // dots, lines, cross

  GridPatternPainter({this.gridSize = 30, required this.dotColor, this.pattern = 'dots'});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = dotColor;

    switch (pattern) {
      case 'lines':
        paint.strokeWidth = 0.5;
        paint.style = PaintingStyle.stroke;
        for (double x = 0; x < size.width; x += gridSize) {
          canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
        }
        for (double y = 0; y < size.height; y += gridSize) {
          canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
        }
        break;
      case 'cross':
        paint.strokeWidth = 0.5;
        paint.style = PaintingStyle.stroke;
        const crossSize = 4.0;
        for (double x = 0; x < size.width; x += gridSize) {
          for (double y = 0; y < size.height; y += gridSize) {
            canvas.drawLine(Offset(x - crossSize, y), Offset(x + crossSize, y), paint);
            canvas.drawLine(Offset(x, y - crossSize), Offset(x, y + crossSize), paint);
          }
        }
        break;
      default: // dots
        for (double x = 0; x < size.width; x += gridSize) {
          for (double y = 0; y < size.height; y += gridSize) {
            canvas.drawCircle(Offset(x, y), 1, paint);
          }
        }
    }
  }

  @override
  bool shouldRepaint(covariant GridPatternPainter old) =>
      old.gridSize != gridSize || old.dotColor != dotColor || old.pattern != pattern;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShapeNodeWidget – composites the shape painter + text label into a widget.
// This is the core building block for both editor and viewer.
// ─────────────────────────────────────────────────────────────────────────────

class ShapeNodeWidget extends StatelessWidget {
  final String shape;
  final String label;
  final double width;
  final double height;
  final Color fillColor;
  final Color strokeColor;
  final double strokeWidth;
  final Color fontColor;
  final double fontSize;
  final String fontWeight;
  final String fontStyle;
  final String textAlign;
  final double opacity;
  final bool shadow;
  final bool isSelected;
  final bool isConnectSource;

  const ShapeNodeWidget({
    super.key,
    required this.shape,
    required this.label,
    required this.width,
    required this.height,
    required this.fillColor,
    required this.strokeColor,
    this.strokeWidth = 2,
    required this.fontColor,
    this.fontSize = 14,
    this.fontWeight = 'normal',
    this.fontStyle = 'normal',
    this.textAlign = 'center',
    this.opacity = 1.0,
    this.shadow = false,
    this.isSelected = false,
    this.isConnectSource = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: ShapeNodePainter(
          shape: shape,
          fillColor: fillColor,
          strokeColor: strokeColor,
          strokeWidth: strokeWidth,
          shadow: shadow,
          opacity: opacity,
          isSelected: isSelected,
          isConnectSource: isConnectSource,
          isDashed: shape == 'group',
        ),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: _horizontalPadding(),
            vertical: _verticalPadding(),
          ),
          child: Center(
            child: Text(
              label,
              textAlign: textAlign == 'left'
                  ? TextAlign.left
                  : textAlign == 'right'
                      ? TextAlign.right
                      : TextAlign.center,
              maxLines: shape == 'text' ? 10 : 4,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: fontWeight == 'bold' ? FontWeight.bold : FontWeight.w500,
                fontStyle: fontStyle == 'italic' ? FontStyle.italic : FontStyle.normal,
                color: fontColor,
                height: 1.2,
              ),
            ),
          ),
        ),
      ),
    );
  }

  double _horizontalPadding() {
    switch (shape) {
      case 'diamond':
        return width * 0.22;
      case 'triangle':
        return width * 0.2;
      case 'hexagon':
        return width * 0.18;
      case 'parallelogram':
        return width * 0.18;
      case 'star':
        return width * 0.22;
      case 'pentagon':
      case 'octagon':
        return width * 0.15;
      case 'cross':
        return width * 0.25;
      case 'arrowShape':
        return width * 0.18;
      default:
        return 12;
    }
  }

  double _verticalPadding() {
    switch (shape) {
      case 'diamond':
        return height * 0.22;
      case 'triangle':
        return height * 0.25;
      case 'star':
        return height * 0.22;
      case 'callout':
        return 8;
      case 'cylinder':
        return height * 0.18;
      case 'database':
        return height * 0.15;
      default:
        return 8;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small preview widget for the shape palette sidebar
// ─────────────────────────────────────────────────────────────────────────────

class ShapePreview extends StatelessWidget {
  final String shape;
  final Color strokeColor;
  final double size;

  const ShapePreview({
    super.key,
    required this.shape,
    required this.strokeColor,
    this.size = 32,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: ShapeNodePainter(
          shape: shape,
          fillColor: Colors.transparent,
          strokeColor: strokeColor,
          strokeWidth: 1.5,
        ),
      ),
    );
  }
}
