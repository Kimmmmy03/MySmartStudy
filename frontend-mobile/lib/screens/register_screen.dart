import 'dart:async';

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_constants.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../utils/auth_events.dart';
import '../l10n/app_strings.dart';
import '../widgets/app_background.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/glass_card.dart';
import '../widgets/gradient_button.dart';

class RegisterScreen extends StatefulWidget {
  final bool googleMode;
  const RegisterScreen({super.key, this.googleMode = false});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _authService = AuthService();
  final _formKey = GlobalKey<FormState>();

  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _displayNameCtrl = TextEditingController();
  final _classUnitOtherCtrl = TextEditingController();
  final _departmentOtherCtrl = TextEditingController();

  String _role = 'student';
  int _year = 1;
  int _semester = 1;
  String? _classUnit; // null = not selected, kOtherOption = custom
  String? _department;
  bool _loading = false;
  bool _googleLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  bool get _isGoogleMode => widget.googleMode;

  @override
  void initState() {
    super.initState();
    if (_isGoogleMode) {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        _displayNameCtrl.text = user.displayName ?? '';
      }
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    _displayNameCtrl.dispose();
    _classUnitOtherCtrl.dispose();
    _departmentOtherCtrl.dispose();
    super.dispose();
  }

  /// Returns the class/unit value to save — either the dropdown selection
  /// or the typed custom value if "Other" was chosen.
  String _resolvedClassUnit() {
    if (_classUnit == kOtherOption) return _classUnitOtherCtrl.text.trim();
    return _classUnit?.trim() ?? '';
  }

  String _resolvedDepartment() {
    if (_department == kOtherOption) return _departmentOtherCtrl.text.trim();
    return _department?.trim() ?? '';
  }

  Future<bool> _confirmRegistration() async {
    final roleLabel = _role == 'student' ? 'student' : 'lecturers';
    final confirmed = await showConfirmationDialog(
      context: context,
      title: 'Confirm registration',
      message: 'This account will be registered for $roleLabel, Proceed?',
      confirmLabel: 'Proceed',
    );
    return confirmed == true;
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    // Skip the role-summary popup for Google signup (user already went
    // through the Google picker on the previous page).
    if (!_isGoogleMode) {
      if (!await _confirmRegistration()) return;
      if (!mounted) return;
    }
    setState(() => _loading = true);

    try {
      String? idToken;

      if (_isGoogleMode) {
        final user = FirebaseAuth.instance.currentUser;
        if (user == null) throw Exception('No Google user found. Please try again.');
        idToken = await user.getIdToken();
      } else {
        final cred = await _authService.register(
          email: _emailCtrl.text.trim(),
          password: _passwordCtrl.text,
        );
        final user = cred.user;
        if (user == null) throw Exception('Registration succeeded but user is null');
        await user.updateDisplayName(_displayNameCtrl.text.trim());
        idToken = await user.getIdToken();
      }

      if (idToken != null) {
        final isStudent = _role == 'student';
        await ApiService.syncUser(
          idToken: idToken,
          displayName: _displayNameCtrl.text.trim(),
          role: _role,
        );
        final updateFields = <String, dynamic>{
          'year': _year,
        };
        if (isStudent) {
          updateFields['class_name'] = _resolvedClassUnit();
          updateFields['semester'] = _semester;
        } else {
          updateFields['department'] = _resolvedDepartment();
        }
        await ApiService.updateMe(updateFields);
        // Fire-and-forget welcome email (matches web flow).
        unawaited(ApiService.sendWelcomeEmail());
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Account created successfully!'),
            backgroundColor: AppColors.emerald,
          ),
        );
        // Tell AuthGate to re-check the profile. If this screen was rendered
        // by AuthGate (googleMode at root), Navigator.pop is a no-op and this
        // notifier is what actually transitions us to MainShell.
        authProfileRefresh.value++;
        Navigator.pop(context);
      }
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      String message;
      switch (e.code) {
        case 'email-already-in-use':
          message = 'An account already exists with this email.';
          break;
        case 'invalid-email':
          message = 'Invalid email address.';
          break;
        case 'weak-password':
          message = 'Password is too weak.';
          break;
        default:
          message = e.message ?? 'Registration failed.';
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: AppColors.red),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Registration failed: ${e.toString()}'),
          backgroundColor: AppColors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _googleRegister() async {
    setState(() => _googleLoading = true);

    try {
      // AuthGate watches authStateChanges and handles routing:
      //   - existing profile → MainShell
      //   - no profile → it swaps this screen with RegisterScreen(googleMode).
      await _authService.signInWithGoogle();
      return;
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      if (e.code == 'sign-in-cancelled') return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message ?? 'Google sign-up failed.'),
          backgroundColor: AppColors.red,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Google sign-up failed: ${e.toString()}'),
          backgroundColor: AppColors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = S.of(context);
    final isStudent = _role == 'student';

    return Scaffold(
      backgroundColor: c.surface,
      body: AppBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const SizedBox(height: 12),

                  // Back button. When the screen is rendered at the Navigator
                  // root by AuthGate (e.g. first-time Google user), pop is a
                  // no-op — sign out Firebase so the gate returns to Login.
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: () async {
                        if (Navigator.canPop(context)) {
                          Navigator.pop(context);
                        } else {
                          await FirebaseAuth.instance.signOut();
                        }
                      },
                      icon: Icon(Icons.arrow_back_rounded, color: c.textPrimary),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Header
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AppColors.gradientForRole(_role),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accentForRole(_role).withOpacity(0.40),
                          blurRadius: 32,
                          spreadRadius: 4,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.person_add_rounded, color: Colors.white, size: 40),
                  ),
                  const SizedBox(height: 18),
                  ShaderMask(
                    blendMode: BlendMode.srcIn,
                    shaderCallback: (bounds) => AppColors.gradientForRole(_role).createShader(bounds),
                    child: Text(
                      _isGoogleMode ? 'Complete Your Profile' : s.createAccount,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _isGoogleMode
                        ? "You're signed in with Google. Choose your role and fill in your details."
                        : 'Join the MySmartStudy community',
                    style: TextStyle(color: c.textSecondary, fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),

                  // Role selector cards
                  Row(
                    children: [
                      Expanded(
                        child: _buildRoleCard(
                          label: s.student,
                          icon: Icons.school_rounded,
                          isSelected: isStudent,
                          gradient: AppColors.studentGradient,
                          onTap: () => setState(() => _role = 'student'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildRoleCard(
                          label: s.lecturer,
                          icon: Icons.cast_for_education_rounded,
                          isSelected: !isStudent,
                          gradient: AppColors.lecturerGradient,
                          onTap: () => setState(() => _role = 'lecturer'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Google Sign-Up (only when NOT in google redirect mode)
                  if (!_isGoogleMode) ...[
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: OutlinedButton.icon(
                        onPressed: (_googleLoading || _loading) ? null : _googleRegister,
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: c.border),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          backgroundColor: c.surfaceInput,
                        ),
                        icon: _googleLoading
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: c.textSecondary,
                                ),
                              )
                            : Icon(Icons.g_mobiledata_rounded, color: c.textPrimary, size: 26),
                        label: Text(
                          _googleLoading ? 'Signing up...' : 'Sign up with Google',
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(child: Divider(color: c.border)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            s.orContinueWith,
                            style: TextStyle(color: c.textMuted, fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ),
                        Expanded(child: Divider(color: c.border)),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Registration form
                  GlassCard(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _displayNameCtrl,
                          style: TextStyle(color: c.textPrimary),
                          decoration: AppTheme.inputDecoration(context, label: 'Full Name', prefixIcon: Icons.person_outlined),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                        ),
                        const SizedBox(height: 14),

                        if (!_isGoogleMode) ...[
                          TextFormField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            style: TextStyle(color: c.textPrimary),
                            decoration: AppTheme.inputDecoration(context, label: s.email, prefixIcon: Icons.email_outlined),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) return 'Email is required';
                              if (!v.contains('@')) return 'Enter a valid email';
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                        ],

                        if (isStudent) ...[
                          DropdownButtonFormField<String>(
                            value: _classUnit,
                            isExpanded: true,
                            dropdownColor: c.surfaceCard,
                            style: TextStyle(color: c.textPrimary),
                            decoration: AppTheme.inputDecoration(
                              context,
                              label: 'Class / Unit',
                              prefixIcon: Icons.class_rounded,
                            ),
                            hint: Text('Select your class / unit', style: TextStyle(color: c.textMuted)),
                            items: [
                              ...kClassUnits.map(
                                (u) => DropdownMenuItem(value: u, child: Text(u, overflow: TextOverflow.ellipsis)),
                              ),
                              const DropdownMenuItem(value: kOtherOption, child: Text('Other (specify)')),
                            ],
                            onChanged: (v) => setState(() => _classUnit = v),
                            validator: (v) => (v == null || v.isEmpty) ? 'Class/Unit is required' : null,
                          ),
                          if (_classUnit == kOtherOption) ...[
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _classUnitOtherCtrl,
                              style: TextStyle(color: c.textPrimary),
                              decoration: AppTheme.inputDecoration(
                                context,
                                label: 'Custom Class / Unit',
                                prefixIcon: Icons.edit_outlined,
                              ),
                              validator: (v) => (_classUnit == kOtherOption && (v == null || v.trim().isEmpty))
                                  ? 'Please specify your class/unit'
                                  : null,
                            ),
                          ],
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: DropdownButtonFormField<int>(
                                  value: _year,
                                  dropdownColor: c.surfaceCard,
                                  style: TextStyle(color: c.textPrimary),
                                  decoration: AppTheme.inputDecoration(context, label: 'Year', prefixIcon: Icons.calendar_today_outlined),
                                  items: [1, 2, 3, 4].map((y) => DropdownMenuItem(value: y, child: Text('Year $y'))).toList(),
                                  onChanged: (v) => setState(() => _year = v ?? 1),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: DropdownButtonFormField<int>(
                                  value: _semester,
                                  dropdownColor: c.surfaceCard,
                                  style: TextStyle(color: c.textPrimary),
                                  decoration: AppTheme.inputDecoration(context, label: 'Semester', prefixIcon: Icons.layers_outlined),
                                  items: const [
                                    DropdownMenuItem(value: 1, child: Text('Sem I')),
                                    DropdownMenuItem(value: 2, child: Text('Sem II')),
                                    DropdownMenuItem(value: 3, child: Text('Sem III')),
                                  ],
                                  onChanged: (v) => setState(() => _semester = v ?? 1),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                        ],

                        if (!isStudent) ...[
                          DropdownButtonFormField<int>(
                            value: _year,
                            dropdownColor: c.surfaceCard,
                            style: TextStyle(color: c.textPrimary),
                            decoration: AppTheme.inputDecoration(
                              context,
                              label: 'Year',
                              prefixIcon: Icons.calendar_today_outlined,
                            ),
                            items: [1, 2, 3, 4]
                                .map((y) => DropdownMenuItem(value: y, child: Text('Year $y')))
                                .toList(),
                            onChanged: (v) => setState(() => _year = v ?? 1),
                          ),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<String>(
                            value: _department,
                            isExpanded: true,
                            dropdownColor: c.surfaceCard,
                            style: TextStyle(color: c.textPrimary),
                            decoration: AppTheme.inputDecoration(
                              context,
                              label: 'Department',
                              prefixIcon: Icons.business_outlined,
                            ),
                            hint: Text('Select your department', style: TextStyle(color: c.textMuted)),
                            items: [
                              ...kDepartments.map(
                                (d) => DropdownMenuItem(value: d, child: Text(d, overflow: TextOverflow.ellipsis)),
                              ),
                              const DropdownMenuItem(value: kOtherOption, child: Text('Other (specify)')),
                            ],
                            onChanged: (v) => setState(() => _department = v),
                            validator: (v) => (v == null || v.isEmpty) ? 'Department is required' : null,
                          ),
                          if (_department == kOtherOption) ...[
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _departmentOtherCtrl,
                              style: TextStyle(color: c.textPrimary),
                              decoration: AppTheme.inputDecoration(
                                context,
                                label: 'Custom Department',
                                prefixIcon: Icons.edit_outlined,
                              ),
                              validator: (v) => (_department == kOtherOption && (v == null || v.trim().isEmpty))
                                  ? 'Please specify your department'
                                  : null,
                            ),
                          ],
                          const SizedBox(height: 14),
                        ],

                        if (!_isGoogleMode) ...[
                          Divider(color: c.border),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _passwordCtrl,
                            obscureText: _obscurePassword,
                            onChanged: (_) => setState(() {}),
                            style: TextStyle(color: c.textPrimary),
                            decoration: AppTheme.inputDecoration(
                              context,
                              label: s.password,
                              prefixIcon: Icons.lock_outlined,
                              suffix: GestureDetector(
                                onTap: () => setState(() => _obscurePassword = !_obscurePassword),
                                child: Icon(
                                  _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                  color: c.textMuted, size: 20,
                                ),
                              ),
                            ),
                            validator: (v) => (v == null || v.length < 6) ? 'Password must be at least 6 characters' : null,
                          ),
                          if (_passwordCtrl.text.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            _PasswordStrengthMeter(password: _passwordCtrl.text),
                          ],
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _confirmCtrl,
                            obscureText: _obscureConfirm,
                            style: TextStyle(color: c.textPrimary),
                            decoration: AppTheme.inputDecoration(
                              context,
                              label: 'Confirm Password',
                              prefixIcon: Icons.lock_reset_outlined,
                              suffix: GestureDetector(
                                onTap: () => setState(() => _obscureConfirm = !_obscureConfirm),
                                child: Icon(
                                  _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                  color: c.textMuted, size: 20,
                                ),
                              ),
                            ),
                            validator: (v) => (v != _passwordCtrl.text) ? 'Passwords do not match' : null,
                          ),
                        ],
                        const SizedBox(height: 24),

                        GradientButton(
                          label: _isGoogleMode ? 'Complete Registration' : s.createAccount,
                          role: _role,
                          isLoading: _loading,
                          onPressed: _loading ? null : _register,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(s.alreadyHaveAccount, style: TextStyle(color: c.textSecondary, fontSize: 14)),
                      const SizedBox(width: 4),
                      GestureDetector(
                        onTap: () async {
                          if (Navigator.canPop(context)) {
                            Navigator.pop(context);
                          } else {
                            // Rendered at root by AuthGate — sign out so the
                            // gate returns to Login.
                            await FirebaseAuth.instance.signOut();
                          }
                        },
                        child: Text(
                          s.signIn,
                          style: const TextStyle(color: AppColors.blue, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleCard({
    required String label,
    required IconData icon,
    required bool isSelected,
    required LinearGradient gradient,
    required VoidCallback onTap,
  }) {
    final c = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 22),
        decoration: BoxDecoration(
          gradient: isSelected ? gradient : null,
          color: isSelected ? null : c.surfaceCard.withOpacity(0.6),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? Colors.white.withOpacity(0.2) : c.border,
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: gradient.colors.first.withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Column(
          children: [
            Icon(icon, color: isSelected ? Colors.white : c.textMuted, size: 32),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : c.textMuted,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Live password-strength indicator that mirrors the web version:
/// four-segment bar + six-rule checklist (min length, lower, upper, number, symbol).
class _PasswordStrengthMeter extends StatelessWidget {
  final String password;
  const _PasswordStrengthMeter({required this.password});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final checks = <String, bool>{
      'At least 6 characters': password.length >= 6,
      'Lowercase letter (a-z)': RegExp(r'[a-z]').hasMatch(password),
      'Uppercase letter (A-Z)': RegExp(r'[A-Z]').hasMatch(password),
      'Number (0-9)': RegExp(r'[0-9]').hasMatch(password),
      'Special character (!@#…)': RegExp(r'[^a-zA-Z0-9]').hasMatch(password),
    };
    final passed = checks.values.where((v) => v).length;
    final level = passed <= 1 ? 0 : passed <= 2 ? 1 : passed <= 3 ? 2 : passed <= 4 ? 3 : 4;
    const labels = ['Too Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    const colors = [
      Color(0xFFEF4444), // red
      Color(0xFFF97316), // orange
      Color(0xFFEAB308), // yellow
      Color(0xFF34D399), // emerald light
      Color(0xFF10B981), // emerald
    ];
    final barColor = colors[level];
    final labelColor = level <= 1 ? colors[0] : level <= 2 ? colors[2] : colors[4];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (int i = 0; i < 4; i++) ...[
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: i <= level - 1 ? barColor : c.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              if (i < 3) const SizedBox(width: 4),
            ],
            const SizedBox(width: 8),
            Text(
              labels[level],
              style: TextStyle(
                color: labelColor,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: checks.entries.map((e) {
            final ok = e.value;
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  ok ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                  size: 12,
                  color: ok ? const Color(0xFF10B981) : c.textMuted,
                ),
                const SizedBox(width: 4),
                Text(
                  e.key,
                  style: TextStyle(
                    fontSize: 10.5,
                    color: ok ? const Color(0xFF10B981) : c.textMuted,
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ],
    );
  }
}
