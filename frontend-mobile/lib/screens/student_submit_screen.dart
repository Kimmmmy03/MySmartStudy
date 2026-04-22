import "package:flutter/material.dart";
import "../models/submission_model.dart";
import "../services/api_service.dart";
import "../utils/app_theme.dart";
import "../utils/app_theme_ext.dart";
import "../widgets/skeletons.dart";

class StudentSubmitScreen extends StatefulWidget {
  final String assignmentId;
  final String assignmentTitle;
  final String courseId;
  const StudentSubmitScreen({super.key, required this.assignmentId, required this.assignmentTitle, required this.courseId});
  @override
  State<StudentSubmitScreen> createState() => _StudentSubmitScreenState();
}

class _StudentSubmitScreenState extends State<StudentSubmitScreen> {
  final _linkCtrl = TextEditingController();
  final _commentsCtrl = TextEditingController();
  bool _saving = false;
  bool _loading = true;
  SubmissionModel? _existing;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getMySubmission(widget.assignmentId);
      if (raw != null && mounted) {
        final sub = SubmissionModel.fromApi(Map<String, dynamic>.from(raw));
        setState(() { _existing = sub; _linkCtrl.text = sub.externalLink; _commentsCtrl.text = sub.comments; _loading = false; });
      } else {
        if (mounted) setState(() => _loading = false);
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _submit() async {
    final link = _linkCtrl.text.trim();
    if (link.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Please enter a link to your work")));
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiService.submitAssignment(widget.assignmentId, {
        "submission_type": "external_link",
        "external_link": link,
        "comments": _commentsCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Submitted successfully!"), backgroundColor: AppTheme.accentEmerald));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
    } finally { if (mounted) setState(() => _saving = false); }
  }

  @override
  void dispose() { _linkCtrl.dispose(); _commentsCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(title: const Text("Submit Assignment"), backgroundColor: Colors.transparent, foregroundColor: colors.textPrimary),
      body: _loading
          ? const SkeletonDetail()
          : SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(children: [
              // Assignment title
              Container(
                width: double.infinity, padding: const EdgeInsets.all(16), decoration: AppTheme.glassCard(context),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.assignmentTitle, style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text("Course assignment submission", style: TextStyle(color: colors.textSecondary, fontSize: 13)),
                ]),
              ),
              const SizedBox(height: 16),

              // Existing submission status
              if (_existing != null) ...[
                Container(
                  width: double.infinity, padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: _existing!.isGraded ? AppTheme.accentEmerald.withOpacity(0.1) : AppTheme.accentAmber.withOpacity(0.1),
                    border: Border.all(color: _existing!.isGraded ? AppTheme.accentEmerald.withOpacity(0.3) : AppTheme.accentAmber.withOpacity(0.3)),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text("STATUS", style: TextStyle(color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(color: _existing!.isGraded ? AppTheme.accentEmerald : AppTheme.accentAmber, borderRadius: BorderRadius.circular(8)),
                        child: Text(_existing!.isGraded ? "GRADED" : "SUBMITTED", style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ]),
                    if (_existing!.isGraded) ...[
                      const SizedBox(height: 12),
                      Text(_existing!.gradeLetterAndPercent, style: TextStyle(color: AppTheme.accentEmerald, fontSize: 28, fontWeight: FontWeight.bold)),
                      if (_existing!.feedback.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text("Feedback:", style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.bold)),
                        Text(_existing!.feedback, style: TextStyle(color: colors.textSecondary, height: 1.4)),
                      ],
                    ] else ...[
                      const SizedBox(height: 8),
                      Text("Your work has been received. Awaiting grading.", style: TextStyle(color: colors.textSecondary)),
                    ],
                  ]),
                ),
                const SizedBox(height: 16),
              ],

              // Submission form
              Container(
                padding: const EdgeInsets.all(24), decoration: AppTheme.glassCard(context),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text("SUBMISSION", style: TextStyle(color: AppTheme.accentBlue, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _linkCtrl, style: TextStyle(color: colors.textPrimary),
                    decoration: AppTheme.inputDecoration(context, label: "Shareable Link", prefixIcon: Icons.link_rounded),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _commentsCtrl, style: TextStyle(color: colors.textPrimary), maxLines: 3,
                    decoration: AppTheme.inputDecoration(context, label: "Comments (optional)", prefixIcon: Icons.comment_outlined),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(width: double.infinity, height: 48, child: ElevatedButton(
                    onPressed: _saving ? null : _submit, style: AppTheme.gradientButtonStyle(),
                    child: _saving
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                        : Text(_existing == null ? "Submit Work" : "Update Submission"),
                  )),
                ]),
              ),
              const SizedBox(height: 16),

              // Tip
              Container(
                padding: const EdgeInsets.all(14), decoration: AppTheme.glassCard(context),
                child: Row(children: [
                  const Icon(Icons.info_outline, color: AppTheme.accentBlue, size: 18), const SizedBox(width: 10),
                  Expanded(child: Text("Ensure sharing permissions are set to 'Anyone with link'.", style: TextStyle(color: colors.textSecondary, fontSize: 12))),
                ]),
              ),
            ])),
    );
  }
}
