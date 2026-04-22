import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/avatar_widget.dart';

// ── Pastel palette ─────────────────────────────────────────────────────────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam = Color(0xFF7BB5B0);
const _pSand = Color(0xFFC9A86A);
const _pRose = Color(0xFFC99999);
const _pSky = Color(0xFF8BB5C9);

class AttendanceSessionDetailScreen extends StatefulWidget {
  final String courseId;
  final String sessionId;
  final String sessionTitle;
  final String sessionDate;
  final String? sessionStartTime;
  final String? sessionEndTime;
  const AttendanceSessionDetailScreen({
    super.key,
    required this.courseId,
    required this.sessionId,
    required this.sessionTitle,
    required this.sessionDate,
    this.sessionStartTime,
    this.sessionEndTime,
  });
  @override
  State<AttendanceSessionDetailScreen> createState() => _AttendanceSessionDetailScreenState();
}

class _AttendanceSessionDetailScreenState extends State<AttendanceSessionDetailScreen> {
  Map<String, dynamic>? _session;
  List<Map<String, dynamic>> _students = [];
  Map<String, String> _statuses = {};
  bool _loading = true;
  bool _regenerating = false;
  String _saveStatus = 'idle'; // idle | saving | saved
  Timer? _saveTimer;
  Timer? _refreshTimer;
  Timer? _savedClearTimer;
  bool _initialLoad = true;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => _refresh());
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    _refreshTimer?.cancel();
    _savedClearTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait<dynamic>([
        ApiService.getAttendanceSession(widget.sessionId),
        ApiService.getCourseStudents(widget.courseId),
      ]);
      final sess = Map<String, dynamic>.from(results[0] as Map);
      final studs = (results[1] as List).map((s) => Map<String, dynamic>.from(s)).toList();

      final map = <String, String>{};
      final records = (sess['records'] as List?) ?? [];
      for (final r in records) {
        final rm = Map<String, dynamic>.from(r);
        map[rm['student_id']?.toString() ?? ''] = rm['status']?.toString() ?? 'absent';
      }
      for (final s in studs) {
        final id = s['id']?.toString() ?? '';
        if (id.isNotEmpty && !map.containsKey(id)) map[id] = 'absent';
      }
      if (!mounted) return;
      setState(() {
        _session = sess;
        _students = studs;
        _statuses = map;
        _loading = false;
      });
      Future.delayed(const Duration(milliseconds: 150), () {
        if (mounted) _initialLoad = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refresh() async {
    try {
      final sess = await ApiService.getAttendanceSession(widget.sessionId);
      if (!mounted) return;
      setState(() {
        _session = sess;
        final records = (sess['records'] as List?) ?? [];
        for (final r in records) {
          final rm = Map<String, dynamic>.from(r);
          final id = rm['student_id']?.toString() ?? '';
          // Only auto-update if not pending-save (merge newest backend state)
          if (id.isNotEmpty) _statuses[id] = rm['status']?.toString() ?? 'absent';
        }
      });
    } catch (_) {}
  }

  void _scheduleSave() {
    if (_initialLoad) return;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 1500), _commitSave);
  }

  Future<void> _commitSave() async {
    setState(() => _saveStatus = 'saving');
    try {
      final records = _statuses.entries
          .map<Map<String, dynamic>>((e) => {'student_id': e.key, 'status': e.value})
          .toList();
      await ApiService.bulkUpdateAttendance(widget.sessionId, records);
      if (!mounted) return;
      setState(() => _saveStatus = 'saved');
      _savedClearTimer?.cancel();
      _savedClearTimer = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _saveStatus = 'idle');
      });
    } catch (_) {
      if (mounted) setState(() => _saveStatus = 'idle');
    }
  }

  void _setStatus(String studentId, String status) {
    HapticFeedback.selectionClick();
    setState(() => _statuses[studentId] = status);
    _scheduleSave();
  }

  void _markAll(String status) {
    HapticFeedback.mediumImpact();
    setState(() {
      for (final s in _students) {
        final id = s['id']?.toString() ?? '';
        if (id.isNotEmpty) _statuses[id] = status;
      }
    });
    _scheduleSave();
  }

  Future<void> _regenerateQr() async {
    setState(() => _regenerating = true);
    HapticFeedback.mediumImpact();
    try {
      final res = await ApiService.attendanceRegenerateQr(widget.sessionId);
      if (!mounted) return;
      setState(() {
        if (_session != null) {
          _session = {..._session!, 'qr_token': res['qr_token']};
        }
      });
    } catch (_) {}
    if (mounted) setState(() => _regenerating = false);
  }

  int _countStatus(String status) =>
      _statuses.values.where((s) => s == status).length;

  String _headerSubtitle() {
    final startFromSess = _session?['start_time']?.toString() ?? '';
    final endFromSess = _session?['end_time']?.toString() ?? '';
    final start = startFromSess.isNotEmpty
        ? startFromSess
        : (widget.sessionStartTime ?? '');
    final end = endFromSess.isNotEmpty
        ? endFromSess
        : (widget.sessionEndTime ?? '');
    if (start.isNotEmpty && end.isNotEmpty) {
      return '${widget.sessionDate}  ·  $start – $end';
    }
    return widget.sessionDate;
  }

  String? _formatScannedAt(dynamic raw) {
    if (raw == null) return null;
    try {
      DateTime dt;
      if (raw is DateTime) {
        dt = raw;
      } else {
        final s = raw.toString();
        if (s.isEmpty) return null;
        dt = DateTime.parse(s).toLocal();
      }
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return null;
    }
  }

  Map<String, String> _scanTimes() {
    final result = <String, String>{};
    final records = (_session?['records'] as List?) ?? [];
    for (final r in records) {
      final rm = Map<String, dynamic>.from(r as Map);
      final id = rm['student_id']?.toString() ?? '';
      final at = _formatScannedAt(rm['scanned_at']);
      if (id.isNotEmpty && at != null) result[id] = at;
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight),
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: AppBar(
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.sessionTitle,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis),
                  Text(
                    _headerSubtitle(),
                    style: TextStyle(fontSize: 12, color: c.textSecondary),
                  ),
                ],
              ),
              backgroundColor:
                  (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
              foregroundColor: c.textPrimary,
              elevation: 0,
              scrolledUnderElevation: 0,
              shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
              actions: [
                if (_saveStatus != 'idle')
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Center(child: _saveChip()),
                  ),
              ],
            ),
          ),
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: _pSlate))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pSlate,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics()),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    children: [
                      _statsRow(),
                      const SizedBox(height: 16),
                      _qrCard(),
                      const SizedBox(height: 16),
                      _bulkActions(),
                      const SizedBox(height: 12),
                      _studentsList(),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _saveChip() {
    final saving = _saveStatus == 'saving';
    final color = saving ? _pSlate : _pSeafoam;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (saving)
            const SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(strokeWidth: 1.5, color: _pSlate),
            )
          else
            Icon(Icons.check_rounded, size: 12, color: color),
          const SizedBox(width: 6),
          Text(saving ? 'Saving…' : 'Saved',
              style: TextStyle(
                  fontSize: 11, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _statsRow() {
    return Row(
      children: [
        Expanded(child: _statTile('Present', _countStatus('present'), _pSeafoam, Icons.check_circle_rounded)),
        const SizedBox(width: 8),
        Expanded(child: _statTile('Late', _countStatus('late'), _pSand, Icons.schedule_rounded)),
        const SizedBox(width: 8),
        Expanded(child: _statTile('Absent', _countStatus('absent'), _pRose, Icons.cancel_rounded)),
        const SizedBox(width: 8),
        Expanded(child: _statTile('Excused', _countStatus('excused'), _pSky, Icons.shield_rounded)),
      ],
    );
  }

  Widget _statTile(String label, int count, Color color, IconData icon) {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Column(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(height: 4),
          Text('$count',
              style: TextStyle(
                  color: color, fontSize: 17, fontWeight: FontWeight.bold)),
          Text(label,
              style: TextStyle(color: c.textMuted, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _qrCard() {
    final c = context.colors;
    final token = _session?['qr_token']?.toString() ?? '';
    final qrUrl = token.isEmpty ? '' : token;
    return GlassCard(
      padding: const EdgeInsets.all(18),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          _pSlate.withOpacity(context.isDark ? 0.18 : 0.10),
          _pLavender.withOpacity(context.isDark ? 0.12 : 0.06),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _pLavender.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _pLavender.withOpacity(0.3)),
                ),
                child: const Icon(Icons.qr_code_2_rounded,
                    color: _pLavender, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('QR CHECK-IN',
                        style: TextStyle(
                            color: _pLavender,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1)),
                    const SizedBox(height: 2),
                    Text('Students scan to mark present',
                        style: TextStyle(color: c.textSecondary, fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (qrUrl.isEmpty)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text('QR token not available',
                  style: TextStyle(color: c.textMuted, fontSize: 12)),
            )
          else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: _pSlate.withOpacity(0.2),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: QrImageView(
                data: qrUrl,
                version: QrVersions.auto,
                size: 200,
                backgroundColor: Colors.white,
                errorCorrectionLevel: QrErrorCorrectLevel.H,
              ),
            ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _regenerating ? null : _regenerateQr,
            icon: _regenerating
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: _pSlate))
                : const Icon(Icons.refresh_rounded, size: 16, color: _pSlate),
            label: const Text('New QR',
                style: TextStyle(color: _pSlate, fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: _pSlate.withOpacity(0.4)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 6),
          Text('Auto-refreshes every 10s',
              style: TextStyle(color: c.textMuted, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _bulkActions() {
    return Row(
      children: [
        Expanded(
          child: _bulkBtn('All Present', Icons.check_circle_rounded, _pSeafoam,
              () => _markAll('present')),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _bulkBtn('All Absent', Icons.cancel_rounded, _pRose,
              () => _markAll('absent')),
        ),
      ],
    );
  }

  Widget _bulkBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    color: color, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _studentsList() {
    final c = context.colors;
    if (_students.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Text('No students enrolled',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.textMuted, fontSize: 13)),
      );
    }
    final scanTimes = _scanTimes();
    return Column(
      children: _students.map((s) {
        final id = s['id']?.toString() ?? '';
        final name = s['display_name']?.toString() ??
            s['displayName']?.toString() ??
            s['email']?.toString() ??
            'Student';
        final email = s['email']?.toString() ?? '';
        final status = _statuses[id] ?? 'absent';
        final scannedAt = scanTimes[id];

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: GlassCard(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AvatarWidget(
                      name: name,
                      imageUrl: (s['photo_url'] ?? s['photoURL'] ?? '').toString(),
                      size: 34,
                      role: 'student',
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: TextStyle(
                                  color: c.textPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis),
                          if (email.isNotEmpty)
                            Text(email,
                                style: TextStyle(color: c.textMuted, fontSize: 10),
                                overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                    if (scannedAt != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _pSeafoam.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: _pSeafoam.withOpacity(0.35)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.qr_code_scanner_rounded,
                                size: 11, color: _pSeafoam),
                            const SizedBox(width: 4),
                            Text(
                              scannedAt,
                              style: const TextStyle(
                                color: _pSeafoam,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _statusChip(id, status, 'present',
                          'Present', Icons.check_circle_rounded, _pSeafoam),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: _statusChip(id, status, 'late', 'Late',
                          Icons.schedule_rounded, _pSand),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: _statusChip(id, status, 'absent', 'Absent',
                          Icons.cancel_rounded, _pRose),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: _statusChip(id, status, 'excused', 'Excused',
                          Icons.shield_rounded, _pSky),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _statusChip(String studentId, String current, String target,
      String label, IconData icon, Color color) {
    final active = current == target;
    final c = context.colors;
    return GestureDetector(
      onTap: () => _setStatus(studentId, target),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
        decoration: BoxDecoration(
          color: active ? color.withOpacity(0.18) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? color.withOpacity(0.45) : c.border.withOpacity(0.4),
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 14, color: active ? color : c.textMuted),
            const SizedBox(height: 2),
            Text(label,
                style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                    color: active ? color : c.textMuted)),
          ],
        ),
      ),
    );
  }
}
