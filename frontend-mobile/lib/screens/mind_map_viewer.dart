import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../models/mind_map_model.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/mind_map_shapes.dart';
import '../widgets/mindmap_buddy_sheet.dart';

// ── Pastel accent palette — matches Mindmaps / Courses ─────────────────────
const _kSlateBlue = Color(0xFF7C93C5);
const _kLavender = Color(0xFFA79FCD);
const _kMutedRose = Color(0xFFC99999);

class MindMapViewerScreen extends StatefulWidget {
  final MindMapModel mindMap;
  const MindMapViewerScreen({super.key, required this.mindMap});
  @override
  State<MindMapViewerScreen> createState() => _MindMapViewerScreenState();
}

class _MindMapViewerScreenState extends State<MindMapViewerScreen> {
  late double _minX, _minY, _maxX, _maxY, _width, _height;
  final TransformationController _transformCtrl = TransformationController();
  bool _exporting = false;
  Size? _lastScreen;

  // Social state — only relevant for unlisted/public maps. We initialise from
  // the model's snapshot counts and let optimistic toggles drive the UI.
  late int _likeCount = widget.mindMap.likeCount;
  late int _commentCount = widget.mindMap.commentCount;
  bool _liked = false;
  bool _likeBusy = false;

  bool get _socialEnabled =>
      widget.mindMap.visibility != MapVisibility.private;

  @override
  void initState() {
    super.initState();
    _calcBounds();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fitView());
  }

  @override
  void dispose() {
    _transformCtrl.dispose();
    super.dispose();
  }

  void _calcBounds() {
    if (widget.mindMap.nodes.isEmpty) {
      _minX = 0; _minY = 0; _maxX = 800; _maxY = 600; _width = 800; _height = 600;
      return;
    }
    _minX = double.infinity; _minY = double.infinity;
    _maxX = double.negativeInfinity; _maxY = double.negativeInfinity;
    for (var n in widget.mindMap.nodes) {
      final nw = n.width > 10 ? n.width : 140.0;
      final nh = n.height > 10 ? n.height : 60.0;
      if (n.x < _minX) _minX = n.x;
      if (n.y < _minY) _minY = n.y;
      if (n.x + nw > _maxX) _maxX = n.x + nw;
      if (n.y + nh > _maxY) _maxY = n.y + nh;
    }
    _minX -= 80; _minY -= 80; _maxX += 80; _maxY += 80;
    _width = _maxX - _minX; _height = _maxY - _minY;
  }

  void _fitView() {
    if (!mounted) return;
    final screen = MediaQuery.of(context).size;
    _lastScreen = screen;
    final appBarH = kToolbarHeight + MediaQuery.of(context).padding.top;
    final availH = screen.height - appBarH;
    final scaleX = screen.width / _width;
    final scaleY = availH / _height;
    // Fit entire map — scale adapts to map size. Allow zoom-in for small maps
    // up to 1.5x so they fill the viewport nicely.
    final scale = min(1.5, min(scaleX, scaleY) * 0.92);
    final tx = (screen.width - _width * scale) / 2;
    final ty = (availH - _height * scale) / 2 + appBarH;
    _transformCtrl.value = Matrix4.identity()
      ..scale(scale)
      ..translate(tx / scale, ty / scale);
  }

  void _resetView() {
    HapticFeedback.lightImpact();
    _fitView();
  }

  void _zoomBy(double factor) {
    HapticFeedback.selectionClick();
    final m = _transformCtrl.value.clone();
    final currentScale = m.getMaxScaleOnAxis();
    final newScale = (currentScale * factor).clamp(0.1, 3.0);
    final effective = newScale / currentScale;
    if (effective == 1.0) return;

    // Zoom around viewport center for smooth in/out
    final screen = MediaQuery.of(context).size;
    final appBarH = kToolbarHeight + MediaQuery.of(context).padding.top;
    final cx = screen.width / 2;
    final cy = (screen.height - appBarH) / 2 + appBarH;

    m.translate(cx, cy);
    m.scale(effective, effective);
    m.translate(-cx, -cy);
    _transformCtrl.value = m;
  }


  void _showShareCode() {
    final code = widget.mindMap.shareCode;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              decoration: BoxDecoration(
                color: _cPanel.withOpacity(0.92),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.black.withOpacity(0.06)),
                gradient: LinearGradient(
                  colors: [_kSlateBlue.withOpacity(0.08), Colors.transparent],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              padding: const EdgeInsets.fromLTRB(24, 14, 24, 28),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.black.withOpacity(0.12), borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          Container(width: 48, height: 48, decoration: BoxDecoration(color: _kSlateBlue.withOpacity(0.14), borderRadius: BorderRadius.circular(12), border: Border.all(color: _kSlateBlue.withOpacity(0.30))),
            child: const Icon(Icons.share_rounded, color: _kSlateBlue, size: 24)),
          const SizedBox(height: 12),
          const Text('Share Code', style: TextStyle(color: _cTxtPri, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Share this code so others can view your map', style: TextStyle(color: _cTxtSec, fontSize: 13), textAlign: TextAlign.center),
          const SizedBox(height: 20),
          if (code.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(color: _kSlateBlue.withOpacity(0.10), borderRadius: BorderRadius.circular(14), border: Border.all(color: _kSlateBlue.withOpacity(0.30))),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(code, style: const TextStyle(color: _kSlateBlue, fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 3)),
                const SizedBox(width: 12),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: code));
                    HapticFeedback.selectionClick();
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: const Text('Share code copied!'), backgroundColor: _kSlateBlue, behavior: SnackBarBehavior.floating, margin: const EdgeInsets.fromLTRB(20, 0, 20, 80)));
                  },
                  child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: _kSlateBlue.withOpacity(0.16), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.copy_rounded, size: 18, color: _kSlateBlue)),
                ),
              ]),
            ),
            const SizedBox(height: 16),
            SizedBox(width: double.infinity, child: ElevatedButton.icon(
              onPressed: () async { Navigator.pop(ctx); await Share.share('Check out my mind map "${widget.mindMap.title}"! Share code: $code'); },
              icon: const Icon(Icons.ios_share_rounded), label: const Text('Share via...'), style: AppTheme.gradientButtonStyle(),
            )),
          ] else const Text('No share code available', style: TextStyle(color: _cTxtSec, fontSize: 13)),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _exportToPng() async {
    if (widget.mindMap.nodes.isEmpty || _exporting) return;
    HapticFeedback.mediumImpact();
    setState(() => _exporting = true);
    try {
      double minX = double.infinity, minY = double.infinity;
      double maxX = double.negativeInfinity, maxY = double.negativeInfinity;
      for (final n in widget.mindMap.nodes) {
        final nw = n.width > 10 ? n.width : 140.0;
        final nh = n.height > 10 ? n.height : 60.0;
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + nw > maxX) maxX = n.x + nw;
        if (n.y + nh > maxY) maxY = n.y + nh;
      }
      const pad = 60.0;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
      final contentW = maxX - minX, contentH = maxY - minY;
      const maxSize = 1800.0;
      final scale = min(maxSize / contentW, maxSize / contentH);
      final imgW = (contentW * scale).ceil(), imgH = (contentH * scale).ceil();

      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, imgW.toDouble(), imgH.toDouble()));
      canvas.drawRect(Rect.fromLTWH(0, 0, imgW.toDouble(), imgH.toDouble()), Paint()..color = const Color(0xFFF8F9FB));

      // Edges
      final nodeMap = {for (final n in widget.mindMap.nodes) n.id: n};
      for (final e in widget.mindMap.edges) {
        final s = nodeMap[e.source], t = nodeMap[e.target];
        if (s == null || t == null) continue;
        final color = _parseHex(e.strokeColor, Colors.indigo);
        final ep = Paint()
          ..color = color.withOpacity(0.8)
          ..strokeWidth = e.strokeWidth * scale
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round;
        final sw = s.width > 10 ? s.width : 140.0;
        final sh = s.height > 10 ? s.height : 60.0;
        final tw = t.width > 10 ? t.width : 140.0;
        final th = t.height > 10 ? t.height : 60.0;
        final sx = (s.x + sw / 2 - minX) * scale;
        final sy = (s.y + sh / 2 - minY) * scale;
        final tx = (t.x + tw / 2 - minX) * scale;
        final ty = (t.y + th / 2 - minY) * scale;
        final path = Path()..moveTo(sx, sy)..cubicTo(sx, (sy + ty) / 2, tx, (sy + ty) / 2, tx, ty);
        canvas.drawPath(path, ep);
        // Arrow
        final angle = atan2(ty - sy, tx - sx);
        final as2 = 10.0 * scale;
        canvas.drawPath(
          Path()..moveTo(tx, ty)..lineTo(tx - as2 * cos(angle - 0.4), ty - as2 * sin(angle - 0.4))..lineTo(tx - as2 * cos(angle + 0.4), ty - as2 * sin(angle + 0.4))..close(),
          Paint()..color = color.withOpacity(0.8),
        );
      }

      // Nodes — draw actual shapes
      for (final node in widget.mindMap.nodes) {
        final nw = node.width > 10 ? node.width : 140.0;
        final nh = node.height > 10 ? node.height : 60.0;
        final x = (node.x - minX) * scale;
        final y = (node.y - minY) * scale;
        final w = nw * scale;
        final h = nh * scale;
        canvas.save();
        canvas.translate(x, y);
        final path = shapePath(node.shape.isNotEmpty ? node.shape : 'roundedRect', w, h);
        final strokeColor = _parseHex(node.strokeColor, Colors.indigo);
        final fill = strokeColor.withOpacity(0.08);
        canvas.drawPath(path, Paint()..color = fill);
        canvas.drawPath(path, Paint()
          ..color = strokeColor
          ..strokeWidth = node.strokeWidth * scale
          ..style = PaintingStyle.stroke
          ..strokeJoin = StrokeJoin.round);
        // Text
        final tp = TextPainter(
          text: TextSpan(text: node.label, style: TextStyle(
            color: const Color(0xFF1e293b),
            fontSize: (node.fontSize > 0 ? node.fontSize : 13) * scale,
            fontWeight: node.fontWeight == 'bold' ? FontWeight.bold : FontWeight.w500,
            fontStyle: node.fontStyle == 'italic' ? FontStyle.italic : FontStyle.normal,
          )),
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.center,
        );
        tp.layout(maxWidth: w * 0.8);
        tp.paint(canvas, Offset((w - tp.width) / 2, (h - tp.height) / 2));
        canvas.restore();
      }

      final picture = recorder.endRecording();
      final image = await picture.toImage(imgW, imgH);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      final bytes = Uint8List.view(byteData!.buffer);
      final dir = await getTemporaryDirectory();
      final fileName = '${widget.mindMap.title.replaceAll(RegExp(r'[^\w\s]'), '').replaceAll(' ', '_')}.png';
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)], text: widget.mindMap.title);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export failed: $e'), backgroundColor: _kMutedRose));
    }
    if (mounted) setState(() => _exporting = false);
  }

  static Color _parseHex(String hex, Color fallback) {
    try {
      final h = hex.replaceAll('#', '');
      return Color(int.parse(h.length == 6 ? 'FF$h' : h, radix: 16));
    } catch (_) {
      return fallback;
    }
  }

  // ── Likes + comments ──────────────────────────────────────────────────────
  //
  // Web's LikeButton optimistically flips locally and trusts the server's
  // returned count (`{ok, already_liked, like_count}`) as the authority. We
  // mirror that here. The backend only writes a notification on the FIRST
  // like (subsequent toggles are idempotent), so spamming the heart is fine.

  Future<void> _toggleLike() async {
    if (_likeBusy) return;
    HapticFeedback.lightImpact();
    final mapId = widget.mindMap.id;
    final wasLiked = _liked;
    setState(() {
      _liked = !wasLiked;
      _likeCount += wasLiked ? -1 : 1;
      _likeBusy = true;
    });
    try {
      final resp = wasLiked
          ? await ApiService.unlikeMap(mapId)
          : await ApiService.likeMap(mapId);
      if (!mounted) return;
      // Trust the server count when present (covers the "already liked /
      // wasn't liked" edge cases without forcing a full refetch).
      final serverCount = resp['like_count'];
      setState(() {
        if (serverCount is int) _likeCount = serverCount;
        if (resp['already_liked'] == true) _liked = true;
        if (resp['was_liked'] == false) _liked = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _liked = wasLiked;
        _likeCount += wasLiked ? 1 : -1;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t update like — try again.')),
      );
    } finally {
      if (mounted) setState(() => _likeBusy = false);
    }
  }

  void _openComments() {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CommentsSheet(
        mapId: widget.mindMap.id,
        onCountChanged: (n) {
          if (mounted) setState(() => _commentCount = n);
        },
      ),
    );
  }

  Widget _buildSocialBar() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.85),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: Colors.black.withOpacity(0.08)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.08),
                blurRadius: 12,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _socialPill(
                icon: _liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                tint: AppColors.pink,
                count: _likeCount,
                onTap: _toggleLike,
                active: _liked,
              ),
              const SizedBox(width: 4),
              _socialPill(
                icon: Icons.mode_comment_outlined,
                tint: AppColors.cyan,
                count: _commentCount,
                onTap: _openComments,
                active: false,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _socialPill({
    required IconData icon,
    required Color tint,
    required int count,
    required VoidCallback onTap,
    required bool active,
  }) {
    return Material(
      color: Colors.transparent,
      shape: const StadiumBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const StadiumBorder(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: active ? tint : Colors.black87),
              const SizedBox(width: 4),
              Text(
                '$count',
                style: TextStyle(
                  color: active ? tint : Colors.black87,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Light theme constants — clean light canvas ────────────────────────────
  static const _cCanvas  = Color(0xFFF8F9FB);
  static const _cPanel   = Color(0xFFFFFFFF);
  static const _cGrid    = Color(0xFFCED4E0);
  static const _cTxtPri  = Color(0xFF1A1F36);
  static const _cTxtSec  = Color(0xFF5A6278);

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final mediaTop = MediaQuery.of(context).padding.top;

    // Re-fit when viewport changes (orientation/resize)
    final currentScreen = MediaQuery.of(context).size;
    if (_lastScreen != null && _lastScreen != currentScreen) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fitView());
    }

    return Scaffold(
      backgroundColor: _cCanvas,
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(kToolbarHeight + mediaTop),
        child: _buildGlassAppBar(mediaTop),
      ),
      body: Stack(children: [
        // ── Canvas ──
        Positioned.fill(
          child: InteractiveViewer(
            transformationController: _transformCtrl,
            constrained: false,
            boundaryMargin: const EdgeInsets.all(double.infinity),
            minScale: 0.1, maxScale: 3.0,
            child: SizedBox(
              width: _width, height: _height,
              child: CustomPaint(
                painter: GridPatternPainter(gridSize: 20, dotColor: _cGrid),
                child: Stack(children: [
                  Positioned.fill(child: CustomPaint(
                    painter: MindMapEdgePainter(edges: _buildEdgePaintData()),
                  )),
                  for (var node in widget.mindMap.nodes)
                    Positioned(
                      left: node.x - _minX,
                      top: node.y - _minY,
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          _showNodeDetail(node, c);
                        },
                        child: _buildViewerNode(node),
                      ),
                    ),
                ]),
              ),
            ),
          ),
        ),
        // ── Info chip (top-left overlay) ──
        Positioned(
          top: mediaTop + kToolbarHeight + 12,
          left: 16,
          child: _buildInfoChip(),
        ),
        // ── Floating zoom / fit controls (bottom-right) ──
        Positioned(
          right: 16,
          bottom: 20 + MediaQuery.of(context).padding.bottom,
          child: _buildZoomControls(),
        ),
        // ── Like + comment social bar (bottom-left). Only on non-private
        //    maps; private maps have no audience to react. ──
        if (_socialEnabled)
          Positioned(
            left: 16,
            bottom: 20 + MediaQuery.of(context).padding.bottom,
            child: _buildSocialBar(),
          ),
      ]),
    );
  }

  // ── Glass AppBar ────────────────────────────────────────────────────────────
  Widget _buildGlassAppBar(double mediaTop) {
    return ClipRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: EdgeInsets.only(top: mediaTop),
          height: kToolbarHeight + mediaTop,
          decoration: BoxDecoration(
            color: _cPanel.withOpacity(0.72),
            border: Border(
              bottom: BorderSide(color: Colors.black.withOpacity(0.06)),
            ),
          ),
          child: Row(children: [
            IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: _cTxtPri),
              onPressed: () => Navigator.of(context).maybePop(),
              tooltip: 'Back',
            ),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.mindMap.title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _cTxtPri,
                          fontSize: 16,
                          letterSpacing: -0.2),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text(
                    '${widget.mindMap.nodes.length} node${widget.mindMap.nodes.length == 1 ? '' : 's'}  •  ${widget.mindMap.edges.length} edge${widget.mindMap.edges.length == 1 ? '' : 's'}',
                    style: const TextStyle(color: _cTxtSec, fontSize: 11),
                  ),
                ],
              ),
            ),
            _appBarAction(
              icon: Icons.auto_awesome_rounded,
              tint: _kLavender,
              tooltip: 'AI Buddy',
              onTap: () {
                HapticFeedback.lightImpact();
                MindmapBuddySheet.show(context, widget.mindMap.id);
              },
              filled: true,
            ),
            _appBarAction(
              icon: Icons.share_rounded,
              tint: _cTxtSec,
              tooltip: 'Share Code',
              onTap: _showShareCode,
            ),
            if (_exporting)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 14),
                child: SizedBox(
                  width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _kSlateBlue),
                ),
              )
            else
              _appBarAction(
                icon: Icons.download_rounded,
                tint: _cTxtSec,
                tooltip: 'Export PNG',
                onTap: _exportToPng,
              ),
            const SizedBox(width: 4),
          ]),
        ),
      ),
    );
  }

  Widget _appBarAction({
    required IconData icon,
    required Color tint,
    required String tooltip,
    required VoidCallback onTap,
    bool filled = false,
  }) {
    return Tooltip(
      message: tooltip,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: InkResponse(
          onTap: onTap,
          radius: 22,
          child: Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              color: filled
                  ? tint.withOpacity(0.15)
                  : Colors.white.withOpacity(0.55),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(
                color: filled
                    ? tint.withOpacity(0.30)
                    : Colors.black.withOpacity(0.06),
              ),
            ),
            child: Icon(icon, color: tint, size: 18),
          ),
        ),
      ),
    );
  }

  // ── Top-left canvas info chip ──────────────────────────────────────────────
  Widget _buildInfoChip() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.72),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.black.withOpacity(0.06)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.account_tree_rounded, size: 12, color: _kSlateBlue),
            const SizedBox(width: 6),
            Text('${widget.mindMap.nodes.length}',
                style: const TextStyle(
                    color: _cTxtPri, fontSize: 11, fontWeight: FontWeight.w600)),
            const SizedBox(width: 10),
            const Icon(Icons.timeline_rounded, size: 12, color: _kLavender),
            const SizedBox(width: 6),
            Text('${widget.mindMap.edges.length}',
                style: const TextStyle(
                    color: _cTxtPri, fontSize: 11, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }

  // ── Floating zoom / fit controls (bottom-right) ───────────────────────────
  Widget _buildZoomControls() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.72),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.black.withOpacity(0.06)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            _zoomBtn(Icons.add_rounded, 'Zoom in', () => _zoomBy(1.2)),
            Container(
              width: 24, height: 1,
              color: Colors.black.withOpacity(0.06),
            ),
            _zoomBtn(Icons.remove_rounded, 'Zoom out', () => _zoomBy(1 / 1.2)),
            Container(
              width: 24, height: 1,
              color: Colors.black.withOpacity(0.06),
            ),
            _zoomBtn(
              Icons.center_focus_strong_rounded,
              'Fit view',
              _resetView,
              tint: _kSlateBlue,
            ),
          ]),
        ),
      ),
    );
  }

  Widget _zoomBtn(IconData icon, String tip, VoidCallback onTap,
      {Color tint = _cTxtPri}) {
    return Tooltip(
      message: tip,
      child: InkResponse(
        onTap: onTap,
        radius: 22,
        child: SizedBox(
          width: 44, height: 44,
          child: Icon(icon, color: tint, size: 19),
        ),
      ),
    );
  }

  List<EdgePaintData> _buildEdgePaintData() {
    final nodeMap = {for (final n in widget.mindMap.nodes) n.id: n};
    return widget.mindMap.edges.map((e) {
      final s = nodeMap[e.source], t = nodeMap[e.target];
      if (s == null || t == null) return null;
      final tgtCenter = Offset(t.x + (t.width > 10 ? t.width : 140.0) / 2, t.y + (t.height > 10 ? t.height : 60.0) / 2);
      final srcCenter = Offset(s.x + (s.width > 10 ? s.width : 140.0) / 2, s.y + (s.height > 10 ? s.height : 60.0) / 2);
      final src = _borderExit(s, tgtCenter);
      final tgt = _borderExit(t, srcCenter);
      return EdgePaintData(
        sourceId: e.source, targetId: e.target,
        sx: src.dx - _minX, sy: src.dy - _minY,
        tx: tgt.dx - _minX, ty: tgt.dy - _minY,
        strokeColor: _parseHex(e.strokeColor, Colors.indigo),
        strokeWidth: e.strokeWidth,
        edgeType: e.type,
        targetArrow: e.targetArrow,
        strokeDash: e.strokeDasharray,
        label: e.label,
        arrowSize: e.arrowSize,
      );
    }).whereType<EdgePaintData>().toList();
  }

  static Offset _borderExit(ReactFlowNode node, Offset toward) {
    final w = node.width > 10 ? node.width : 140.0;
    final h = node.height > 10 ? node.height : 60.0;
    final cx = node.x + w / 2;
    final cy = node.y + h / 2;
    final dx = toward.dx - cx;
    final dy = toward.dy - cy;
    if (dx == 0 && dy == 0) return Offset(cx, cy);
    final nx = dx.abs() / (w / 2);
    final ny = dy.abs() / (h / 2);
    if (nx >= ny) {
      return dx > 0 ? Offset(node.x + w, cy) : Offset(node.x, cy);
    } else {
      return dy > 0 ? Offset(cx, node.y + h) : Offset(cx, node.y);
    }
  }

  Widget _buildViewerNode(ReactFlowNode node) {
    final nw = node.width > 10 ? node.width : 140.0;
    final nh = node.height > 10 ? node.height : 60.0;
    final strokeColor = _parseHex(node.strokeColor, _kSlateBlue);

    // Light canvas — prefer user's fill, default to white card with tinted stroke
    Color fillColor;
    if (node.fillColor.isNotEmpty && node.fillColor != 'transparent') {
      fillColor = _parseHex(node.fillColor, Colors.white);
    } else {
      fillColor = Colors.white;
    }

    // Dark text on light canvas unless explicitly overridden to a non-dark color
    Color textColor = const Color(0xFF1E293B);
    if (node.fontColor.isNotEmpty &&
        node.fontColor != '#ffffff' &&
        node.fontColor != '#f8fafc') {
      textColor = _parseHex(node.fontColor, const Color(0xFF1E293B));
    }

    final shapeId = node.shape.isNotEmpty ? node.shape : 'roundedRect';

    return ShapeNodeWidget(
      shape: shapeId,
      label: node.label,
      width: nw,
      height: nh,
      fillColor: fillColor,
      strokeColor: strokeColor,
      strokeWidth: node.strokeWidth,
      fontColor: textColor,
      fontSize: node.fontSize > 0 ? node.fontSize.clamp(10.0, 22.0) : 13,
      fontWeight: node.fontWeight,
      fontStyle: node.fontStyle,
      textAlign: node.textAlign,
      opacity: node.opacity,
      shadow: node.shadow,
    );
  }

  void _showNodeDetail(ReactFlowNode node, AppColorScheme c) {
    final borderColor = _parseHex(node.strokeColor, _kSlateBlue);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              decoration: BoxDecoration(
                color: _cPanel.withOpacity(0.92),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.black.withOpacity(0.06)),
                gradient: LinearGradient(
                  colors: [
                    borderColor.withOpacity(0.10),
                    Colors.transparent,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              padding: const EdgeInsets.fromLTRB(24, 14, 24, 28),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(
                    color: borderColor.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: borderColor.withOpacity(0.40)),
                  ),
                  child: Center(
                    child: ShapePreview(
                      shape: node.shape.isNotEmpty ? node.shape : 'roundedRect',
                      strokeColor: borderColor,
                      size: 26,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  node.label.isEmpty ? 'Untitled node' : node.label,
                  style: const TextStyle(
                    color: _cTxtPri,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.2,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (node.shape.isNotEmpty) _glassChip(Icons.category_rounded, node.shape),
                    _glassChip(Icons.text_fields_rounded, '${node.fontSize.toInt()}px'),
                    if (node.fontWeight == 'bold') _glassChip(Icons.format_bold, 'Bold'),
                    if (node.fontStyle == 'italic') _glassChip(Icons.format_italic, 'Italic'),
                    _glassChip(
                      Icons.square_rounded,
                      node.strokeColor,
                      tint: borderColor,
                    ),
                  ],
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _glassChip(IconData icon, String label, {Color? tint}) {
    final color = tint ?? _cTxtSec;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.black.withOpacity(0.06)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(color: _cTxtPri, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

/// Bottom-sheet comments drawer. Mirrors the web `CommentsDrawer` — list
/// of comments newest-first, inline composer, optimistic add. The parent
/// screen reads `commentCount` via the `onCountChanged` callback so the
/// floating bar's count stays in sync without a refetch.
class _CommentsSheet extends StatefulWidget {
  final String mapId;
  final ValueChanged<int> onCountChanged;
  const _CommentsSheet({required this.mapId, required this.onCountChanged});

  @override
  State<_CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<_CommentsSheet> {
  final _ctrl = TextEditingController();
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _posting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.listMapComments(widget.mapId, limit: 100);
      if (!mounted) return;
      setState(() {
        _items = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
      widget.onCountChanged(_items.length);
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _posting) return;
    HapticFeedback.lightImpact();
    setState(() => _posting = true);
    try {
      final created = await ApiService.createMapComment(widget.mapId, text);
      if (!mounted) return;
      setState(() {
        _items = [Map<String, dynamic>.from(created), ..._items];
        _ctrl.clear();
      });
      widget.onCountChanged(_items.length);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t post your comment.')),
      );
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _delete(Map<String, dynamic> c) async {
    final id = (c['id'] ?? '').toString();
    if (id.isEmpty) return;
    final original = List<Map<String, dynamic>>.from(_items);
    setState(() => _items.removeWhere((x) => x['id'] == id));
    widget.onCountChanged(_items.length);
    try {
      await ApiService.deleteMapComment(widget.mapId, id);
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = original);
      widget.onCountChanged(_items.length);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t delete that comment.')),
      );
    }
  }

  String _timeAgo(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: mq.size.height * 0.78),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle + header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
              child: Column(
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.mode_comment_rounded,
                          size: 18, color: AppColors.cyan),
                      const SizedBox(width: 8),
                      Text(
                        'Comments (${_items.length})',
                        style: const TextStyle(
                          color: Colors.black87,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // List
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _items.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(28),
                            child: Text(
                              'No comments yet — be the first to say something.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.black54),
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          itemCount: _items.length,
                          separatorBuilder: (_, __) =>
                              const Divider(height: 18),
                          itemBuilder: (_, i) => _buildCommentTile(_items[i]),
                        ),
            ),
            const Divider(height: 1),
            // Composer
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      maxLines: 4,
                      minLines: 1,
                      textInputAction: TextInputAction.newline,
                      style: const TextStyle(color: Colors.black87, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Write a comment…',
                        hintStyle: const TextStyle(color: Colors.black38),
                        filled: true,
                        fillColor: Colors.black.withOpacity(0.04),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton(
                    onPressed: _posting ? null : _submit,
                    icon: _posting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded,
                            color: AppColors.cyan),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCommentTile(Map<String, dynamic> c) {
    final author = (c['author_name'] ?? c['user_name'] ?? 'Anonymous').toString();
    final text = (c['text'] ?? '').toString();
    final created = (c['created_at'] ?? '').toString();
    final isMine = c['is_mine'] == true || c['can_delete'] == true;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: AppColors.purple.withOpacity(0.15),
          child: Text(
            author.isNotEmpty ? author[0].toUpperCase() : '?',
            style: const TextStyle(
              color: AppColors.purple,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    author,
                    style: const TextStyle(
                      color: Colors.black87,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _timeAgo(created),
                    style: const TextStyle(color: Colors.black45, fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(text,
                  style: const TextStyle(color: Colors.black87, fontSize: 13)),
            ],
          ),
        ),
        if (isMine)
          IconButton(
            onPressed: () => _delete(c),
            icon: const Icon(Icons.delete_outline_rounded,
                size: 18, color: Colors.black38),
          ),
      ],
    );
  }
}
