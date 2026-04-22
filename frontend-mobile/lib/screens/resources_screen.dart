import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';
import '../widgets/confirmation_dialog.dart';
import 'ai_summary_viewer.dart';
import 'ai_flashcard_viewer.dart';
import 'ai_practice_quiz_screen.dart';

// Pastel palette (shared with Courses / Subjects aesthetic)
const _pSlate     = Color(0xFF7C93C5);
const _pLavender  = Color(0xFFA79FCD);
const _pSeafoam   = Color(0xFF7BB5B0);
const _pPeach     = Color(0xFFD8A28E);
const _pSand      = Color(0xFFC9A86A);
const _pRose      = Color(0xFFC99999);
const _pSky       = Color(0xFF8BB5C9);
const _pSage      = Color(0xFF8FA68E);

class _ModuleData {
  final String id;
  final String title;
  final List<_ModuleItemData> items;
  _ModuleData({required this.id, required this.title, required this.items});
}

class _ModuleItemData {
  final String id;
  final String title;
  final String type;
  final String url;
  _ModuleItemData({required this.id, required this.title, required this.type, required this.url});
}

class _TypeMeta {
  final String value;
  final String label;
  final IconData icon;
  final Color color;
  final Color color2;
  /// Allowed upload extensions (empty = URL-only, no upload option)
  final List<String> uploadExts;
  /// Max upload size in bytes (0 if uploadExts empty)
  final int maxBytes;
  const _TypeMeta(
    this.value,
    this.label,
    this.icon,
    this.color,
    this.color2, {
    this.uploadExts = const [],
    this.maxBytes = 0,
  });

  bool get supportsUpload => uploadExts.isNotEmpty;
  String get maxSizeLabel {
    if (maxBytes == 0) return '';
    final mb = maxBytes ~/ (1024 * 1024);
    return '${mb}MB';
  }
}

const _kTypes = [
  _TypeMeta('link',     'Link',     Icons.link_rounded,            _pSlate,    _pSky),
  _TypeMeta('pdf',      'PDF',      Icons.picture_as_pdf_rounded,  _pRose,     _pPeach,
      uploadExts: ['pdf'],          maxBytes: 20 * 1024 * 1024), // 20 MB
  _TypeMeta('video',    'Video',    Icons.play_circle_rounded,     _pLavender, _pSlate),
  _TypeMeta('document', 'Document', Icons.description_rounded,     _pSeafoam,  _pSage,
      uploadExts: ['docx', 'pptx'], maxBytes: 15 * 1024 * 1024), // 15 MB
];

_TypeMeta _metaForType(String v) =>
    _kTypes.firstWhere((t) => t.value == v, orElse: () => _kTypes.first);

String _formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

// Per-module pastel accent picked from a hash — keeps each module visually distinct
const _kModulePalette = <List<Color>>[
  [_pSlate,    _pLavender],
  [_pLavender, _pSlate],
  [_pSeafoam,  _pSage],
  [_pPeach,    _pSand],
  [_pSky,      _pSlate],
  [_pSand,     _pPeach],
];

List<Color> _moduleAccent(String id) {
  if (id.isEmpty) return _kModulePalette.first;
  final idx = id.hashCode.abs() % _kModulePalette.length;
  return _kModulePalette[idx];
}

class ResourcesScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  final bool isLecturer;
  const ResourcesScreen({super.key, required this.courseId, required this.courseName, this.isLecturer = false});
  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> {
  bool _loading = true;
  String? _error;
  List<_ModuleData> _modules = [];
  final Set<String> _expanded = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await ApiService.getModules(widget.courseId);
      setState(() {
        _modules = raw.map((m) {
          final map = Map<String, dynamic>.from(m);
          final rawItems = (map['items'] as List?) ?? [];
          return _ModuleData(
            id: (map['id'] ?? '').toString(),
            title: (map['title'] ?? '').toString(),
            items: rawItems.map((item) {
              final itemMap = Map<String, dynamic>.from(item);
              return _ModuleItemData(
                id: (itemMap['id'] ?? '').toString(),
                title: (itemMap['title'] ?? '').toString(),
                type: (itemMap['type'] ?? 'link').toString(),
                url: (itemMap['url'] ?? '').toString(),
              );
            }).toList(),
          );
        }).toList();
        // Default: first module expanded
        if (_modules.isNotEmpty && _expanded.isEmpty) {
          _expanded.add(_modules.first.id);
        }
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  int get _totalItems =>
      _modules.fold(0, (sum, m) => sum + m.items.length);

  // ─── Open URL ──────────────────────────────────────────────────────────────

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Cannot open URL: $url'), backgroundColor: _pRose),
        );
      }
    }
  }

  // ─── Add / Edit Module sheet ───────────────────────────────────────────────

  Future<void> _showAddModuleSheet() async {
    final result = await showGlassBottomSheet<String>(
      context: context,
      builder: (ctx) => _AddModuleSheet(),
    );
    if (result != null && result.isNotEmpty) {
      try {
        await ApiService.createModule(widget.courseId, result);
        HapticFeedback.mediumImpact();
        await _load();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose));
      }
    }
  }

  // ─── Add Item sheet ────────────────────────────────────────────────────────

  Future<void> _showAddItemSheet(String moduleId, String moduleTitle) async {
    final result = await showGlassBottomSheet<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => _AddItemSheet(moduleTitle: moduleTitle),
    );
    if (result == null) return;

    final mode = result['mode'] as String? ?? 'url';
    try {
      if (mode == 'file') {
        // Show upload progress dialog
        if (!mounted) return;
        _showUploadingDialog(result['title'] as String);
        try {
          await ApiService.uploadModuleItem(
            courseId: widget.courseId,
            moduleId: moduleId,
            title: result['title'] as String,
            fileType: result['type'] as String,
            filePath: result['filePath'] as String,
          );
        } finally {
          if (mounted) Navigator.pop(context);
        }
      } else {
        await ApiService.createModuleItem(
          widget.courseId,
          moduleId,
          result['title'] as String,
          type: result['type'] as String,
          url: result['url'] as String,
        );
      }
      HapticFeedback.mediumImpact();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose),
        );
      }
    }
  }

  void _showUploadingDialog(String fileName) {
    final c = context.colors;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: context.isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.white.withValues(alpha: 0.80),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: context.isDark
                      ? Colors.white.withValues(alpha: 0.12)
                      : Colors.black.withValues(alpha: 0.06),
                ),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const SizedBox(
                  width: 22, height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: _pSlate),
                ),
                const SizedBox(width: 14),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Uploading…',
                          style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(fileName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: c.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  // ─── Confirmations ─────────────────────────────────────────────────────────

  Future<void> _confirmDeleteModule(String moduleId, String title) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Module',
      message: 'Delete "$title" and all its items?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok == true) {
      try {
        await ApiService.deleteModule(widget.courseId, moduleId);
        await _load();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose));
      }
    }
  }

  Future<void> _confirmDeleteItem(String moduleId, String itemId, String title) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Item',
      message: 'Delete "$title"?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok == true) {
      try {
        await ApiService.deleteModuleItem(widget.courseId, moduleId, itemId);
        await _load();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose));
      }
    }
  }

  Future<void> _generateAiMaterial(String resourceId, String type) async {
    final c = context.colors;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: context.isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.white.withValues(alpha: 0.80),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: context.isDark
                      ? Colors.white.withValues(alpha: 0.12)
                      : Colors.black.withValues(alpha: 0.06),
                ),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: _pLavender),
                ),
                const SizedBox(width: 14),
                Text('Generating $type…', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        ),
      ),
    );

    try {
      final result = await ApiService.aiGenerateStudyMaterial(resourceId, type, widget.courseId);
      if (!mounted) return;
      Navigator.pop(context);

      final material = result['material'] ?? result;
      final content = material['content'];

      if (type == 'summary') {
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => AiSummaryViewer(
            title: material['title']?.toString() ?? 'Summary',
            content: content?.toString() ?? '',
          ),
        ));
      } else if (type == 'flashcards') {
        final cards = (content is List) ? content : [];
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => AiFlashcardViewer(
            title: material['title']?.toString() ?? 'Flashcards',
            cards: cards.map((c) => Map<String, dynamic>.from(c)).toList(),
          ),
        ));
      } else if (type == 'quiz') {
        final questions = (content is List) ? content : [];
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => AiPracticeQuizScreen(
            title: material['title']?.toString() ?? 'Practice Quiz',
            questions: questions.map((q) => Map<String, dynamic>.from(q)).toList(),
          ),
        ));
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to generate: $e'), backgroundColor: _pRose),
      );
    }
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppBackground(
      applySafeArea: false,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          foregroundColor: c.textPrimary,
          scrolledUnderElevation: 0,
          titleSpacing: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Resources',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
              Text(widget.courseName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: c.textMuted, fontWeight: FontWeight.w500)),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: IconButton(
                icon: Icon(Icons.refresh_rounded, color: c.textSecondary),
                onPressed: _load,
                tooltip: 'Refresh',
              ),
            ),
          ],
        ),
        floatingActionButton: widget.isLecturer ? _buildFab() : null,
        body: _loading
            ? const SkeletonList(itemCount: 5)
            : _error != null
                ? _buildError()
                : RefreshIndicator(
                    onRefresh: _load,
                    color: _pSlate,
                    child: _modules.isEmpty ? _buildEmpty() : _buildList(),
                  ),
      ),
    );
  }

  Widget _buildFab() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_pSlate, _pLavender],
        ),
        boxShadow: [
          BoxShadow(
            color: _pSlate.withValues(alpha: 0.35),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: _showAddModuleSheet,
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.create_new_folder_rounded, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text('Add Module',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, letterSpacing: -0.1)),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _buildError() {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: _pRose, size: 48),
            const SizedBox(height: 12),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textSecondary)),
            const SizedBox(height: 16),
            _PastelButton(
              label: 'Retry',
              icon: Icons.refresh_rounded,
              onTap: _load,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.12),
        EmptyState(
          icon: Icons.folder_open_rounded,
          title: widget.isLecturer ? 'Build your resource library' : 'No resources yet',
          subtitle: widget.isLecturer
              ? 'Create modules and add lecture notes, videos, or links for your students.'
              : 'Course materials will appear here once your lecturer adds them.',
          action: widget.isLecturer
              ? _PastelButton(
                  icon: Icons.create_new_folder_rounded,
                  label: 'Create First Module',
                  onTap: _showAddModuleSheet,
                )
              : null,
        ),
      ],
    );
  }

  Widget _buildList() {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          sliver: SliverToBoxAdapter(child: _buildSummaryHeader()),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
          sliver: SliverList.builder(
            itemCount: _modules.length,
            itemBuilder: (_, i) => AnimationConfiguration.staggeredList(
              position: i,
              duration: const Duration(milliseconds: 380),
              child: SlideAnimation(
                verticalOffset: 18,
                child: FadeInAnimation(
                  child: AnimatedListItem(
                    index: i,
                    child: _buildModuleCard(_modules[i]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ─── Summary header ────────────────────────────────────────────────────────

  Widget _buildSummaryHeader() {
    final c = context.colors;
    return GlassCard(
      padding: EdgeInsets.zero,
      child: Stack(children: [
        // Soft gradient wash (top-right corner)
        Positioned(
          right: 0, top: 0,
          child: Container(
            width: 160, height: 110,
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.only(topRight: Radius.circular(16)),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  _pSlate.withValues(alpha: 0.00),
                  _pLavender.withValues(alpha: 0.16),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_pSlate, _pLavender],
                ),
                boxShadow: [
                  BoxShadow(
                    color: _pSlate.withValues(alpha: 0.28),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: const Icon(Icons.menu_book_rounded, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Course Library',
                      style: TextStyle(color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
                  const SizedBox(height: 2),
                  Text(
                    '${_modules.length} module${_modules.length == 1 ? '' : 's'} · $_totalItems item${_totalItems == 1 ? '' : 's'}',
                    style: TextStyle(color: c.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
            if (widget.isLecturer)
              _PastelIconButton(
                icon: Icons.add_rounded,
                tint: _pSlate,
                onTap: _showAddModuleSheet,
                tooltip: 'Add module',
              ),
          ]),
        ),
      ]),
    );
  }

  // ─── Module card ───────────────────────────────────────────────────────────

  Widget _buildModuleCard(_ModuleData module) {
    final c = context.colors;
    final accent = _moduleAccent(module.id);
    final c1 = accent[0];
    final c2 = accent[1];
    final expanded = _expanded.contains(module.id);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header — tap toggles expansion
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() {
                  if (expanded) {
                    _expanded.remove(module.id);
                  } else {
                    _expanded.add(module.id);
                  }
                });
              },
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 8, 14),
                child: Row(children: [
                  // Folder glyph
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [c1, c2],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: c1.withValues(alpha: 0.28),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.folder_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          module.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.1,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: c1.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: c1.withValues(alpha: 0.22)),
                            ),
                            child: Text(
                              '${module.items.length} item${module.items.length == 1 ? '' : 's'}',
                              style: TextStyle(color: c1, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ]),
                      ],
                    ),
                  ),
                  if (widget.isLecturer) ...[
                    _PastelIconButton(
                      icon: Icons.add_link_rounded,
                      tint: _pSeafoam,
                      onTap: () => _showAddItemSheet(module.id, module.title),
                      tooltip: 'Add item',
                    ),
                    const SizedBox(width: 4),
                    _PastelIconButton(
                      icon: Icons.delete_outline_rounded,
                      tint: _pRose,
                      onTap: () => _confirmDeleteModule(module.id, module.title),
                      tooltip: 'Delete module',
                    ),
                    const SizedBox(width: 4),
                  ],
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 220),
                    child: Icon(Icons.expand_more_rounded, color: c.textMuted),
                  ),
                ]),
              ),
            ),
            // Items (animated expand)
            AnimatedSize(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              child: expanded
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      child: Column(
                        children: [
                          Container(
                            height: 1,
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(colors: [
                                Colors.transparent,
                                c.border,
                                Colors.transparent,
                              ]),
                            ),
                          ),
                          if (module.items.isEmpty)
                            _buildEmptyItems(module.id)
                          else
                            ...module.items.map((item) => _buildItemRow(module.id, item)),
                        ],
                      ),
                    )
                  : const SizedBox(width: double.infinity, height: 0),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyItems(String moduleId) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      child: Row(children: [
        Icon(Icons.inbox_rounded, color: c.textMuted, size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'No items in this module yet',
            style: TextStyle(color: c.textMuted, fontSize: 13, fontStyle: FontStyle.italic),
          ),
        ),
        if (widget.isLecturer)
          _PastelIconButton(
            icon: Icons.add_rounded,
            tint: _pSlate,
            small: true,
            onTap: () {
              final module = _modules.firstWhere((m) => m.id == moduleId);
              _showAddItemSheet(moduleId, module.title);
            },
          ),
      ]),
    );
  }

  // ─── Item row ──────────────────────────────────────────────────────────────

  Widget _buildItemRow(String moduleId, _ModuleItemData item) {
    final c = context.colors;
    final meta = _metaForType(item.type);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: context.isDark
            ? Colors.white.withValues(alpha: 0.02)
            : Colors.white.withValues(alpha: 0.40),
        border: Border.all(
          color: context.isDark
              ? Colors.white.withValues(alpha: 0.05)
              : Colors.black.withValues(alpha: 0.04),
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: item.url.isNotEmpty ? () => _openUrl(item.url) : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            child: Row(
              children: [
                // Type icon — gradient pastel tile
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [meta.color, meta.color2],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: meta.color.withValues(alpha: 0.25),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(meta.icon, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: meta.color.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            meta.label.toUpperCase(),
                            style: TextStyle(
                              color: meta.color,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                        if (item.url.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              _shortenUrl(item.url),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: c.textMuted, fontSize: 11),
                            ),
                          ),
                        ],
                      ]),
                    ],
                  ),
                ),
                if (!widget.isLecturer && (item.type == 'pdf' || item.type == 'document'))
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.auto_awesome_rounded, color: _pLavender, size: 20),
                    color: c.surfaceCard,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    onSelected: (type) => _generateAiMaterial(item.id, type),
                    itemBuilder: (_) => [
                      PopupMenuItem(
                        value: 'summary',
                        child: Row(children: [
                          const Icon(Icons.article_rounded, color: _pSlate, size: 18),
                          const SizedBox(width: 10),
                          Text('Summary', style: TextStyle(color: c.textPrimary)),
                        ]),
                      ),
                      PopupMenuItem(
                        value: 'flashcards',
                        child: Row(children: [
                          const Icon(Icons.style_rounded, color: _pSand, size: 18),
                          const SizedBox(width: 10),
                          Text('Flashcards', style: TextStyle(color: c.textPrimary)),
                        ]),
                      ),
                      PopupMenuItem(
                        value: 'quiz',
                        child: Row(children: [
                          const Icon(Icons.quiz_rounded, color: _pSeafoam, size: 18),
                          const SizedBox(width: 10),
                          Text('Practice Quiz', style: TextStyle(color: c.textPrimary)),
                        ]),
                      ),
                    ],
                  ),
                if (item.url.isNotEmpty && !widget.isLecturer && !(item.type == 'pdf' || item.type == 'document'))
                  Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: Icon(Icons.open_in_new_rounded, color: c.textMuted, size: 16),
                  ),
                if (widget.isLecturer)
                  _PastelIconButton(
                    icon: Icons.close_rounded,
                    tint: _pRose,
                    small: true,
                    onTap: () => _confirmDeleteItem(moduleId, item.id, item.title),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _shortenUrl(String url) {
    final trimmed = url.replaceFirst(RegExp(r'^https?://(www\.)?'), '');
    if (trimmed.length <= 36) return trimmed;
    return '${trimmed.substring(0, 33)}…';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Add Module sheet
// ════════════════════════════════════════════════════════════════════════════

class _AddModuleSheet extends StatefulWidget {
  @override
  State<_AddModuleSheet> createState() => _AddModuleSheetState();
}

class _AddModuleSheetState extends State<_AddModuleSheet> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = MediaQuery.of(context).viewInsets;

    return Padding(
      padding: EdgeInsets.only(bottom: insets.bottom),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_pSlate, _pLavender],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _pSlate.withValues(alpha: 0.28),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(Icons.create_new_folder_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('New Module',
                        style: TextStyle(color: c.textPrimary, fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
                    Text('Group related resources together',
                        style: TextStyle(color: c.textMuted, fontSize: 12)),
                  ],
                ),
              ),
            ]),
            const SizedBox(height: 22),
            _GlassTextField(
              controller: _controller,
              focusNode: _focus,
              label: 'Module title',
              hint: 'e.g. Week 1 — Introduction',
              icon: Icons.folder_rounded,
              tint: _pSlate,
              onSubmit: _submit,
            ),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(
                child: _SheetButton(
                  label: 'Cancel',
                  onTap: () => Navigator.pop(context),
                  filled: false,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SheetButton(
                  label: 'Create',
                  icon: Icons.check_rounded,
                  onTap: _submit,
                  filled: true,
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    Navigator.pop(context, text);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Add Item sheet
// ════════════════════════════════════════════════════════════════════════════

class _AddItemSheet extends StatefulWidget {
  final String moduleTitle;
  const _AddItemSheet({required this.moduleTitle});

  @override
  State<_AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<_AddItemSheet> {
  final _titleCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  final _titleFocus = FocusNode();
  String _type = 'link';
  String _mode = 'url'; // 'url' | 'file'
  String? _titleErr;
  String? _urlErr;
  String? _fileErr;

  // Picked file state
  String? _pickedPath;
  String? _pickedName;
  int _pickedSize = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _titleFocus.requestFocus());
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _urlCtrl.dispose();
    _titleFocus.dispose();
    super.dispose();
  }

  void _onTypeChanged(String v) {
    HapticFeedback.selectionClick();
    final meta = _metaForType(v);
    setState(() {
      _type = v;
      // If the new type doesn't support upload, force URL mode and clear any file
      if (!meta.supportsUpload) {
        _mode = 'url';
        _pickedPath = null;
        _pickedName = null;
        _pickedSize = 0;
        _fileErr = null;
      }
    });
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData('text/plain');
    final text = data?.text?.trim();
    if (text != null && text.isNotEmpty) {
      setState(() {
        _urlCtrl.text = text;
        _urlErr = null;
      });
      HapticFeedback.selectionClick();
    }
  }

  Future<void> _pickFile() async {
    final meta = _metaForType(_type);
    if (!meta.supportsUpload) return;
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: meta.uploadExts,
        withData: false,
      );
      if (result == null || result.files.isEmpty) return;
      final f = result.files.single;
      if (f.path == null) {
        setState(() => _fileErr = 'Could not read file path');
        return;
      }
      if (f.size > meta.maxBytes) {
        setState(() => _fileErr =
            'File is ${_formatBytes(f.size)} — max for ${meta.label} is ${meta.maxSizeLabel}');
        return;
      }
      // Auto-fill title from filename if empty
      if (_titleCtrl.text.trim().isEmpty) {
        final base = f.name.contains('.')
            ? f.name.substring(0, f.name.lastIndexOf('.'))
            : f.name;
        _titleCtrl.text = base;
      }
      setState(() {
        _pickedPath = f.path;
        _pickedName = f.name;
        _pickedSize = f.size;
        _fileErr = null;
      });
      HapticFeedback.selectionClick();
    } catch (e) {
      setState(() => _fileErr = 'Picker failed: $e');
    }
  }

  void _clearFile() {
    setState(() {
      _pickedPath = null;
      _pickedName = null;
      _pickedSize = 0;
      _fileErr = null;
    });
  }

  void _submit() {
    final title = _titleCtrl.text.trim();
    setState(() {
      _titleErr = title.isEmpty ? 'Title is required' : null;
    });
    if (_mode == 'file') {
      setState(() {
        _fileErr = _pickedPath == null ? 'Please pick a file' : null;
      });
      if (_titleErr != null || _fileErr != null) return;
      Navigator.pop(context, {
        'mode': 'file',
        'type': _type,
        'title': title,
        'filePath': _pickedPath!,
        'fileName': _pickedName ?? '',
      });
    } else {
      final url = _urlCtrl.text.trim();
      setState(() {
        _urlErr = url.isEmpty
            ? 'URL is required'
            : (!url.startsWith('http://') && !url.startsWith('https://'))
                ? 'URL must start with http:// or https://'
                : null;
      });
      if (_titleErr != null || _urlErr != null) return;
      Navigator.pop(context, {
        'mode': 'url',
        'type': _type,
        'title': title,
        'url': url,
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final meta = _metaForType(_type);
    final insets = MediaQuery.of(context).viewInsets;

    return Padding(
      padding: EdgeInsets.only(bottom: insets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: 44, height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [meta.color, meta.color2],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: meta.color.withValues(alpha: 0.28),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Icon(meta.icon, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Add Resource',
                        style: TextStyle(color: c.textPrimary, fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
                    Text('In  ·  ${widget.moduleTitle}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: c.textMuted, fontSize: 12)),
                  ],
                ),
              ),
            ]),
            const SizedBox(height: 22),

            // Type picker
            Text('Type',
                style: TextStyle(color: c.textSecondary, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
            const SizedBox(height: 10),
            _TypePicker(
              selected: _type,
              onChanged: _onTypeChanged,
            ),

            // Source mode toggle — only when the selected type supports upload
            if (meta.supportsUpload) ...[
              const SizedBox(height: 18),
              _ModeToggle(
                mode: _mode,
                tint: meta.color,
                onChanged: (m) {
                  HapticFeedback.selectionClick();
                  setState(() => _mode = m);
                },
              ),
            ],
            const SizedBox(height: 18),

            // Title
            _GlassTextField(
              controller: _titleCtrl,
              focusNode: _titleFocus,
              label: 'Title',
              hint: 'e.g. Lecture Slides — Chapter 3',
              icon: Icons.title_rounded,
              tint: meta.color,
              error: _titleErr,
              onChanged: (_) {
                if (_titleErr != null) setState(() => _titleErr = null);
              },
            ),
            const SizedBox(height: 14),

            // Source input — URL or File
            if (_mode == 'file' && meta.supportsUpload)
              _FileDropArea(
                meta: meta,
                pickedName: _pickedName,
                pickedSize: _pickedSize,
                error: _fileErr,
                onPick: _pickFile,
                onClear: _clearFile,
              )
            else
              _GlassTextField(
                controller: _urlCtrl,
                label: 'URL',
                hint: 'https://…',
                icon: Icons.link_rounded,
                tint: meta.color,
                keyboardType: TextInputType.url,
                error: _urlErr,
                trailing: GestureDetector(
                  onTap: _paste,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: meta.color.withValues(alpha: 0.14),
                      border: Border.all(color: meta.color.withValues(alpha: 0.28)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.content_paste_rounded, color: meta.color, size: 14),
                      const SizedBox(width: 4),
                      Text('Paste',
                          style: TextStyle(color: meta.color, fontSize: 11, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ),
                onChanged: (_) {
                  if (_urlErr != null) setState(() => _urlErr = null);
                },
                onSubmit: _submit,
              ),
            const SizedBox(height: 22),

            // Actions
            Row(children: [
              Expanded(
                child: _SheetButton(
                  label: 'Cancel',
                  onTap: () => Navigator.pop(context),
                  filled: false,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SheetButton(
                  label: _mode == 'file' ? 'Upload' : 'Add',
                  icon: _mode == 'file' ? Icons.cloud_upload_rounded : Icons.check_rounded,
                  onTap: _submit,
                  filled: true,
                  gradient: [meta.color, meta.color2],
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Mode toggle (URL / Upload File)
// ════════════════════════════════════════════════════════════════════════════

class _ModeToggle extends StatelessWidget {
  final String mode; // 'url' | 'file'
  final Color tint;
  final ValueChanged<String> onChanged;
  const _ModeToggle({required this.mode, required this.tint, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: context.isDark
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.white.withValues(alpha: 0.55),
        border: Border.all(
          color: context.isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.06),
        ),
      ),
      child: Row(children: [
        _modeTab(context, value: 'url',  icon: Icons.link_rounded,         label: 'URL'),
        _modeTab(context, value: 'file', icon: Icons.cloud_upload_rounded, label: 'Upload File'),
      ]),
    );
  }

  Widget _modeTab(BuildContext context, {
    required String value,
    required IconData icon,
    required String label,
  }) {
    final c = context.colors;
    final selected = mode == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(9),
            color: selected ? tint.withValues(alpha: 0.18) : Colors.transparent,
            border: selected
                ? Border.all(color: tint.withValues(alpha: 0.32))
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: selected ? tint : c.textMuted, size: 16),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                    color: selected ? tint : c.textSecondary,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  )),
            ],
          ),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// File drop area (picker tile)
// ════════════════════════════════════════════════════════════════════════════

class _FileDropArea extends StatelessWidget {
  final _TypeMeta meta;
  final String? pickedName;
  final int pickedSize;
  final String? error;
  final VoidCallback onPick;
  final VoidCallback onClear;
  const _FileDropArea({
    required this.meta,
    required this.pickedName,
    required this.pickedSize,
    required this.error,
    required this.onPick,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final hasFile = pickedName != null;
    final borderColor = error != null
        ? _pRose
        : hasFile
            ? meta.color.withValues(alpha: 0.45)
            : (context.isDark
                ? Colors.white.withValues(alpha: 0.14)
                : Colors.black.withValues(alpha: 0.10));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Text('File',
              style: TextStyle(color: c.textSecondary, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: meta.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: meta.color.withValues(alpha: 0.22)),
            ),
            child: Text(
              'Max ${meta.maxSizeLabel} · ${meta.uploadExts.map((e) => '.$e').join(', ')}',
              style: TextStyle(color: meta.color, fontSize: 10.5, fontWeight: FontWeight.w700),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: onPick,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: hasFile
                    ? meta.color.withValues(alpha: 0.08)
                    : (context.isDark
                        ? Colors.white.withValues(alpha: 0.03)
                        : Colors.white.withValues(alpha: 0.55)),
                border: Border.all(
                  color: borderColor,
                  width: hasFile ? 1.4 : 1.2,
                ),
              ),
              child: hasFile
                  ? _pickedRow(context)
                  : _emptyRow(context),
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Row(children: [
              const Icon(Icons.error_outline_rounded, color: _pRose, size: 13),
              const SizedBox(width: 4),
              Flexible(
                child: Text(error!,
                    style: const TextStyle(
                        color: _pRose, fontSize: 11.5, fontWeight: FontWeight.w500)),
              ),
            ]),
          ),
      ],
    );
  }

  Widget _emptyRow(BuildContext context) {
    final c = context.colors;
    return Row(children: [
      Container(
        width: 42, height: 42,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              meta.color.withValues(alpha: 0.85),
              meta.color2.withValues(alpha: 0.85),
            ],
          ),
        ),
        child: const Icon(Icons.cloud_upload_rounded, color: Colors.white, size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tap to pick a ${meta.label.toLowerCase()} file',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(
              'Accepted: ${meta.uploadExts.map((e) => '.$e').join(', ')}  ·  up to ${meta.maxSizeLabel}',
              style: TextStyle(color: c.textMuted, fontSize: 11.5),
            ),
          ],
        ),
      ),
      Icon(Icons.arrow_forward_ios_rounded, color: c.textMuted, size: 14),
    ]);
  }

  Widget _pickedRow(BuildContext context) {
    final c = context.colors;
    final extMatch = RegExp(r'\.([a-zA-Z0-9]+)$').firstMatch(pickedName ?? '');
    final ext = extMatch?.group(1)?.toUpperCase() ?? meta.label.toUpperCase();

    return Row(children: [
      Container(
        width: 42, height: 42,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [meta.color, meta.color2],
          ),
          boxShadow: [
            BoxShadow(
              color: meta.color.withValues(alpha: 0.28),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(meta.icon, color: Colors.white, size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              pickedName!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 2),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: meta.color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(ext,
                    style: TextStyle(
                        color: meta.color,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.4)),
              ),
              const SizedBox(width: 6),
              Text(_formatBytes(pickedSize),
                  style: TextStyle(color: c.textMuted, fontSize: 11.5)),
            ]),
          ],
        ),
      ),
      // Change + clear
      GestureDetector(
        onTap: onPick,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Icon(Icons.swap_horiz_rounded, color: meta.color, size: 20),
        ),
      ),
      GestureDetector(
        onTap: onClear,
        child: Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Icon(Icons.close_rounded, color: c.textMuted, size: 18),
        ),
      ),
    ]);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Type picker — visual pill row
// ════════════════════════════════════════════════════════════════════════════

class _TypePicker extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;
  const _TypePicker({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: _kTypes.map((t) {
        final isSel = t.value == selected;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: GestureDetector(
              onTap: () => onChanged(t.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: isSel
                      ? LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [t.color, t.color2],
                        )
                      : null,
                  color: isSel
                      ? null
                      : (context.isDark
                          ? Colors.white.withValues(alpha: 0.04)
                          : Colors.white.withValues(alpha: 0.55)),
                  border: Border.all(
                    color: isSel
                        ? Colors.white.withValues(alpha: 0.30)
                        : (context.isDark
                            ? Colors.white.withValues(alpha: 0.08)
                            : Colors.black.withValues(alpha: 0.06)),
                  ),
                  boxShadow: isSel
                      ? [
                          BoxShadow(
                            color: t.color.withValues(alpha: 0.30),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : null,
                ),
                child: Column(
                  children: [
                    Icon(t.icon,
                        color: isSel ? Colors.white : t.color, size: 22),
                    const SizedBox(height: 4),
                    Text(
                      t.label,
                      style: TextStyle(
                        color: isSel ? Colors.white : c.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Glass text field
// ════════════════════════════════════════════════════════════════════════════

class _GlassTextField extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String label;
  final String hint;
  final IconData icon;
  final Color tint;
  final String? error;
  final Widget? trailing;
  final TextInputType? keyboardType;
  final void Function(String)? onChanged;
  final VoidCallback? onSubmit;

  const _GlassTextField({
    required this.controller,
    this.focusNode,
    required this.label,
    required this.hint,
    required this.icon,
    required this.tint,
    this.error,
    this.trailing,
    this.keyboardType,
    this.onChanged,
    this.onSubmit,
  });

  @override
  State<_GlassTextField> createState() => _GlassTextFieldState();
}

class _GlassTextFieldState extends State<_GlassTextField> {
  late FocusNode _node;
  bool _owned = false;

  @override
  void initState() {
    super.initState();
    if (widget.focusNode != null) {
      _node = widget.focusNode!;
    } else {
      _node = FocusNode();
      _owned = true;
    }
    _node.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    _node.removeListener(_onFocusChange);
    if (_owned) _node.dispose();
    super.dispose();
  }

  void _onFocusChange() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final focused = _node.hasFocus;
    final tint = widget.tint;
    final borderColor = widget.error != null
        ? _pRose
        : focused
            ? tint
            : (context.isDark
                ? Colors.white.withValues(alpha: 0.10)
                : Colors.black.withValues(alpha: 0.08));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label,
            style: TextStyle(color: c.textSecondary, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
        const SizedBox(height: 8),
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: context.isDark
                ? Colors.white.withValues(alpha: 0.04)
                : Colors.white.withValues(alpha: 0.60),
            border: Border.all(color: borderColor, width: focused ? 1.4 : 1),
            boxShadow: focused
                ? [
                    BoxShadow(
                      color: tint.withValues(alpha: 0.18),
                      blurRadius: 12,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(children: [
            Padding(
              padding: const EdgeInsets.only(left: 14),
              child: Icon(widget.icon, color: focused ? tint : c.textMuted, size: 18),
            ),
            Expanded(
              child: TextField(
                controller: widget.controller,
                focusNode: _node,
                keyboardType: widget.keyboardType,
                textInputAction:
                    widget.onSubmit != null ? TextInputAction.done : TextInputAction.next,
                onChanged: widget.onChanged,
                onSubmitted: (_) => widget.onSubmit?.call(),
                style: TextStyle(color: c.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  border: InputBorder.none,
                  hintText: widget.hint,
                  hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                ),
              ),
            ),
            if (widget.trailing != null)
              Padding(
                padding: const EdgeInsets.only(right: 10),
                child: widget.trailing,
              ),
          ]),
        ),
        if (widget.error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Row(children: [
              const Icon(Icons.error_outline_rounded, color: _pRose, size: 13),
              const SizedBox(width: 4),
              Text(widget.error!,
                  style: const TextStyle(color: _pRose, fontSize: 11.5, fontWeight: FontWeight.w500)),
            ]),
          ),
      ],
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Sheet button + pastel helpers
// ════════════════════════════════════════════════════════════════════════════

class _SheetButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onTap;
  final bool filled;
  final List<Color>? gradient;
  const _SheetButton({
    required this.label,
    required this.onTap,
    this.filled = true,
    this.icon,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final gcolors = gradient ?? const [_pSlate, _pLavender];
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: filled
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: gcolors,
                  )
                : null,
            color: filled
                ? null
                : (context.isDark
                    ? Colors.white.withValues(alpha: 0.04)
                    : Colors.white.withValues(alpha: 0.55)),
            border: filled
                ? null
                : Border.all(
                    color: context.isDark
                        ? Colors.white.withValues(alpha: 0.10)
                        : Colors.black.withValues(alpha: 0.08)),
            boxShadow: filled
                ? [
                    BoxShadow(
                      color: gcolors.first.withValues(alpha: 0.30),
                      blurRadius: 12,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: filled ? Colors.white : c.textSecondary),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  color: filled ? Colors.white : c.textSecondary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PastelButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _PastelButton({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_pSlate, _pLavender],
            ),
            boxShadow: [
              BoxShadow(
                color: _pSlate.withValues(alpha: 0.28),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text(label,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700, letterSpacing: -0.1)),
          ]),
        ),
      ),
    );
  }
}

class _PastelIconButton extends StatelessWidget {
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;
  final bool small;
  final String? tooltip;
  const _PastelIconButton({
    required this.icon,
    required this.tint,
    required this.onTap,
    this.small = false,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final size = small ? 30.0 : 36.0;
    final iconSize = small ? 16.0 : 18.0;
    final btn = Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          width: size, height: size,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: tint.withValues(alpha: 0.14),
            border: Border.all(color: tint.withValues(alpha: 0.28)),
          ),
          child: Icon(icon, color: tint, size: iconSize),
        ),
      ),
    );
    return tooltip != null ? Tooltip(message: tooltip!, child: btn) : btn;
  }
}
