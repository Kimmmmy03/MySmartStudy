import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../models/mind_map_model.dart';
import 'mind_map_shapes.dart';

/// Decodes the web-saved base64 PNG thumbnail (html-to-image output). Accepts
/// raw base64 or a `data:image/png;base64,...` URI.
Uint8List? decodeMapThumbnail(String raw) {
  if (raw.isEmpty) return null;
  try {
    final comma = raw.indexOf(',');
    final b64 = comma >= 0 ? raw.substring(comma + 1) : raw;
    if (b64.isEmpty) return null;
    return base64Decode(b64);
  } catch (_) {
    return null;
  }
}

/// Mini mind-map preview painter — draws shapes + edges when no saved
/// thumbnail is available. Matches the web dark canvas look.
class MapPreviewPainter extends CustomPainter {
  final MindMapModel map;

  MapPreviewPainter({required this.map});

  static Color _hex(String hex) {
    try {
      final h = hex.replaceAll('#', '');
      return Color(int.parse(h.length == 6 ? 'FF$h' : h, radix: 16));
    } catch (_) {
      return Colors.white54;
    }
  }

  static Offset _borderExit(double nx, double ny, double nw, double nh, Offset toward) {
    final cx = nx + nw / 2;
    final cy = ny + nh / 2;
    final ddx = toward.dx - cx;
    final ddy = toward.dy - cy;
    if (ddx == 0 && ddy == 0) return Offset(cx, cy);
    final rx = ddx.abs() / (nw / 2);
    final ry = ddy.abs() / (nh / 2);
    if (rx >= ry) {
      return ddx > 0 ? Offset(nx + nw, cy) : Offset(nx, cy);
    } else {
      return ddy > 0 ? Offset(cx, ny + nh) : Offset(cx, ny);
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (map.nodes.isEmpty) return;

    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF0e1429),
    );

    const gs = 16.0;
    final dotPaint = Paint()..color = const Color(0xFF2a2a3a)..style = PaintingStyle.fill;
    for (double gx = gs; gx < size.width; gx += gs) {
      for (double gy = gs; gy < size.height; gy += gs) {
        canvas.drawCircle(Offset(gx, gy), 0.7, dotPaint);
      }
    }

    double minX = double.infinity, minY = double.infinity;
    double maxX = double.negativeInfinity, maxY = double.negativeInfinity;
    for (final n in map.nodes) {
      final w = n.width > 10 ? n.width : 140.0;
      final h = n.height > 10 ? n.height : 60.0;
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + w > maxX) maxX = n.x + w;
      if (n.y + h > maxY) maxY = n.y + h;
    }

    final contentW = maxX - minX;
    final contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;

    const pad = 14.0;
    final scale = min(
      (size.width - pad * 2) / contentW,
      (size.height - pad * 2) / contentH,
    );
    final offX = (size.width - contentW * scale) / 2 - minX * scale;
    final offY = (size.height - contentH * scale) / 2 - minY * scale;

    final edgePaint = Paint()
      ..strokeWidth = max(0.6, 1.2 * scale)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final nodeMap = {for (final n in map.nodes) n.id: n};
    for (final e in map.edges) {
      final src = nodeMap[e.source];
      final tgt = nodeMap[e.target];
      if (src == null || tgt == null) continue;
      final sw = src.width > 10 ? src.width : 140.0;
      final sh = src.height > 10 ? src.height : 60.0;
      final tw = tgt.width > 10 ? tgt.width : 140.0;
      final th = tgt.height > 10 ? tgt.height : 60.0;

      final tgtCenter = Offset(tgt.x + tw / 2, tgt.y + th / 2);
      final srcCenter = Offset(src.x + sw / 2, src.y + sh / 2);
      final srcExit = _borderExit(src.x, src.y, sw, sh, tgtCenter);
      final tgtExit = _borderExit(tgt.x, tgt.y, tw, th, srcCenter);

      final sx = srcExit.dx * scale + offX;
      final sy = srcExit.dy * scale + offY;
      final ex = tgtExit.dx * scale + offX;
      final ey = tgtExit.dy * scale + offY;

      edgePaint.color = _hex(e.strokeColor).withOpacity(0.70);
      final path = Path()
        ..moveTo(sx, sy)
        ..cubicTo(sx, (sy + ey) / 2, ex, (sy + ey) / 2, ex, ey);
      canvas.drawPath(path, edgePaint);
    }

    for (final node in map.nodes) {
      final w = (node.width > 10 ? node.width : 140.0) * scale;
      final h = (node.height > 10 ? node.height : 60.0) * scale;
      final x = node.x * scale + offX;
      final y = node.y * scale + offY;
      final stroke = _hex(node.strokeColor);

      final Color fillColor;
      if (node.fillColor.isNotEmpty &&
          node.fillColor != '#ffffff' &&
          node.fillColor != 'transparent') {
        fillColor = _hex(node.fillColor).withOpacity(0.75);
      } else {
        fillColor = stroke.withOpacity(0.12);
      }

      final shapeId = node.shape.isNotEmpty ? node.shape : 'roundedRect';
      canvas.save();
      canvas.translate(x, y);
      final path = shapePath(shapeId, w, h);
      canvas.drawPath(path, Paint()..color = fillColor);
      canvas.drawPath(path, Paint()
        ..color = stroke.withOpacity(0.90)
        ..strokeWidth = max(0.6, 1.2 * scale)
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round);

      if (w > 18 && h > 10) {
        final tp = TextPainter(
          text: TextSpan(
            text: node.label,
            style: TextStyle(
              color: Colors.white.withOpacity(0.90),
              fontSize: max(5.0, min(10.0, (node.fontSize > 0 ? node.fontSize : 12) * scale)),
              fontWeight: node.fontWeight == 'bold' ? FontWeight.bold : FontWeight.w500,
            ),
          ),
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.center,
          maxLines: 1,
          ellipsis: '…',
        );
        tp.layout(maxWidth: w - 4);
        tp.paint(canvas, Offset((w - tp.width) / 2, (h - tp.height) / 2));
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant MapPreviewPainter old) => old.map != map;
}

/// Displays a mind-map preview: base64 PNG (matches web `<img src={thumbnail}>`)
/// if available, else a painter fallback, else an icon placeholder.
class MapThumbnail extends StatefulWidget {
  final MindMapModel map;
  final Color accent;
  final bool compact;

  const MapThumbnail({
    super.key,
    required this.map,
    required this.accent,
    this.compact = false,
  });

  @override
  State<MapThumbnail> createState() => _MapThumbnailState();
}

class _MapThumbnailState extends State<MapThumbnail> {
  MemoryImage? _imageProvider;
  String? _lastRaw;

  @override
  void initState() {
    super.initState();
    _decode();
  }

  @override
  void didUpdateWidget(covariant MapThumbnail old) {
    super.didUpdateWidget(old);
    if (old.map.thumbnail != widget.map.thumbnail) {
      _decode();
    }
  }

  void _decode() {
    final raw = widget.map.thumbnail;
    if (raw == _lastRaw) return;
    _lastRaw = raw;
    final bytes = decodeMapThumbnail(raw);
    _imageProvider = bytes != null ? MemoryImage(bytes) : null;
  }

  @override
  Widget build(BuildContext context) {
    if (_imageProvider != null) {
      return Image(
        image: _imageProvider!,
        fit: BoxFit.cover,
        gaplessPlayback: true,
        filterQuality: FilterQuality.medium,
        errorBuilder: (_, __, ___) => _fallback(context),
      );
    }
    return _fallback(context);
  }

  Widget _fallback(BuildContext context) {
    if (widget.map.nodes.isEmpty) {
      if (widget.compact) {
        return Center(child: Icon(Icons.account_tree_rounded, color: widget.accent, size: 22));
      }
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.account_tree_rounded, size: 32, color: widget.accent.withOpacity(0.6)),
            const SizedBox(height: 6),
            Text('Empty map',
                style: TextStyle(fontSize: 11, color: widget.accent.withOpacity(0.5))),
          ],
        ),
      );
    }
    return CustomPaint(
      painter: MapPreviewPainter(map: widget.map),
      child: const SizedBox.expand(),
    );
  }
}
