import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/section_header.dart';
import '../widgets/badge_chip.dart';
import '../widgets/confirmation_dialog.dart';

const _exceptionLabels = [
  'CUTI PERTENGAHAN SEMESTER IPG',
  'MINGGU ULANGKAJI',
  'PEPERIKSAAN AKHIR',
  'CUTI AKHIR SEMESTER IPG',
];

bool _isException(String topik) {
  final t = topik.trim().toUpperCase();
  return _exceptionLabels.any((l) => t.contains(l) || l.contains(t));
}

class LearningPlanScreen extends StatefulWidget {
  const LearningPlanScreen({super.key});
  @override
  State<LearningPlanScreen> createState() => _LearningPlanScreenState();
}

class _LearningPlanScreenState extends State<LearningPlanScreen> {
  int _step = 0;

  // Upload
  bool _uploading = false;
  String _uploadError = '';

  // Session
  String _sessionId = '';
  Map<String, dynamic> _metadata = {};
  List<Map<String, dynamic>> _weeks = [];

  // Configure
  List<int> _selectedWeeks = [];
  String _detailLevel = 'normal';
  List<Map<String, dynamic>> _kumpulanList = [
    {'nama': 'Kumpulan A', 'jumlah_pelajar': 23, 'kehadiran': 23},
  ];

  // Generate
  bool _generating = false;
  int _progressCurrent = 0;
  int _progressTotal = 0;
  String _progressTopik = '';
  String _generateError = '';

  // Generated draft
  Map<String, dynamic>? _generatedDraft;

  // Download
  List<int> _downloadWeeks = [];
  String _downloadFormat = 'xlsx';
  bool _downloading = false;

  // Drafts
  List<Map<String, dynamic>> _drafts = [];
  bool _loadingDrafts = false;

  // Expanded week for review
  int? _expandedWeek;

  @override
  void initState() {
    super.initState();
    _loadDrafts();
  }

  Future<void> _loadDrafts() async {
    setState(() => _loadingDrafts = true);
    try {
      final list = await ApiService.clpListDrafts();
      if (mounted) setState(() => _drafts = list.map((d) => Map<String, dynamic>.from(d)).toList());
    } catch (_) {}
    if (mounted) setState(() => _loadingDrafts = false);
  }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls', 'pdf'],
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.path == null) return;

    setState(() { _uploading = true; _uploadError = ''; });
    try {
      final res = await ApiService.clpUpload(file.path!, file.name);
      final weeks = (res['weeks'] as List).map((w) => Map<String, dynamic>.from(w)).toList();
      final selectable = weeks.where((w) => (w['topik'] ?? '').isNotEmpty && !_isException(w['topik'])).map((w) => w['minggu'] as int).toList();
      setState(() {
        _sessionId = res['session_id'] as String;
        _metadata = Map<String, dynamic>.from(res['metadata'] ?? {});
        _weeks = weeks;
        _selectedWeeks = selectable;
        _downloadWeeks = List.from(selectable);
        _step = 1;
      });
      HapticFeedback.mediumImpact();
    } catch (e) {
      setState(() => _uploadError = e.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _resumeDraft(String sid) async {
    try {
      final draft = await ApiService.clpGetDraft(sid);
      final weeks = (draft['weeks'] as List).map((w) => Map<String, dynamic>.from(w)).toList();
      final hasEnriched = weeks.any((w) => (w['hasil_pembelajaran'] ?? '').isNotEmpty);
      final selectable = weeks.where((w) => (w['topik'] ?? '').isNotEmpty && !_isException(w['topik'])).map((w) => w['minggu'] as int).toList();
      setState(() {
        _sessionId = draft['session_id'] as String;
        _metadata = Map<String, dynamic>.from(draft['metadata'] ?? {});
        _weeks = weeks;
        _selectedWeeks = selectable;
        _downloadWeeks = List.from(selectable);
        if (hasEnriched) {
          _generatedDraft = draft;
          _step = 3;
        } else {
          _step = 1;
        }
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load draft: $e'), backgroundColor: AppColors.red));
    }
  }

  Future<void> _deleteDraft(String sid) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Draft',
      message: 'Delete this saved draft?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok != true) return;
    try {
      await ApiService.clpDeleteDraft(sid);
      setState(() => _drafts.removeWhere((d) => d['session_id'] == sid));
    } catch (_) {}
  }

  Future<void> _generate() async {
    if (_sessionId.isEmpty || _selectedWeeks.isEmpty) return;
    setState(() { _generating = true; _generateError = ''; _progressCurrent = 0; _progressTotal = _selectedWeeks.length; _step = 2; });

    try {
      await for (final event in ApiService.clpGenerate({
        'session_id': _sessionId,
        'selected_weeks': _selectedWeeks,
        'kumpulan_list': _kumpulanList,
        'nama_kursus': _metadata['nama_kursus'],
        'kod_kursus': _metadata['kod_kursus'],
        'pensyarah': _metadata['pensyarah'],
        'detail_level': _detailLevel,
      })) {
        if (!mounted) return;
        final eventType = event['_event'] ?? '';
        if (eventType == 'progress') {
          setState(() {
            _progressCurrent = event['current'] ?? 0;
            _progressTotal = event['total'] ?? _selectedWeeks.length;
            _progressTopik = event['topik'] ?? '';
          });
        } else if (eventType == 'done') {
          final weeks = (event['weeks'] as List?)?.map((w) => Map<String, dynamic>.from(w)).toList() ?? _weeks;
          setState(() { _generatedDraft = event; _weeks = weeks; _step = 3; });
          HapticFeedback.mediumImpact();
        } else if (eventType == 'error' || event.containsKey('error')) {
          setState(() => _generateError = event['error']?.toString() ?? 'Unknown error');
        }
      }
    } catch (e) {
      if (mounted) setState(() => _generateError = e.toString());
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _download() async {
    if (_downloadWeeks.isEmpty) return;
    setState(() => _downloading = true);
    try {
      final bytes = await ApiService.clpDownload({
        'session_id': _sessionId,
        'selected_weeks': _downloadWeeks,
        'format': _downloadFormat,
      });
      final dir = Directory('/storage/emulated/0/Download');
      final ext = _downloadFormat == 'xlsx' ? 'xlsx' : 'zip';
      final filename = 'RPP_${_metadata['kod_kursus'] ?? 'Output'}.$ext';
      final file = File('${dir.path}/$filename');
      await file.writeAsBytes(bytes);
      HapticFeedback.mediumImpact();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Saved to Downloads/$filename')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Download failed: $e'), backgroundColor: AppColors.red));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  void _reset() {
    setState(() {
      _step = 0; _sessionId = ''; _metadata = {}; _weeks = [];
      _selectedWeeks = []; _generatedDraft = null; _progressCurrent = 0;
      _generateError = ''; _downloadWeeks = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Learning Plan', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          if (_step > 0)
            IconButton(icon: Icon(Icons.refresh_rounded, color: c.textSecondary), onPressed: _reset, tooltip: 'New Plan'),
        ],
      ),
      body: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          _stepper(c),
          const SizedBox(height: 16),
          if (_step == 0) ..._buildUploadStep(c),
          if (_step == 1) ..._buildConfigureStep(c),
          if (_step == 2) ..._buildGeneratingStep(c),
          if (_step == 3) ..._buildReviewStep(c),
        ],
      ),
    );
  }

  Widget _stepper(AppColorScheme c) {
    final labels = ['Upload', 'Configure', 'Generate', 'Download'];
    final icons = [Icons.upload_file_rounded, Icons.settings_rounded, Icons.auto_awesome_rounded, Icons.download_rounded];
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Row(
        children: List.generate(labels.length, (i) {
          final active = i == _step;
          final done = i < _step;
          return Expanded(
            child: Column(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: active ? AppColors.lecturerGradient : null,
                    color: done ? AppColors.emerald.withOpacity(0.2) : (active ? null : c.surfaceInput),
                  ),
                  child: Icon(
                    done ? Icons.check_rounded : icons[i],
                    size: 18,
                    color: done ? AppColors.emerald : (active ? Colors.white : c.textMuted),
                  ),
                ),
                const SizedBox(height: 4),
                Text(labels[i], style: TextStyle(fontSize: 10, color: active ? c.textPrimary : c.textMuted, fontWeight: active ? FontWeight.w600 : FontWeight.normal)),
              ],
            ),
          );
        }),
      ),
    );
  }

  // ── Step 0: Upload ──
  List<Widget> _buildUploadStep(AppColorScheme c) {
    return [
      if (_drafts.isNotEmpty) ...[
        const SectionHeader(title: 'Saved Drafts'),
        const SizedBox(height: 8),
        ..._drafts.map((d) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: GlassCard(
            onTap: () => _resumeDraft(d['session_id']),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.purple.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: const Icon(Icons.description_rounded, color: AppColors.purple, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d['nama_kursus'] ?? 'Untitled', style: TextStyle(color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                      Text('${d['kod_kursus'] ?? ''} \u00b7 ${d['week_count'] ?? 0} weeks', style: TextStyle(color: c.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.delete_outline_rounded, color: c.textMuted, size: 20),
                  onPressed: () => _deleteDraft(d['session_id']),
                ),
              ],
            ),
          ),
        )),
        const SizedBox(height: 16),
      ],
      // Upload area
      GestureDetector(
        onTap: _uploading ? null : _pickAndUpload,
        child: GlassCard(
          borderColor: AppColors.purple.withOpacity(0.3),
          padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: AppColors.purple.withOpacity(0.15),
                ),
                child: const Icon(Icons.upload_file_rounded, size: 28, color: AppColors.purple),
              ),
              const SizedBox(height: 16),
              Text('Upload Syllabus File', style: TextStyle(color: c.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Text(
                'Tap to select a .xlsx or .pdf file.\nAI will extract course metadata and weekly topics.',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textSecondary, fontSize: 13),
              ),
              if (_uploading) ...[
                const SizedBox(height: 16),
                const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.purple)),
                const SizedBox(height: 8),
                const Text('Extracting data...', style: TextStyle(color: AppColors.purple, fontSize: 13)),
              ],
              if (_uploadError.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(_uploadError, style: const TextStyle(color: AppColors.red, fontSize: 13), textAlign: TextAlign.center),
              ],
            ],
          ),
        ),
      ),
    ];
  }

  // ── Step 1: Configure ──
  List<Widget> _buildConfigureStep(AppColorScheme c) {
    return [
      GlassCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Course Metadata', style: TextStyle(color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            _metaField('Course Name', 'nama_kursus', c),
            _metaField('Course Code', 'kod_kursus', c),
            _metaField('Lecturer', 'pensyarah', c),
            _metaField('Program', 'program', c),
            _metaField('Semester', 'semester', c),
          ],
        ),
      ),
      const SizedBox(height: 12),
      GlassCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Select Weeks', style: TextStyle(color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
                GestureDetector(
                  onTap: () {
                    final all = _weeks.where((w) => !_isException(w['topik'] ?? '')).map((w) => w['minggu'] as int).toList();
                    setState(() => _selectedWeeks = _selectedWeeks.length == all.length ? [] : all);
                  },
                  child: Text(
                    _selectedWeeks.length == _weeks.where((w) => !_isException(w['topik'] ?? '')).length ? 'Deselect All' : 'Select All',
                    style: const TextStyle(color: AppColors.purple, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _weeks.map((w) {
                final exception = _isException(w['topik'] ?? '');
                final selected = _selectedWeeks.contains(w['minggu']);
                return GestureDetector(
                  onTap: exception ? null : () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      if (selected) { _selectedWeeks.remove(w['minggu']); } else { _selectedWeeks.add(w['minggu'] as int); }
                    });
                  },
                  child: Container(
                    width: 72,
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: exception ? c.surfaceInput.withOpacity(0.3) : (selected ? AppColors.purple.withOpacity(0.2) : c.surfaceInput),
                      border: selected && !exception ? Border.all(color: AppColors.purple.withOpacity(0.5)) : null,
                    ),
                    child: Column(
                      children: [
                        Text('W${w['minggu']}', style: TextStyle(
                          color: exception ? c.textMuted : (selected ? AppColors.purple : c.textSecondary),
                          fontSize: 13, fontWeight: FontWeight.w600,
                        )),
                        const SizedBox(height: 2),
                        Text(
                          (w['topik'] ?? '-').toString().length > 12
                              ? '${(w['topik'] ?? '-').toString().substring(0, 12)}...'
                              : (w['topik'] ?? '-').toString(),
                          style: TextStyle(color: c.textMuted, fontSize: 9),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      GlassCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('AI Detail Level', style: TextStyle(color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Row(
              children: ['normal', 'terperinci'].map((level) {
                final selected = _detailLevel == level;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _detailLevel = level);
                    },
                    child: Container(
                      margin: EdgeInsets.only(right: level == 'normal' ? 6 : 0, left: level == 'terperinci' ? 6 : 0),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        gradient: selected ? AppColors.lecturerGradient : null,
                        color: selected ? null : c.surfaceInput,
                      ),
                      child: Text(
                        level == 'normal' ? 'Normal' : 'Detailed',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: selected ? Colors.white : c.textSecondary, fontSize: 14, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        height: 48,
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), gradient: AppColors.lecturerGradient),
          child: ElevatedButton.icon(
            onPressed: _selectedWeeks.isEmpty ? null : _generate,
            icon: const Icon(Icons.auto_awesome_rounded, size: 20),
            label: Text('Generate ${_selectedWeeks.length} Week${_selectedWeeks.length > 1 ? 's' : ''}'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
      ),
    ];
  }

  Widget _metaField(String label, String key, AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: TextEditingController(text: _metadata[key]?.toString() ?? ''),
        onChanged: (v) => _metadata[key] = v,
        style: TextStyle(color: c.textPrimary, fontSize: 14),
        decoration: AppTheme.inputDecoration(context, label: label),
      ),
    );
  }

  // ── Step 2: Generating ──
  List<Widget> _buildGeneratingStep(AppColorScheme c) {
    final pct = _progressTotal > 0 ? _progressCurrent / _progressTotal : 0.0;
    return [
      GlassCard(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: AppColors.purple.withOpacity(0.15),
              ),
              child: const Icon(Icons.auto_awesome_rounded, size: 28, color: AppColors.purple),
            ),
            const SizedBox(height: 16),
            Text('Generating Content...', style: TextStyle(color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(
              'AI is creating learning outcomes, strategies, and reflections.',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 24),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 8,
                backgroundColor: c.surfaceElevated,
                valueColor: const AlwaysStoppedAnimation(AppColors.purple),
              ),
            ),
            const SizedBox(height: 8),
            Text('$_progressCurrent / $_progressTotal', style: const TextStyle(color: AppColors.purple, fontSize: 13, fontWeight: FontWeight.w600)),
            if (_progressTopik.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(_progressTopik, style: TextStyle(color: c.textMuted, fontSize: 12), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            if (_generateError.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(_generateError, style: const TextStyle(color: AppColors.red, fontSize: 13), textAlign: TextAlign.center),
            ],
          ],
        ),
      ),
    ];
  }

  // ── Step 3: Review + Download ──
  List<Widget> _buildReviewStep(AppColorScheme c) {
    final reviewWeeks = _generatedDraft != null
        ? (_generatedDraft!['weeks'] as List?)?.map((w) => Map<String, dynamic>.from(w)).toList() ?? _weeks
        : _weeks;

    return [
      const SectionHeader(title: 'Review Generated Content'),
      const SizedBox(height: 8),
      ...reviewWeeks.map((w) {
        final minggu = w['minggu'] as int;
        final expanded = _expandedWeek == minggu;
        final exception = _isException(w['topik'] ?? '');
        final hasContent = (w['hasil_pembelajaran'] ?? '').toString().isNotEmpty;
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: GlassCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: exception
                          ? AppColors.amber.withOpacity(0.2)
                          : (hasContent ? AppColors.emerald.withOpacity(0.2) : c.surfaceInput),
                    ),
                    child: Center(
                      child: Text(
                        '$minggu',
                        style: TextStyle(
                          color: exception ? AppColors.amber : (hasContent ? AppColors.emerald : c.textMuted),
                          fontSize: 13, fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  title: Text(w['topik'] ?? '-', style: TextStyle(color: c.textPrimary, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: w['tarikh'] != null && (w['tarikh'] as String).isNotEmpty
                      ? Text(w['tarikh'], style: TextStyle(color: c.textMuted, fontSize: 11))
                      : null,
                  trailing: Icon(expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: c.textMuted),
                  onTap: () => setState(() => _expandedWeek = expanded ? null : minggu),
                ),
                if (expanded && hasContent)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _contentBlock('Hasil Pembelajaran', w['hasil_pembelajaran'] ?? '', c),
                        _contentBlock('Strategi / Aktiviti', w['strategi_aktiviti'] ?? '', c),
                        _contentBlock('Refleksi Kuliah', w['refleksi'] ?? '', c),
                        _contentBlock('Refleksi Tutorial', w['refleksi_tutorial'] ?? '', c),
                        _contentBlock('Refleksi E-Pembelajaran', w['refleksi_epembelajaran'] ?? '', c),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      }),
      const SizedBox(height: 16),
      GlassCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Download', style: TextStyle(color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _weeks.where((w) => !_isException(w['topik'] ?? '')).map((w) {
                final sel = _downloadWeeks.contains(w['minggu']);
                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      if (sel) { _downloadWeeks.remove(w['minggu']); } else { _downloadWeeks.add(w['minggu'] as int); }
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: sel ? AppColors.purple.withOpacity(0.2) : c.surfaceInput,
                      border: sel ? Border.all(color: AppColors.purple.withOpacity(0.4)) : null,
                    ),
                    child: Text('W${w['minggu']}', style: TextStyle(color: sel ? AppColors.purple : c.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Row(
              children: ['xlsx', 'zip'].map((fmt) {
                final sel = _downloadFormat == fmt;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _downloadFormat = fmt);
                    },
                    child: Container(
                      margin: EdgeInsets.only(right: fmt == 'xlsx' ? 6 : 0, left: fmt == 'zip' ? 6 : 0),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        gradient: sel ? AppColors.lecturerGradient : null,
                        color: sel ? null : c.surfaceInput,
                      ),
                      child: Text(
                        fmt == 'xlsx' ? 'Single Excel' : 'ZIP (per group)',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: sel ? Colors.white : c.textSecondary, fontSize: 13),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: DecoratedBox(
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), gradient: AppColors.lecturerGradient),
                child: ElevatedButton.icon(
                  onPressed: _downloadWeeks.isEmpty || _downloading ? null : _download,
                  icon: _downloading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.download_rounded, size: 20),
                  label: Text(_downloading ? 'Generating...' : 'Download ${_downloadWeeks.length} Week${_downloadWeeks.length > 1 ? 's' : ''}'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ];
  }

  Widget _contentBlock(String label, String content, AppColorScheme c) {
    if (content.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.purple, fontSize: 11, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(content, style: TextStyle(color: c.textSecondary, fontSize: 13, height: 1.4)),
        ],
      ),
    );
  }
}
