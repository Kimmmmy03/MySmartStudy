import "package:flutter/material.dart";
import "../services/api_service.dart";
import "../utils/app_theme.dart";
import "../utils/app_theme_ext.dart";

class JoinSubjectScreen extends StatefulWidget {
  const JoinSubjectScreen({super.key});
  @override
  State<JoinSubjectScreen> createState() => _JoinSubjectScreenState();
}

class _JoinSubjectScreenState extends State<JoinSubjectScreen> {
  final _codeCtrl = TextEditingController();
  bool _loading = false;

  Future<void> _join() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) return;
    setState(() => _loading = true);
    try {
      await ApiService.joinCourse(code);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Joined successfully!"), backgroundColor: AppTheme.accentEmerald));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Failed: $e"), backgroundColor: Colors.red));
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  void dispose() { _codeCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(title: const Text("Join Course"), backgroundColor: Colors.transparent, foregroundColor: colors.textPrimary),
      body: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.vpn_key_rounded, color: AppTheme.accentBlue, size: 64),
        const SizedBox(height: 24),
        Text("Enter Join Code", style: TextStyle(color: colors.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text("Ask your lecturer for the 6-character code", style: TextStyle(color: colors.textSecondary, fontSize: 14)),
        const SizedBox(height: 32),
        TextField(
          controller: _codeCtrl, textCapitalization: TextCapitalization.characters,
          textAlign: TextAlign.center, style: TextStyle(color: colors.textPrimary, fontSize: 28, letterSpacing: 8, fontWeight: FontWeight.bold),
          maxLength: 6,
          decoration: AppTheme.inputDecoration(context, label: ""),
        ),
        const SizedBox(height: 24),
        SizedBox(width: double.infinity, height: 50, child: ElevatedButton(
          onPressed: _loading ? null : _join, style: AppTheme.gradientButtonStyle(),
          child: _loading ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text("Join Course", style: TextStyle(fontSize: 16)),
        )),
      ])),
    );
  }
}
