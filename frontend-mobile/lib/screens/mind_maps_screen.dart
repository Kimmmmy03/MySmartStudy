import 'dart:ui';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../models/mind_map_model.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/map_thumbnail.dart';
import '../l10n/app_strings.dart';
import '../widgets/floating_nav_bar.dart';
import '../widgets/open_container_wrapper.dart';
import '../widgets/empty_state.dart';
import '../widgets/search_bar_widget.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';
import 'mind_map_viewer.dart';

// ── Professional pastel palette — matches Courses (subjects_screen.dart) ─────
const _kMapColorPairs = [
  [Color(0xFF7C93C5), Color(0xFF8A9AC2)], // slate blue → dusk
  [Color(0xFFA79FCD), Color(0xFFB098C4)], // lavender → plum
  [Color(0xFF8BB5C9), Color(0xFF7C93C5)], // sky → steel
  [Color(0xFF8FA68E), Color(0xFF8FB5AE)], // sage → sea glass
  [Color(0xFFC9B58A), Color(0xFFC5A982)], // sand → warm taupe
  [Color(0xFFC99FB0), Color(0xFFB09AA8)], // dusty rose → mauve
  [Color(0xFFD8A28E), Color(0xFFD5B28A)], // peach → apricot
  [Color(0xFF8891B8), Color(0xFFA79FCD)], // periwinkle → lilac
  [Color(0xFF7BB5B0), Color(0xFF8FA68E)], // seafoam → sage
  [Color(0xFFC29AA3), Color(0xFFC99FB0)], // blush → dusty rose
];

Color _mapAccent(String id) {
  final idx = id.hashCode.abs() % _kMapColorPairs.length;
  return _kMapColorPairs[idx][0];
}

// Primary / secondary pastels for the add-by-code card, tabs, etc.
const _kSlateBlue = Color(0xFF7C93C5);
const _kLavender = Color(0xFFA79FCD);
const _kMutedRose = Color(0xFFC99999);

enum _SortMode { recent, az, nodes }
enum _TabMode { my, shared }

class MindMapsScreen extends StatefulWidget {
  const MindMapsScreen({super.key});
  @override
  State<MindMapsScreen> createState() => _MindMapsScreenState();
}

class _MindMapsScreenState extends State<MindMapsScreen> {
  bool _loading = true;
  List<MindMapModel> _maps = [];
  List<MindMapModel> _myMaps = [];
  List<MindMapModel> _sharedMaps = [];
  List<MindMapModel> _filtered = [];
  bool _gridView = true;
  _SortMode _sort = _SortMode.recent;
  _TabMode _tab = _TabMode.my;
  final _searchCtrl = TextEditingController();

  String get _currentUserEmail =>
      FirebaseAuth.instance.currentUser?.email ?? '';

  @override
  void initState() {
    super.initState();
    _load();
    _searchCtrl.addListener(_applySortAndFilter);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.getMaps();
      if (!mounted) return;
      final all = raw
          .map((m) => MindMapModel.fromApi(Map<String, dynamic>.from(m)))
          .toList();
      final me = _currentUserEmail;
      setState(() {
        _maps = all;
        _myMaps = all.where((m) => m.ownerEmail == me || m.ownerId == FirebaseAuth.instance.currentUser?.uid).toList();
        _sharedMaps = all.where((m) => m.ownerEmail != me && m.ownerId != FirebaseAuth.instance.currentUser?.uid).toList();
        _applySortAndFilter();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _applySortAndFilter() {
    final source = _tab == _TabMode.my ? _myMaps : _sharedMaps;
    final q = _searchCtrl.text.trim().toLowerCase();
    List<MindMapModel> result = q.isEmpty
        ? List.from(source)
        : source
            .where((m) =>
                m.title.toLowerCase().contains(q) ||
                m.ownerEmail.toLowerCase().contains(q) ||
                m.shareCode.toLowerCase().contains(q))
            .toList();

    switch (_sort) {
      case _SortMode.recent:
        result.sort((a, b) {
          final at = a.lastModified ?? DateTime(2000);
          final bt = b.lastModified ?? DateTime(2000);
          return bt.compareTo(at);
        });
      case _SortMode.az:
        result.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
      case _SortMode.nodes:
        result.sort((a, b) => b.nodes.length.compareTo(a.nodes.length));
    }
    setState(() => _filtered = result);
  }


  Future<void> _rename(MindMapModel map) async {
    final c = context.colors;
    final ctrl = TextEditingController(text: map.title);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: c.surfaceCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Rename Map',
            style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          style: TextStyle(color: c.textPrimary),
          decoration: AppTheme.inputDecoration(ctx, label: 'Title', prefixIcon: Icons.edit),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: TextStyle(color: c.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: AppTheme.gradientButtonStyle(),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (ok != true || ctrl.text.trim().isEmpty) return;
    try {
      await ApiService.renameMap(map.id, ctrl.text.trim());
      _load();
    } catch (_) {}
  }

  Future<void> _delete(MindMapModel map) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Map?',
      message: '"${map.title}" will be permanently deleted.',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok == true) {
      await ApiService.deleteMap(map.id);
      _load();
    }
  }

  void _showMapActions(MindMapModel map) {
    final c = context.colors;
    final color = _accentColor(map);
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: BoxDecoration(
          color: c.surfaceCard,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Container(
              width: 36, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: c.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Map identity
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.account_tree_rounded, color: color, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(map.title,
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 15),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      Text('${map.nodes.length} nodes  •  ${_timeAgo(map.lastModified)}',
                          style: TextStyle(color: c.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Divider(color: c.border),
            const SizedBox(height: 4),
            // Share code copy row
            InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: map.shareCode));
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text('Share code copied'),
                    backgroundColor: color,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    duration: const Duration(seconds: 2),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                child: Row(
                  children: [
                    Icon(Icons.share_rounded, color: color, size: 20),
                    const SizedBox(width: 14),
                    Text('Copy share code',
                        style: TextStyle(color: c.textPrimary, fontSize: 14)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(map.shareCode,
                          style: TextStyle(
                              color: color,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              fontFamily: 'monospace')),
                    ),
                  ],
                ),
              ),
            ),
            if (_tab == _TabMode.my) ...[
              _actionTile(Icons.people_rounded, 'Manage Collaborators', _kLavender, () {
                Navigator.pop(context);
                _showCollaborationSheet(map);
              }),
              _actionTile(Icons.drive_file_rename_outline_rounded, 'Rename', c.textSecondary, () {
                Navigator.pop(context);
                _rename(map);
              }),
              _actionTile(Icons.delete_outline_rounded, 'Delete', _kMutedRose, () {
                Navigator.pop(context);
                _delete(map);
              }),
            ] else ...[
              _actionTile(Icons.person_remove_rounded, 'Leave Map', _kMutedRose, () {
                Navigator.pop(context);
                _leaveMap(map);
              }),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _addMapByShareCode(String code) async {
    final trimmed = code.trim().toUpperCase();
    if (trimmed.isEmpty) return;
    try {
      final results = await ApiService.searchMapsByCode(trimmed);
      if (results.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('No map found with that code'),
            backgroundColor: _kMutedRose,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ));
        }
        return;
      }
      final first = Map<String, dynamic>.from(results.first);
      final mapId = first['id']?.toString() ?? '';
      final ownerEmail = first['owner_email']?.toString() ?? '';
      final me = _currentUserEmail;

      if (mapId.isEmpty) return;
      if (ownerEmail.isNotEmpty && ownerEmail == me) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('You already own this map'),
            backgroundColor: _kSlateBlue,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ));
        }
        return;
      }

      await ApiService.addCollaborator(mapId, me);
      if (mounted) {
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Added "${first['title'] ?? 'map'}" to your shared maps'),
          backgroundColor: _kSlateBlue,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ));
        setState(() => _tab = _TabMode.shared);
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: _kMutedRose,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ));
      }
    }
  }

  Future<void> _leaveMap(MindMapModel map) async {
    final me = _currentUserEmail;
    if (me.isEmpty) return;
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Leave Map?',
      message: 'You will lose access to "${map.title}".',
      isDanger: true,
      confirmLabel: 'Leave',
    );
    if (ok == true) {
      try {
        await ApiService.removeCollaborator(map.id, me);
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed: $e'),
            backgroundColor: _kMutedRose,
          ));
        }
      }
    }
  }

  void _showCollaborationSheet(MindMapModel map) {
    final c = context.colors;
    final color = _accentColor(map);
    List<String> collaborators = List.from(map.collaborators);
    final searchCtrl = TextEditingController();
    List<Map<String, dynamic>> searchResults = [];
    bool searching = false;
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setS) {
          Future<void> doSearch(String q) async {
            if (q.trim().length < 2) { setS(() => searchResults = []); return; }
            setS(() => searching = true);
            try {
              final r = await ApiService.searchStudents(q.trim());
              setS(() { searching = false; searchResults = List<Map<String, dynamic>>.from(r.map((e) => Map<String, dynamic>.from(e))); });
            } catch (_) { setS(() => searching = false); }
          }

          Future<void> addCollaborator(String email) async {
            if (collaborators.contains(email)) return;
            setS(() => saving = true);
            try {
              await ApiService.addCollaborator(map.id, email);
              setS(() { collaborators.add(email); saving = false; searchCtrl.clear(); searchResults = []; });
              _load();
            } catch (e) {
              setS(() => saving = false);
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: _kMutedRose));
            }
          }

          Future<void> removeCollab(String email) async {
            setS(() => saving = true);
            try {
              await ApiService.removeCollaborator(map.id, email);
              setS(() { collaborators.remove(email); saving = false; });
              _load();
            } catch (e) {
              setS(() => saving = false);
            }
          }

          return DraggableScrollableSheet(
            initialChildSize: 0.65,
            minChildSize: 0.4,
            maxChildSize: 0.92,
            expand: false,
            builder: (_, scrollCtrl) => Container(
              decoration: BoxDecoration(
                color: c.surfaceCard,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(children: [
                // Handle
                Container(
                  width: 36, height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(color: c.border, borderRadius: BorderRadius.circular(2)),
                ),
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Row(children: [
                    Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(color: color.withOpacity(0.14), borderRadius: BorderRadius.circular(12)),
                      child: Icon(Icons.people_rounded, color: color, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Collaborate', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(map.title, style: TextStyle(color: c.textMuted, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ])),
                  ]),
                ),
                Divider(color: c.border, height: 1),
                Expanded(
                  child: ListView(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                    children: [
                      // Share code
                      Text('Share Code', style: TextStyle(color: c.textSecondary, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: _kSlateBlue.withOpacity(0.10),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _kSlateBlue.withOpacity(0.30)),
                        ),
                        child: Row(children: [
                          Text(map.shareCode.isEmpty ? 'Save the map first' : map.shareCode,
                              style: const TextStyle(color: _kSlateBlue, fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 3)),
                          const Spacer(),
                          if (map.shareCode.isNotEmpty)
                            GestureDetector(
                              onTap: () {
                                Clipboard.setData(ClipboardData(text: map.shareCode));
                                HapticFeedback.selectionClick();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: const Text('Share code copied!'), backgroundColor: _kSlateBlue, behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), duration: const Duration(seconds: 2)),
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.all(7),
                                decoration: BoxDecoration(color: _kSlateBlue.withOpacity(0.14), borderRadius: BorderRadius.circular(8)),
                                child: const Icon(Icons.copy_rounded, size: 16, color: _kSlateBlue),
                              ),
                            ),
                        ]),
                      ),
                      const SizedBox(height: 20),

                      // Collaborators list
                      Row(children: [
                        Text('Collaborators', style: TextStyle(color: c.textSecondary, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                          child: Text('${collaborators.length}', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
                        ),
                      ]),
                      const SizedBox(height: 8),
                      if (collaborators.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Text('No collaborators yet', style: TextStyle(color: c.textMuted, fontSize: 13)),
                        )
                      else
                        ...collaborators.map((email) => Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: c.surfaceElevated,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: c.border),
                          ),
                          child: Row(children: [
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: color.withOpacity(0.15),
                              child: Text(email[0].toUpperCase(), style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 10),
                            Expanded(child: Text(email, style: TextStyle(color: c.textPrimary, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
                            GestureDetector(
                              onTap: saving ? null : () => removeCollab(email),
                              child: Container(
                                padding: const EdgeInsets.all(5),
                                decoration: BoxDecoration(color: _kMutedRose.withOpacity(0.12), borderRadius: BorderRadius.circular(7)),
                                child: const Icon(Icons.close_rounded, size: 14, color: _kMutedRose),
                              ),
                            ),
                          ]),
                        )),
                      const SizedBox(height: 20),

                      // Add collaborator
                      Text('Add Collaborator', style: TextStyle(color: c.textSecondary, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: searchCtrl,
                        style: TextStyle(color: c.textPrimary, fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'Search by name or email…',
                          hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
                          prefixIcon: Icon(Icons.search_rounded, color: c.textMuted, size: 18),
                          suffixIcon: searching ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: _kSlateBlue))) : null,
                          filled: true,
                          fillColor: c.surfaceElevated,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.border)),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.border)),
                          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kSlateBlue)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                        onChanged: (v) => doSearch(v),
                        onSubmitted: (v) {
                          if (v.contains('@')) addCollaborator(v.trim());
                        },
                      ),
                      if (searchResults.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ...searchResults
                            .where((u) => !collaborators.contains(u['email']?.toString() ?? ''))
                            .map((u) {
                          final email = u['email']?.toString() ?? '';
                          final name = u['display_name']?.toString() ?? email;
                          return GestureDetector(
                            onTap: () => addCollaborator(email),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: c.surfaceElevated,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: c.border),
                              ),
                              child: Row(children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundColor: _kSlateBlue.withOpacity(0.15),
                                  child: Text(name[0].toUpperCase(), style: const TextStyle(color: _kSlateBlue, fontSize: 13, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 10),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(name, style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                                  Text(email, style: TextStyle(color: c.textMuted, fontSize: 11)),
                                ])),
                                Icon(Icons.person_add_rounded, size: 18, color: _kSlateBlue.withOpacity(0.7)),
                              ]),
                            ),
                          );
                        }),
                      ],
                    ],
                  ),
                ),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _actionTile(IconData icon, String label, Color color, VoidCallback onTap) {
    final c = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 14),
            Text(label, style: TextStyle(color: color == c.textSecondary ? c.textPrimary : color, fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Color _accentColor(MindMapModel map) => _mapAccent(map.id.isEmpty ? map.title : map.id);

  String _timeAgo(DateTime? dt) {
    if (dt == null) return 'Unknown';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    return '${dt.day} ${_monthShort(dt.month)}';
  }

  String _monthShort(int m) => const [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][m];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = S.of(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(c, s),
              _buildTabBar(c),
              if (_tab == _TabMode.shared)
                _InlineAddMapCard(
                  isDark: context.isDark,
                  colors: c,
                  onAdd: _addMapByShareCode,
                ),
              _buildSearchAndSort(c, s),
              Expanded(child: _buildBody(c, s)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabBar(AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
      child: Row(children: [
        _tabBtn(c, 'My Maps', _TabMode.my, Icons.account_tree_rounded, _myMaps.length),
        const SizedBox(width: 10),
        _tabBtn(c, 'Shared with Me', _TabMode.shared, Icons.people_rounded, _sharedMaps.length),
      ]),
    );
  }

  Widget _tabBtn(AppColorScheme c, String label, _TabMode mode, IconData icon, int count) {
    final active = _tab == mode;
    final accent = mode == _TabMode.my ? _kSlateBlue : _kLavender;
    final isDark = context.isDark;
    return GestureDetector(
      onTap: () {
        if (_tab == mode) return;
        HapticFeedback.selectionClick();
        setState(() { _tab = mode; _applySortAndFilter(); });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active
              ? accent.withOpacity(0.15)
              : Colors.white.withOpacity(isDark ? 0.04 : 0.65),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: active
                ? accent.withOpacity(0.40)
                : (isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06)),
          ),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: active ? accent : c.textMuted),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 13, fontWeight: active ? FontWeight.w600 : FontWeight.w500, color: active ? accent : c.textSecondary)),
          if (count > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: active ? accent.withOpacity(0.20) : c.surfaceCard,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? accent : c.textMuted)),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _buildHeader(AppColorScheme c, S s) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 16, 4),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                s.mindMaps,
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              if (!_loading && _maps.isNotEmpty)
                Text(
                  '${_maps.length} map${_maps.length == 1 ? '' : 's'}  •  ${_sharedMaps.length} shared',
                  style: TextStyle(color: c.textMuted, fontSize: 12),
                ),
            ],
          ),
          const Spacer(),
          if (_maps.isNotEmpty)
            Container(
              decoration: BoxDecoration(
                color: c.surfaceElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: c.border),
              ),
              child: IconButton(
                icon: Icon(
                  _gridView ? Icons.view_list_rounded : Icons.grid_view_rounded,
                  color: c.textSecondary,
                  size: 20,
                ),
                onPressed: () {
                  HapticFeedback.lightImpact();
                  setState(() => _gridView = !_gridView);
                },
                tooltip: _gridView ? 'List view' : 'Grid view',
                padding: const EdgeInsets.all(8),
                constraints: const BoxConstraints(minWidth: 38, minHeight: 38),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSearchAndSort(AppColorScheme c, S s) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: SearchBarWidget(
            controller: _searchCtrl,
            hintText: 'Search maps…',
            onChanged: (_) => _applySortAndFilter(),
            onClear: () {
              _searchCtrl.clear();
              _applySortAndFilter();
            },
          ),
        ),
        if (_maps.length > 1)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Row(
              children: [
                _sortChip(c, 'Recent', _SortMode.recent, Icons.access_time_rounded),
                const SizedBox(width: 8),
                _sortChip(c, 'A–Z', _SortMode.az, Icons.sort_by_alpha_rounded),
                const SizedBox(width: 8),
                _sortChip(c, 'Nodes', _SortMode.nodes, Icons.account_tree_rounded),
              ],
            ),
          ),
      ],
    );
  }

  Widget _sortChip(AppColorScheme c, String label, _SortMode mode, IconData icon) {
    final active = _sort == mode;
    final isDark = context.isDark;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _sort = mode);
        _applySortAndFilter();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active
              ? _kSlateBlue.withOpacity(0.15)
              : Colors.white.withOpacity(isDark ? 0.04 : 0.65),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active
                ? _kSlateBlue.withOpacity(0.40)
                : (isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06)),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: active ? _kSlateBlue : c.textMuted),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                color: active ? _kSlateBlue : c.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(AppColorScheme c, S s) {
    if (_loading) {
      return const SkeletonGrid(itemCount: 6, crossAxisCount: 2);
    }
    final isSharedTab = _tab == _TabMode.shared;
    return RefreshIndicator(
      onRefresh: _load,
      color: _kSlateBlue,
      child: _filtered.isEmpty
          ? ListView(children: [
              SizedBox(height: MediaQuery.of(context).size.height * 0.12),
              EmptyState(
                icon: isSharedTab ? Icons.people_rounded : Icons.account_tree_rounded,
                title: _searchCtrl.text.isNotEmpty
                    ? 'No maps found'
                    : isSharedTab
                        ? 'No shared maps yet'
                        : s.noMindMaps,
                subtitle: _searchCtrl.text.isNotEmpty
                    ? 'Try a different search term'
                    : isSharedTab
                        ? 'Maps shared with you will appear here'
                        : 'Create maps on the web — they will appear here',
              ),
            ])
          : _gridView
              ? _buildGrid()
              : _buildList(),
    );
  }

  Widget _buildGrid() {
    return AnimationLimiter(
      child: GridView.builder(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: EdgeInsets.fromLTRB(16, 12, 16, FloatingNavBar.kTotalHeight + 20),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.78,
        ),
        itemCount: _filtered.length,
        itemBuilder: (_, i) => AnimatedGridItem(
          index: i,
          columnCount: 2,
          child: _buildGridCard(_filtered[i]),
        ),
      ),
    );
  }

  Widget _buildList() {
    return AnimationLimiter(
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: EdgeInsets.fromLTRB(16, 12, 16, FloatingNavBar.kTotalHeight + 20),
        itemCount: _filtered.length,
        itemBuilder: (_, i) => AnimatedListItem(
          index: i,
          child: _buildListCard(_filtered[i]),
        ),
      ),
    );
  }

  Widget _buildGridCard(MindMapModel map) {
    final c = context.colors;
    final color = _accentColor(map);
    final isDark = context.isDark;

    return OpenContainerWrapper(
      openColor: c.surface,
      openBuilder: (ctx, _) => MindMapViewerScreen(mindMap: map),
      closedBuilder: (ctx, openFn) => GestureDetector(
        onTap: openFn,
        onLongPress: () => _showMapActions(map),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(isDark ? 0.04 : 0.65),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark
                  ? Colors.white.withOpacity(0.08)
                  : Colors.black.withOpacity(0.06),
            ),
            boxShadow: isDark
                ? null
                : [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Preview area — 62% of card
              Expanded(
                flex: 62,
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                  child: Stack(
                    children: [
                      // Dark canvas background — always dark to match web
                      Positioned.fill(
                        child: Container(color: const Color(0xFF0e1429)),
                      ),
                      // Preview — prefer web-saved base64 thumbnail (matches web exactly),
                      // fall back to painter-rendered preview, then empty-map placeholder.
                      Positioned.fill(child: MapThumbnail(map: map, accent: color)),
                      // Node count badge (top-right)
                      Positioned(
                        top: 10,
                        right: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(isDark ? 0.55 : 0.35),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.radio_button_unchecked, size: 8, color: Colors.white70),
                              const SizedBox(width: 4),
                              Text('${map.nodes.length}',
                                  style: const TextStyle(
                                      color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                      // Edit/more button (top-left)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: GestureDetector(
                          onTap: () => _showMapActions(map),
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(isDark ? 0.55 : 0.35),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.more_horiz_rounded,
                                color: Colors.white, size: 16),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Info area — 38% of card
              Expanded(
                flex: 38,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Colored dot + title
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              map.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: c.textPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                letterSpacing: -0.2,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      // Shared-by label (only on shared tab)
                      if (_tab == _TabMode.shared)
                        Row(children: [
                          Icon(Icons.person_outline_rounded, size: 11, color: color),
                          const SizedBox(width: 3),
                          Expanded(child: Text(
                            map.ownerEmail,
                            style: TextStyle(color: color, fontSize: 10),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          )),
                        ])
                      else
                        // Date + collaborators
                        Row(
                          children: [
                            Icon(Icons.schedule_rounded, size: 11, color: c.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              _timeAgo(map.lastModified),
                              style: TextStyle(color: c.textMuted, fontSize: 11),
                            ),
                            if (map.collaborators.isNotEmpty) ...[
                              const SizedBox(width: 8),
                              Icon(Icons.people_outline_rounded, size: 11, color: c.textMuted),
                              const SizedBox(width: 3),
                              Text(
                                '${map.collaborators.length}',
                                style: TextStyle(color: c.textMuted, fontSize: 11),
                              ),
                            ],
                          ],
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildListCard(MindMapModel map) {
    final c = context.colors;
    final color = _accentColor(map);
    final isDark = context.isDark;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: OpenContainerWrapper(
        openColor: c.surface,
        closedBorderRadius: const BorderRadius.all(Radius.circular(18)),
        openBuilder: (ctx, _) => MindMapViewerScreen(mindMap: map),
        closedBuilder: (ctx, openFn) => GestureDetector(
          onTap: openFn,
          onLongPress: () => _showMapActions(map),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
              child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(isDark ? 0.04 : 0.65),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: isDark
                    ? Colors.white.withOpacity(0.08)
                    : Colors.black.withOpacity(0.06),
              ),
              boxShadow: isDark
                  ? null
                  : [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 12,
                        offset: const Offset(0, 3),
                      ),
                    ],
            ),
            child: Row(
              children: [
                // Left color strip
                Container(
                  width: 4,
                  height: 72,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: const BorderRadius.horizontal(left: Radius.circular(18)),
                  ),
                ),
                const SizedBox(width: 14),
                // Thumbnail tile — web-saved base64 thumbnail, else painter, else icon
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0e1429),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(13),
                    child: MapThumbnail(map: map, accent: color, compact: true),
                  ),
                ),
                const SizedBox(width: 12),
                // Text info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        map.title,
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      if (_tab == _TabMode.shared)
                        Row(children: [
                          Icon(Icons.person_outline_rounded, size: 11, color: color),
                          const SizedBox(width: 4),
                          Expanded(child: Text(
                            'by ${map.ownerEmail}',
                            style: TextStyle(color: c.textMuted, fontSize: 12),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          )),
                        ])
                      else
                        Row(
                          children: [
                            Icon(Icons.radio_button_unchecked, size: 10, color: color),
                            const SizedBox(width: 4),
                            Text(
                              '${map.nodes.length} node${map.nodes.length == 1 ? '' : 's'}',
                              style: TextStyle(color: c.textSecondary, fontSize: 12),
                            ),
                            Text('  •  ', style: TextStyle(color: c.textMuted, fontSize: 12)),
                            Icon(Icons.schedule_rounded, size: 11, color: c.textMuted),
                            const SizedBox(width: 3),
                            Text(
                              _timeAgo(map.lastModified),
                              style: TextStyle(color: c.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                // Actions
                IconButton(
                  icon: Icon(Icons.more_vert_rounded, color: c.textMuted, size: 20),
                  onPressed: () => _showMapActions(map),
                  padding: const EdgeInsets.all(12),
                ),
              ],
            ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Inline "Add Map by Share Code" card (mirrors subjects_screen _InlineJoinCard) ──
class _InlineAddMapCard extends StatefulWidget {
  final bool isDark;
  final AppColorScheme colors;
  final Future<void> Function(String code) onAdd;

  const _InlineAddMapCard({
    required this.isDark,
    required this.colors,
    required this.onAdd,
  });

  @override
  State<_InlineAddMapCard> createState() => _InlineAddMapCardState();
}

class _InlineAddMapCardState extends State<_InlineAddMapCard> {
  final _ctrl = TextEditingController();
  bool _adding = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _ctrl.text.trim();
    if (code.length < 4 || _adding) return;
    setState(() => _adding = true);
    await widget.onAdd(code);
    if (mounted) {
      _ctrl.clear();
      setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.colors;
    final isDark = widget.isDark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withOpacity(0.04)
                  : Colors.white.withOpacity(0.65),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark
                    ? Colors.white.withOpacity(0.08)
                    : Colors.black.withOpacity(0.06),
              ),
            ),
            child: Column(
              children: [
                // Gradient tint header
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isDark
                          ? [_kSlateBlue.withOpacity(0.10), _kLavender.withOpacity(0.10)]
                          : [_kSlateBlue.withOpacity(0.06), _kLavender.withOpacity(0.06)],
                    ),
                    border: Border(
                      bottom: BorderSide(
                        color: isDark
                            ? Colors.white.withOpacity(0.05)
                            : Colors.black.withOpacity(0.04),
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: _kSlateBlue.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _kSlateBlue.withOpacity(0.20)),
                        ),
                        child: const Icon(Icons.link_rounded,
                            color: _kSlateBlue, size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Add Map by Share Code',
                              style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              'Enter the code from your map owner',
                              style: TextStyle(color: c.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // Input + button row
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 42,
                          decoration: BoxDecoration(
                            color: isDark
                                ? Colors.white.withOpacity(0.05)
                                : Colors.white.withOpacity(0.8),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark
                                  ? Colors.white.withOpacity(0.10)
                                  : Colors.black.withOpacity(0.08),
                            ),
                          ),
                          child: TextField(
                            controller: _ctrl,
                            textCapitalization: TextCapitalization.characters,
                            textAlign: TextAlign.center,
                            maxLength: 6,
                            style: TextStyle(
                              color: c.textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              fontFamily: 'monospace',
                              letterSpacing: 6,
                            ),
                            decoration: InputDecoration(
                              border: InputBorder.none,
                              hintText: 'ABC123',
                              hintStyle: TextStyle(
                                color: c.textMuted.withOpacity(0.5),
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 4,
                              ),
                              counterText: '',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                            ),
                            onSubmitted: (_) => _submit(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(
                        height: 42,
                        child: ElevatedButton(
                          onPressed: _adding ? null : _submit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _kSlateBlue,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: _adding
                              ? const SizedBox(
                                  width: 18, height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Add',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w700, fontSize: 14)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
