import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:logger/logger.dart';
import 'supabase_service.dart';

class AuthService {
  static final Logger _logger = Logger();
  final SupabaseClient _client = SupabaseService.client;

  Future<AuthResponse> signIn(String email, String password) async {
    try {
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      return response;
    } catch (e) {
      _logger.e('Auth Error: $e');
      rethrow;
    }
  }

  Future<AuthResponse> signUp(String email, String password) async {
    try {
      final response = await _client.auth.signUp(
        email: email,
        password: password,
      );
      return response;
    } catch (e) {
      _logger.e('Signup Error: $e');
      rethrow;
    }
  }

  Future<void> signInWithGoogle() async {
    try {
      await _client.auth.signInWithOAuth(
        OAuthProvider.google,
        // redirectTo: 'com.aavija.aavija_mobile://login-callback/',
      );
    } catch (e) {
      _logger.e('Google Auth Error: $e');
      rethrow;
    }
  }

  Future<void> resetPassword(String email) async {
    try {
      await _client.auth.resetPasswordForEmail(email);
    } catch (e) {
      _logger.e('Password Reset Error: $e');
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  Session? get currentSession => _client.auth.currentSession;
  User? get currentUser => _client.auth.currentUser;
}
