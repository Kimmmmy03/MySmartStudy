import "package:flutter/material.dart";
import "../services/api_service.dart";
import "../utils/app_theme.dart";
import "../utils/app_theme_ext.dart";

class SubjectFormScreen extends StatefulWidget {
  final Map<String, dynamic>? existingCourse;
  const SubjectFormScreen({super.key, this.existingCourse});
  @override
  State<SubjectFormScreen> createState() => _SubjectFormScreenState();
}

class _SubjectFormScreenState extends State<SubjectFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _codeCtrl;
  late final TextEditingController _descCtrl;
  String _semester = "1";
  bool _loading = false;

  bool get _isEdit => widget.existingCourse != null;

  @override
  void initState() {
    super.initState();
    final c = widget.existingCourse;
    _nameCtrl = TextEditingController(text: c?["course_name"]?.toString() ?? "");
    _codeCtrl = TextEditingController(text: c?["course_code"]?.toString() ?? "");
    _descCtrl = TextEditingController(text: c?["description"]?.toString() ?? "");
    _semester = c?["semester"]?.toString() ?? "1";
  }

  @override
  void dispose() { _nameCtrl.dispose(); _codeCtrl.dispose(); _descCtrl.dispose(); super.dispose(); }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      if (_isEdit) {
        await ApiService.updateCourse(widget.existingCourse!["id"].toString(), {
          "course_name": _nameCtrl.text.trim(),
          "course_code": _codeCtrl.text.trim(),
          "semester": _semester,
          "description": _descCtrl.text.trim(),
        });
      } else {
        await ApiService.createCourse(
          courseName: _nameCtrl.text.trim(),
          courseCode: _codeCtrl.text.trim(),
          semester: _semester,
          description: _descCtrl.text.trim(),
        );
      }
      if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_isEdit ? "Course updated" : "Course created"), backgroundColor: AppTheme.accentEmerald)); Navigator.pop(context); }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(title: Text(_isEdit ? "Edit Course" : "Create Course"), backgroundColor: Colors.transparent, foregroundColor: colors.textPrimary),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(key: _formKey, child: Container(
          padding: const EdgeInsets.all(24), decoration: AppTheme.glassCard(context),
          child: Column(children: [
            TextFormField(controller: _nameCtrl, style: TextStyle(color: colors.textPrimary), decoration: AppTheme.inputDecoration(context, label: "Course Name", prefixIcon: Icons.school_rounded), validator: (v) => (v == null || v.trim().isEmpty) ? "Required" : null),
            const SizedBox(height: 14),
            TextFormField(controller: _codeCtrl, style: TextStyle(color: colors.textPrimary), decoration: AppTheme.inputDecoration(context, label: "Course Code", prefixIcon: Icons.tag)),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _semester, dropdownColor: colors.surfaceCard, style: TextStyle(color: colors.textPrimary),
              decoration: AppTheme.inputDecoration(context, label: "Semester", prefixIcon: Icons.layers_outlined),
              items: ["1","2","3","4","5","6","7","Short"].map((s) => DropdownMenuItem(value: s, child: Text(s == "Short" ? "Short Sem" : "Semester $s"))).toList(),
              onChanged: (v) => setState(() => _semester = v ?? "1"),
            ),
            const SizedBox(height: 14),
            TextFormField(controller: _descCtrl, style: TextStyle(color: colors.textPrimary), maxLines: 3, decoration: AppTheme.inputDecoration(context, label: "Description", prefixIcon: Icons.description_outlined)),
            const SizedBox(height: 24),
            SizedBox(width: double.infinity, height: 48, child: ElevatedButton(
              onPressed: _loading ? null : _save,
              style: AppTheme.gradientButtonStyle(isLecturer: true),
              child: _loading ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(_isEdit ? "Update" : "Create"),
            )),
          ]),
        )),
      ),
    );
  }
}
