import 'package:shared_preferences/shared_preferences.dart';

/// Persists the student's AI Companion on/off preference.
class CompanionPrefs {
  static const _key = 'ai_companion_enabled';

  static Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_key) ?? true; // default ON
  }

  static Future<void> setEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, value);
  }
}
