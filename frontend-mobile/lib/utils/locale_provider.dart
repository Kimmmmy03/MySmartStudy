import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kLocaleKey = 'app_locale';

class LocaleProvider extends ChangeNotifier {
  Locale _locale = const Locale('en');
  Locale get locale => _locale;

  LocaleProvider() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_kLocaleKey);
    if (code == 'ms') {
      _locale = const Locale('ms');
    } else {
      _locale = const Locale('en');
    }
    notifyListeners();
  }

  Future<void> setLocale(Locale l) async {
    _locale = l;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLocaleKey, l.languageCode);
  }

  bool get isMalay => _locale.languageCode == 'ms';
}

/// InheritedNotifier so descendants can access LocaleProvider.
class LocaleScope extends InheritedNotifier<LocaleProvider> {
  const LocaleScope({
    super.key,
    required LocaleProvider provider,
    required super.child,
  }) : super(notifier: provider);

  static LocaleProvider of(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<LocaleScope>()!
        .notifier!;
  }
}
