import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';

// ── Pastel palette ─────────────────────────────────────────────────────────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam = Color(0xFF7BB5B0);
const _pRose = Color(0xFFC99999);

class AttendanceCheckinScreen extends StatefulWidget {
  const AttendanceCheckinScreen({super.key});
  @override
  State<AttendanceCheckinScreen> createState() => _AttendanceCheckinScreenState();
}

class _AttendanceCheckinScreenState extends State<AttendanceCheckinScreen> {
  final MobileScannerController _scannerController = MobileScannerController();
  bool _processing = false;
  String? _result;
  String? _sessionTitle;
  bool? _success;

  /// Extracts the `token` query parameter from a URL, or returns the raw string.
  String _extractToken(String raw) {
    try {
      final uri = Uri.parse(raw);
      final token = uri.queryParameters['token'];
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}
    return raw;
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing || _result != null) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    setState(() => _processing = true);
    HapticFeedback.mediumImpact();

    try {
      final token = _extractToken(barcode.rawValue!);
      final data = await ApiService.attendanceCheckIn(token);
      if (mounted) {
        setState(() {
          _sessionTitle = data['session_title']?.toString();
          _result = _sessionTitle != null && _sessionTitle!.isNotEmpty
              ? 'Checked in: $_sessionTitle'
              : (data['message']?.toString() ?? 'You have been marked present.');
          _success = true;
          _processing = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _result = e.toString().replaceAll('Exception: ', '');
          _success = false;
          _processing = false;
        });
      }
    }
  }

  void _reset() {
    HapticFeedback.lightImpact();
    setState(() {
      _result = null;
      _success = null;
      _processing = false;
      _sessionTitle = null;
    });
  }

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
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
              title: const Text('QR Check-In',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              backgroundColor:
                  (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
              foregroundColor: c.textPrimary,
              elevation: 0,
              scrolledUnderElevation: 0,
              shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
            ),
          ),
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _result != null ? _buildResult() : _buildScanner(),
        ),
      ),
    );
  }

  Widget _buildScanner() {
    final c = context.colors;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
          child: GlassCard(
            gradient: LinearGradient(
              colors: [
                _pSlate.withOpacity(context.isDark ? 0.18 : 0.10),
                _pLavender.withOpacity(context.isDark ? 0.12 : 0.06),
              ],
            ),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: _pSlate.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(color: _pSlate.withOpacity(0.3)),
                  ),
                  child: const Icon(Icons.qr_code_scanner_rounded,
                      color: _pSlate, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Scan Attendance QR',
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 14)),
                      const SizedBox(height: 2),
                      Text(
                          'Point your camera at the QR shown by your lecturer',
                          style: TextStyle(color: c.textSecondary, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Stack(
                children: [
                  MobileScanner(
                    controller: _scannerController,
                    onDetect: _onDetect,
                  ),
                  // Cutout frame
                  Center(
                    child: Container(
                      width: 240,
                      height: 240,
                      decoration: BoxDecoration(
                        border: Border.all(color: _pSlate, width: 3),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: _pSlate.withOpacity(0.35),
                            blurRadius: 18,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_processing)
                    Container(
                      color: Colors.black.withOpacity(0.55),
                      child: const Center(
                        child: CircularProgressIndicator(color: _pLavender),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResult() {
    final c = context.colors;
    final color = _success == true ? _pSeafoam : _pRose;
    final icon =
        _success == true ? Icons.check_circle_rounded : Icons.error_rounded;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: GlassCard(
          padding: const EdgeInsets.all(24),
          gradient: LinearGradient(
            colors: [
              color.withOpacity(context.isDark ? 0.18 : 0.10),
              color.withOpacity(context.isDark ? 0.10 : 0.05),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 74,
                height: 74,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.18),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withOpacity(0.4), width: 2),
                ),
                child: Icon(icon, color: color, size: 38),
              ),
              const SizedBox(height: 18),
              Text(
                _success == true ? 'Check-in Successful' : 'Check-in Failed',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text(_result ?? '',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.textSecondary, fontSize: 13)),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_pSlate, _pLavender],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: _pSlate.withOpacity(0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ElevatedButton.icon(
                    onPressed: _reset,
                    icon: const Icon(Icons.qr_code_scanner_rounded,
                        size: 18, color: Colors.white),
                    label: const Text('Scan Again',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('Done',
                    style: TextStyle(color: c.textMuted, fontSize: 13)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
