import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/mind_map_model.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/map_thumbnail.dart';
import 'mind_map_viewer.dart';

enum _SearchMode { recent, code, course, email }
enum _ViewMode { grid, list }
enum _SortBy { date, title, owner }

class _Student {
  final String id;
  final String displayName;
  final String email;
  final String photoUrl;
  _Student({required this.id, required this.displayName, required this.email, required this.photoUrl});

  factory _Student.fromMap(Map<String, dynamic> m) => _Student(
        id: (m['id'] ?? '').toString(),
        displayName: (m['display_name'] ?? m['displayName'] ?? '').toString(),
        email: (m['email'] ?? '').toString(),
        photoUrl: (m['photo_url'] ?? m['photoUrl'] ?? '').toString(),
      );
}

class _RecentMap {
  final String id;
  final String title;
  final String ownerEmail;
  final String shareCode;
  final String viewedAt;

  _RecentMap({
    required this.id,
    required this.title,
    required this.ownerEmail,
    required this.shareCode,
    required this.viewedAt,
  });

  factory _RecentMap.fromApi(Map<String, dynamic> m) => _RecentMap(
        id: (m['id'] ?? '').toString(),
        title: (m['title'] ?? 'Untitled').toString(),
        ownerEmail: (m['owner_email'] ?? m['ownerEmail'] ?? '').toString(),
        shareCode: (m['share_code'] ?? m['shareCode'] ?? '').toString(),
        viewedAt: (m['viewed_at'] ?? m['viewedAt'] ?? '').toString(),
      );
}

class ReviewMapsScreen extends StatefulWidget {
  const ReviewMapsScreen({super.key});
  @override
  State<ReviewMapsScreen> createState() => _ReviewMapsScreenState();
}

class _ReviewMapsScreenState extends State<ReviewMapsScreen> {
  // ── Accent palette (match web lecturer purple + cyan chips) ──
  static const _purple = Color(0xFFA79FCD); // lavender (pastel)
  static const _slate = Color(0xFF7C93C5);
  static const _cyan = Color(0xFF7BB5B0); // seafoam (share code chip)
  static const _cardRadius = 16.0;

  _SearchMode _mode = _SearchMode.code;
  _ViewMode _viewMode = _ViewMode.grid;
  _SortBy _sortBy = _SortBy.date;
  bool _sortAsc = false;

  final _searchCtrl = TextEditingController();
  final _filterCtrl = TextEditingController();

  Timer? _debounce;
  bool _searched = false;
  bool _loading = false;

  List<MindMapModel> _results = [];

  // Recently viewed
  List<_RecentMap> _recent = [];

  // Courses
  List<Map<String, dynamic>> _courses = [];
  String _selectedCourse = '';

  // Email autocomplete
  List<_Student> _suggestions = [];
  bool _showSuggestions = false;
  _Student? _selectedStudent;
  final _emailFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _loadRecents();
    _loadCourses();
    _searchCtrl.addListener(() => setState(() {}));
    _filterCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    _filterCtrl.dispose();
    _emailFocus.dispose();
    super.dispose();
  }

  // ── Persistence (backend-synced across devices) ──────────────────────────
  Future<void> _loadRecents() async {
    try {
      final raw = await ApiService.getRecentlyViewedMaps();
      if (!mounted) return;
      final list = raw.map((e) => _RecentMap.fromApi(Map<String, dynamic>.from(e))).toList();
      setState(() {
        _recent = list;
        if (list.isNotEmpty) _mode = _SearchMode.recent;
      });
    } catch (_) {}
  }

  Future<void> _recordView(String mapId) async {
    try {
      await ApiService.markMapViewed(mapId);
    } catch (_) {}
    await _loadRecents();
  }

  Future<void> _loadCourses() async {
    try {
      final raw = await ApiService.getTeachingCourses();
      if (!mounted) return;
      setState(() => _courses = raw.map((c) => Map<String, dynamic>.from(c)).toList());
    } catch (_) {}
  }

  // ── Search logic (auto, debounced) ────────────────────────────────────────
  void _resetResults() {
    setState(() {
      _results = [];
      _searched = false;
      _loading = false;
    });
  }

  Future<void> _runSearch() async {
    setState(() => _loading = true);
    List<MindMapModel> maps = [];
    try {
      final term = _searchCtrl.text.trim();
      if (_mode == _SearchMode.code && term.length >= 3) {
        final raw = await ApiService.searchMapsByCode(term.toUpperCase());
        maps = raw.map((m) => MindMapModel.fromApi(Map<String, dynamic>.from(m))).toList();
      } else if (_mode == _SearchMode.course && _selectedCourse.isNotEmpty) {
        final raw = await ApiService.searchMapsByCourse(_selectedCourse);
        maps = raw.map((m) => MindMapModel.fromApi(Map<String, dynamic>.from(m))).toList();
      } else if (_mode == _SearchMode.email) {
        final email = _selectedStudent?.email ?? term.toLowerCase();
        if (email.length >= 3) {
          final raw = await ApiService.searchMapsByEmail(email);
          maps = raw.map((m) => MindMapModel.fromApi(Map<String, dynamic>.from(m))).toList();
        }
      }
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _results = maps;
      _searched = true;
      _loading = false;
    });
  }

  void _onCodeChanged(String v) {
    final up = v.toUpperCase();
    _searchCtrl.value = TextEditingValue(
      text: up,
      selection: TextSelection.collapsed(offset: up.length),
    );
    _debounce?.cancel();
    if (up.trim().length < 3) {
      _resetResults();
      return;
    }
    setState(() => _loading = true);
    _debounce = Timer(const Duration(milliseconds: 400), _runSearch);
  }

  void _onEmailChanged(String v) {
    _selectedStudent = null;
    _debounce?.cancel();
    if (v.trim().isEmpty) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
      });
      _resetResults();
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      try {
        final raw = await ApiService.searchStudents(v.trim());
        if (!mounted) return;
        setState(() {
          _suggestions = raw.map((s) => _Student.fromMap(Map<String, dynamic>.from(s))).toList();
          _showSuggestions = _suggestions.isNotEmpty;
        });
      } catch (_) {}
      if (v.contains('@') && v.trim().length >= 5) {
        _runSearch();
      }
    });
  }

  void _selectStudent(_Student s) {
    _searchCtrl.text = s.email;
    _selectedStudent = s;
    setState(() => _showSuggestions = false);
    _emailFocus.unfocus();
    _runSearch();
  }

  void _selectCourse(String id) {
    setState(() => _selectedCourse = id);
    if (id.isEmpty) {
      _resetResults();
      return;
    }
    _runSearch();
  }

  void _changeMode(_SearchMode m) {
    setState(() {
      _mode = m;
      _searchCtrl.clear();
      _filterCtrl.clear();
      _selectedStudent = null;
      _selectedCourse = '';
      _suggestions = [];
      _showSuggestions = false;
      _results = [];
      _searched = false;
      _loading = false;
    });
  }

  // ── Filter + sort ─────────────────────────────────────────────────────────
  List<MindMapModel> get _filtered {
    final q = _filterCtrl.text.trim().toLowerCase();
    var list = _results;
    if (q.isNotEmpty) {
      list = list.where((m) => m.title.toLowerCase().contains(q) || m.ownerEmail.toLowerCase().contains(q)).toList();
    }
    list = [...list];
    list.sort((a, b) {
      int cmp;
      switch (_sortBy) {
        case _SortBy.date:
          final ad = a.lastModified?.millisecondsSinceEpoch ?? 0;
          final bd = b.lastModified?.millisecondsSinceEpoch ?? 0;
          cmp = bd.compareTo(ad);
          break;
        case _SortBy.title:
          cmp = a.title.toLowerCase().compareTo(b.title.toLowerCase());
          break;
        case _SortBy.owner:
          cmp = a.ownerEmail.toLowerCase().compareTo(b.ownerEmail.toLowerCase());
          break;
      }
      return _sortAsc ? -cmp : cmp;
    });
    return list;
  }

  String _formatDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${d.day}/${d.month}/${d.year}';
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return AppBackground(
      applySafeArea: false,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Review Mind Maps', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.transparent,
          foregroundColor: c.textPrimary,
          scrolledUnderElevation: 0,
        ),
        body: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Browse and review student mind maps',
                  style: TextStyle(color: c.textMuted, fontSize: 12.5),
                ),
                const SizedBox(height: 12),
                _buildModeTabs(c),
                const SizedBox(height: 12),
                if (_mode != _SearchMode.recent) _buildSearchInput(c),
                if (_mode != _SearchMode.recent) const SizedBox(height: 12),
                if ((_searched && _results.isNotEmpty) || _mode == _SearchMode.recent)
                  _buildResultsHeader(c),
                const SizedBox(height: 8),
                Expanded(child: _buildBody(c)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Mode tabs (horizontal scroll) ─────────────────────────────────────────
  Widget _buildModeTabs(AppColorScheme c) {
    final tabs = [
      (_SearchMode.recent, 'Recent', Icons.history_rounded, _recent.length),
      (_SearchMode.code, 'Share Code', Icons.tag_rounded, 0),
      (_SearchMode.course, 'Course', Icons.menu_book_rounded, 0),
      (_SearchMode.email, 'Email', Icons.alternate_email_rounded, 0),
    ];

    return GlassCard(
      padding: const EdgeInsets.all(4),
      borderRadius: 14,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: tabs.map((t) {
            final selected = _mode == t.$1;
            return Padding(
              padding: const EdgeInsets.only(right: 4),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  _changeMode(t.$1);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected ? _purple.withOpacity(0.18) : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(t.$3, size: 14, color: selected ? _purple : c.textMuted),
                      const SizedBox(width: 6),
                      Text(
                        t.$2,
                        style: TextStyle(
                          color: selected ? _purple : c.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (t.$4 > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: c.surfaceElevated,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${t.$4}',
                            style: TextStyle(color: c.textSecondary, fontSize: 10, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // ── Search input area ─────────────────────────────────────────────────────
  Widget _buildSearchInput(AppColorScheme c) {
    if (_mode == _SearchMode.course) {
      return GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        borderRadius: 14,
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            isExpanded: true,
            value: _selectedCourse.isEmpty ? null : _selectedCourse,
            hint: Row(children: [
              Icon(Icons.menu_book_rounded, size: 16, color: c.textMuted),
              const SizedBox(width: 8),
              Text('Select a course...', style: TextStyle(color: c.textMuted, fontSize: 13)),
            ]),
            icon: Icon(Icons.expand_more_rounded, color: c.textMuted),
            dropdownColor: c.surfaceCard,
            style: TextStyle(color: c.textPrimary, fontSize: 13),
            onChanged: (v) => _selectCourse(v ?? ''),
            items: _courses.map((course) {
              final id = (course['id'] ?? '').toString();
              final name = (course['course_name'] ?? 'Untitled').toString();
              final code = (course['course_code'] ?? '').toString();
              return DropdownMenuItem(
                value: id,
                child: Text(
                  code.isNotEmpty ? '$name ($code)' : name,
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }).toList(),
          ),
        ),
      );
    }

    final isCode = _mode == _SearchMode.code;
    final isEmail = _mode == _SearchMode.email;

    return Column(
      children: [
        GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          borderRadius: 14,
          child: Row(
            children: [
              Icon(
                isCode ? Icons.tag_rounded : Icons.alternate_email_rounded,
                size: 18,
                color: c.textMuted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  focusNode: isEmail ? _emailFocus : null,
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 14,
                    fontFamily: isCode ? 'monospace' : null,
                    letterSpacing: isCode ? 2 : null,
                  ),
                  textCapitalization:
                      isCode ? TextCapitalization.characters : TextCapitalization.none,
                  decoration: InputDecoration(
                    hintText: isCode
                        ? 'Enter share code...'
                        : 'Type student name or email...',
                    hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onChanged: isCode ? _onCodeChanged : _onEmailChanged,
                ),
              ),
              if (_loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _purple),
                )
              else if (_searchCtrl.text.isNotEmpty)
                GestureDetector(
                  onTap: () {
                    _searchCtrl.clear();
                    _resetResults();
                    setState(() {
                      _suggestions = [];
                      _showSuggestions = false;
                    });
                  },
                  child: Icon(Icons.close_rounded, size: 18, color: c.textMuted),
                ),
            ],
          ),
        ),
        if (isEmail && _showSuggestions && _suggestions.isNotEmpty) ...[
          const SizedBox(height: 6),
          GlassCard(
            padding: EdgeInsets.zero,
            borderRadius: 14,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _suggestions.length,
                separatorBuilder: (_, __) => Divider(height: 1, color: c.border),
                itemBuilder: (_, i) {
                  final s = _suggestions[i];
                  return InkWell(
                    onTap: () => _selectStudent(s),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: _purple.withOpacity(0.18),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                (s.displayName.isNotEmpty ? s.displayName : s.email)[0].toUpperCase(),
                                style: const TextStyle(color: _purple, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  s.displayName.isEmpty ? 'No Name' : s.displayName,
                                  style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  s.email,
                                  style: TextStyle(color: c.textMuted, fontSize: 11),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ],
    );
  }

  // ── Results header (count + filter + sort + view) ────────────────────────
  Widget _buildResultsHeader(AppColorScheme c) {
    final count = _mode == _SearchMode.recent ? _recent.length : _filtered.length;
    final label = _mode == _SearchMode.recent
        ? '$count recently viewed'
        : '$count map${count == 1 ? '' : 's'} found';

    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(color: c.textSecondary, fontSize: 12),
          ),
        ),
        if (_mode != _SearchMode.recent && _results.isNotEmpty) ...[
          InkWell(
            onTap: () => setState(() => _sortAsc = !_sortAsc),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.all(6),
              child: Icon(
                _sortAsc ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                size: 16,
                color: c.textSecondary,
              ),
            ),
          ),
          PopupMenuButton<_SortBy>(
            initialValue: _sortBy,
            onSelected: (v) => setState(() => _sortBy = v),
            color: c.surfaceCard,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              child: Row(
                children: [
                  Icon(Icons.sort_rounded, size: 16, color: c.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    _sortBy == _SortBy.date ? 'Date' : _sortBy == _SortBy.title ? 'Title' : 'Owner',
                    style: TextStyle(color: c.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            itemBuilder: (_) => const [
              PopupMenuItem(value: _SortBy.date, child: Text('Date')),
              PopupMenuItem(value: _SortBy.title, child: Text('Title')),
              PopupMenuItem(value: _SortBy.owner, child: Text('Owner')),
            ],
          ),
        ],
        const SizedBox(width: 4),
        _viewToggle(c),
      ],
    );
  }

  Widget _viewToggle(AppColorScheme c) {
    return Container(
      decoration: BoxDecoration(
        color: c.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          _viewBtn(c, Icons.grid_view_rounded, _ViewMode.grid),
          _viewBtn(c, Icons.view_list_rounded, _ViewMode.list),
        ],
      ),
    );
  }

  Widget _viewBtn(AppColorScheme c, IconData icon, _ViewMode mode) {
    final active = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: active ? _purple.withOpacity(0.18) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 16, color: active ? _purple : c.textMuted),
      ),
    );
  }

  // ── Body content ──────────────────────────────────────────────────────────
  Widget _buildBody(AppColorScheme c) {
    if (_mode == _SearchMode.recent) {
      if (_recent.isEmpty) {
        return const Center(
          child: EmptyState(
            icon: Icons.history_rounded,
            title: 'No recently viewed maps',
            subtitle: 'Maps you review will appear here',
          ),
        );
      }
      return _viewMode == _ViewMode.grid ? _buildRecentGrid(c) : _buildRecentList(c);
    }

    if (_loading && !_searched) {
      return const Center(child: CircularProgressIndicator(color: _purple));
    }
    if (!_searched) {
      final prompt = _mode == _SearchMode.code
          ? 'Start typing a share code to search...'
          : _mode == _SearchMode.course
              ? 'Select a course to see submitted maps'
              : 'Type a student name or email to search...';
      return Center(
        child: EmptyState(
          icon: Icons.schema_rounded,
          title: 'Search for student maps',
          subtitle: prompt,
        ),
      );
    }
    if (_filtered.isEmpty) {
      return Center(
        child: EmptyState(
          icon: Icons.search_off_rounded,
          title: _results.isEmpty ? 'No maps found' : 'No matches',
          subtitle: _results.isEmpty ? 'Try a different search' : 'Try clearing the filter',
        ),
      );
    }
    return _viewMode == _ViewMode.grid ? _buildResultsGrid(c) : _buildResultsList(c);
  }

  // ── Grids + lists ─────────────────────────────────────────────────────────
  Widget _buildResultsGrid(AppColorScheme c) {
    return GridView.builder(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.only(bottom: 110),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.78,
      ),
      itemCount: _filtered.length,
      itemBuilder: (_, i) => _mapGridCard(c, _filtered[i]),
    );
  }

  Widget _buildResultsList(AppColorScheme c) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.only(bottom: 110),
      itemCount: _filtered.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _mapListCard(c, _filtered[i]),
    );
  }

  Widget _buildRecentGrid(AppColorScheme c) {
    return GridView.builder(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.only(bottom: 110),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.85,
      ),
      itemCount: _recent.length,
      itemBuilder: (_, i) => _recentGridCard(c, _recent[i]),
    );
  }

  Widget _buildRecentList(AppColorScheme c) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.only(bottom: 110),
      itemCount: _recent.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _recentListCard(c, _recent[i]),
    );
  }

  // ── Cards ─────────────────────────────────────────────────────────────────
  Widget _mapGridCard(AppColorScheme c, MindMapModel m) {
    return GestureDetector(
      onTap: () => _openMap(m),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(_cardRadius),
        child: Container(
          decoration: BoxDecoration(
            color: context.isDark ? Colors.white.withOpacity(0.04) : Colors.white.withOpacity(0.65),
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(_cardRadius),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: 5,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [_purple.withOpacity(0.18), _slate.withOpacity(0.10)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: MapThumbnail(map: m, accent: _purple),
                      ),
                    ),
                    if (m.shareCode.isNotEmpty)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _cyan.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: _cyan.withOpacity(0.4)),
                          ),
                          child: Text(
                            m.shareCode,
                            style: const TextStyle(color: _cyan, fontSize: 9, fontWeight: FontWeight.w700, fontFamily: 'monospace'),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                flex: 4,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        m.title,
                        style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(children: [
                        Icon(Icons.person_outline_rounded, size: 11, color: c.textMuted),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            m.ownerEmail,
                            style: TextStyle(color: c.textMuted, fontSize: 10.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ]),
                      const SizedBox(height: 2),
                      Row(children: [
                        Icon(Icons.access_time_rounded, size: 11, color: c.textMuted),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            m.lastModified != null ? _formatDate(m.lastModified!.toIso8601String()) : '—',
                            style: TextStyle(color: c.textMuted, fontSize: 10.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ]),
                      const Spacer(),
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _purple.withOpacity(0.14),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${m.nodes.length} nodes',
                            style: const TextStyle(color: _purple, fontSize: 10, fontWeight: FontWeight.w700),
                          ),
                        ),
                        const Spacer(),
                        Icon(Icons.visibility_outlined, size: 13, color: c.textMuted),
                      ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _mapListCard(AppColorScheme c, MindMapModel m) {
    return GlassCard(
      padding: const EdgeInsets.all(12),
      borderRadius: _cardRadius,
      onTap: () => _openMap(m),
      child: Row(children: [
        Container(
          width: 58,
          height: 44,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_purple.withOpacity(0.22), _slate.withOpacity(0.15)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(10),
          ),
          child: MapThumbnail(map: m, accent: _purple, compact: true),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                m.title,
                style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 13.5),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 3),
              Row(children: [
                Icon(Icons.person_outline_rounded, size: 11, color: c.textMuted),
                const SizedBox(width: 3),
                Expanded(
                  child: Text(
                    m.ownerEmail,
                    style: TextStyle(color: c.textMuted, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ]),
              const SizedBox(height: 2),
              Row(children: [
                Icon(Icons.access_time_rounded, size: 11, color: c.textMuted),
                const SizedBox(width: 3),
                Text(
                  m.lastModified != null ? _formatDate(m.lastModified!.toIso8601String()) : '—',
                  style: TextStyle(color: c.textMuted, fontSize: 11),
                ),
                const SizedBox(width: 8),
                Text('•', style: TextStyle(color: c.textMuted, fontSize: 11)),
                const SizedBox(width: 8),
                Text('${m.nodes.length} nodes',
                    style: const TextStyle(color: _purple, fontSize: 11, fontWeight: FontWeight.w700)),
              ]),
            ],
          ),
        ),
        if (m.shareCode.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: _cyan.withOpacity(0.18),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              m.shareCode,
              style: const TextStyle(color: _cyan, fontSize: 10, fontWeight: FontWeight.w700, fontFamily: 'monospace'),
            ),
          ),
        const SizedBox(width: 4),
        Icon(Icons.chevron_right_rounded, color: c.textMuted, size: 18),
      ]),
    );
  }

  Widget _recentGridCard(AppColorScheme c, _RecentMap r) {
    return GestureDetector(
      onTap: () => _openRecent(r),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(_cardRadius),
        child: Container(
          decoration: BoxDecoration(
            color: context.isDark ? Colors.white.withOpacity(0.04) : Colors.white.withOpacity(0.65),
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(_cardRadius),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: 4,
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_purple.withOpacity(0.25), _slate.withOpacity(0.15)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: const Icon(Icons.account_tree_rounded, size: 32, color: _purple),
                ),
              ),
              Expanded(
                flex: 5,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        r.title,
                        style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(children: [
                        Icon(Icons.person_outline_rounded, size: 11, color: c.textMuted),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            r.ownerEmail,
                            style: TextStyle(color: c.textMuted, fontSize: 10.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ]),
                      const SizedBox(height: 2),
                      Row(children: [
                        Icon(Icons.history_rounded, size: 11, color: c.textMuted),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            'Viewed ${_formatDate(r.viewedAt)}',
                            style: TextStyle(color: c.textMuted, fontSize: 10.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ]),
                      const Spacer(),
                      if (r.shareCode.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _cyan.withOpacity(0.16),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            r.shareCode,
                            style: const TextStyle(color: _cyan, fontSize: 10, fontWeight: FontWeight.w700, fontFamily: 'monospace'),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _recentListCard(AppColorScheme c, _RecentMap r) {
    return GlassCard(
      padding: const EdgeInsets.all(12),
      borderRadius: _cardRadius,
      onTap: () => _openRecent(r),
      child: Row(children: [
        Container(
          width: 52,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_purple.withOpacity(0.22), _slate.withOpacity(0.14)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.account_tree_rounded, color: _purple, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                r.title,
                style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 13.5),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 3),
              Row(children: [
                Icon(Icons.person_outline_rounded, size: 11, color: c.textMuted),
                const SizedBox(width: 3),
                Expanded(
                  child: Text(
                    r.ownerEmail,
                    style: TextStyle(color: c.textMuted, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ]),
              const SizedBox(height: 2),
              Row(children: [
                Icon(Icons.history_rounded, size: 11, color: c.textMuted),
                const SizedBox(width: 3),
                Text('Viewed ${_formatDate(r.viewedAt)}',
                    style: TextStyle(color: c.textMuted, fontSize: 11)),
              ]),
            ],
          ),
        ),
        if (r.shareCode.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: _cyan.withOpacity(0.18),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              r.shareCode,
              style: const TextStyle(color: _cyan, fontSize: 10, fontWeight: FontWeight.w700, fontFamily: 'monospace'),
            ),
          ),
        const SizedBox(width: 4),
        Icon(Icons.chevron_right_rounded, color: c.textMuted, size: 18),
      ]),
    );
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  void _openMap(MindMapModel m) {
    HapticFeedback.lightImpact();
    _recordView(m.id);
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => MindMapViewerScreen(mindMap: m)),
    );
  }

  Future<void> _openRecent(_RecentMap r) async {
    HapticFeedback.lightImpact();
    setState(() => _loading = true);
    try {
      final raw = await ApiService.getMap(r.id);
      final map = MindMapModel.fromApi(Map<String, dynamic>.from(raw));
      if (!mounted) return;
      setState(() => _loading = false);
      _recordView(map.id);
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => MindMapViewerScreen(mindMap: map)),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Map no longer available'),
          backgroundColor: AppColors.red,
        ),
      );
    }
  }
}
