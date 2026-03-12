import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:go_router/go_router.dart';
import '../../services/visitor_service.dart';
import '../../providers/auth_provider.dart';
import '../../core/app_theme.dart';
import '../../services/supabase_service.dart';

class PassportQRScreen extends ConsumerStatefulWidget {
  const PassportQRScreen({super.key});

  @override
  ConsumerState<PassportQRScreen> createState() => _PassportQRScreenState();
}

class _PassportQRScreenState extends ConsumerState<PassportQRScreen> {
  String? _token;
  int _timeLeft = 0;
  int _totalTime = 60;
  Timer? _timer;
  bool _isLoading = true;
  StreamSubscription? _statusSubscription;

  @override
  void initState() {
    super.initState();
    _generateToken();
  }

  Future<void> _generateToken() async {
    final user = ref.read(currentUserProvider);
    final profile = ref.read(userProfileProvider).value;
    
    if (user == null || profile == null) return;

    // Logic Parity: Web blocks QR generation if profile is incomplete
    final isNameComplete = (profile['name'] ?? '').toString().trim().isNotEmpty;
    final isPhoneComplete = (profile['phone'] ?? '').toString().trim().isNotEmpty;
    final isCityComplete = (profile['city'] ?? '').toString().trim().isNotEmpty;

    if (!isNameComplete || !isPhoneComplete || !isCityComplete) {
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            backgroundColor: const Color(0xFF0F172A),
            title: const Text('Profile Incomplete', style: TextStyle(color: Colors.white)),
            content: const Text(
              'Your profile must be fully completed before you can check in. Please add your name, city, and phone number.',
              style: TextStyle(color: Colors.white70),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.pop(); // Back to dashboard
                  context.push('/profile'); // To profile edit
                },
                child: const Text('Complete Profile'),
              ),
            ],
          ),
        );
      }
      return;
    }

    try {
      final result = await VisitorService.generateToken(user.id);
      if (result != null && mounted) {
        setState(() {
          _token = result['token'];
          _totalTime = result['expirySeconds'];
          _timeLeft = _totalTime;
          _isLoading = false;
        });
        _startTimer();
        _listenForCheckin(user.id, _token!);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
        context.pop();
      }
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_timeLeft > 0) {
        setState(() => _timeLeft--);
      } else {
        _timer?.cancel();
        _handleExpiry();
      }
    });
  }

  void _handleExpiry() {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pass expired, generating new one...')),
      );
      _generateToken();
    }
  }

  void _listenForCheckin(String userId, String tokenId) {
    _statusSubscription?.cancel();
    // In a real app, we'd listen for a state change on the token or a new visit record.
    // Mirroring web: Gatekeeper deletes the token upon successful checkin.
    // We can also listen for the user's active_checkin_id column.
    
    _statusSubscription = SupabaseService.client
        .from('users')
        .stream(primaryKey: ['id'])
        .eq('id', userId)
        .listen((data) {
          if (data.isNotEmpty) {
            final activeCheckinId = data.first['active_checkin_id'];
            if (activeCheckinId != null && mounted) {
              _onCheckinSuccess();
            }
          }
        });
  }

  void _onCheckinSuccess() {
    _timer?.cancel();
    _statusSubscription?.cancel();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check-in Verified! Welcome.'), backgroundColor: Colors.green),
      );
      context.pop(); // Return to dashboard which will now show the active pass
    }
  }

  @override
  void dispose() {
    if (_token != null) {
      VisitorService.deleteToken(_token!);
    }
    _timer?.cancel();
    _statusSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final double progress = _totalTime > 0 ? _timeLeft / _totalTime : 0;

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        title: const Text('Passport QR'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'Entry Pass Ready',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Show this QR code at the entry gate.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white38, fontSize: 16),
              ),
              const SizedBox(height: 48),
              _isLoading
                  ? const CircularProgressIndicator(color: AppTheme.primaryBlue)
                  : Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(32),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primaryBlue.withValues(alpha: 0.3),
                            blurRadius: 40,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: QrImageView(
                        data: _token!,
                        version: QrVersions.auto,
                        size: 240.0,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: Colors.black,
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: Colors.black,
                        ),
                      ),
                    ),
              const SizedBox(height: 48),
              if (!_isLoading) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'EXPIRES IN',
                      style: TextStyle(
                        color: Colors.white38,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                      ),
                    ),
                    Text(
                      '${_timeLeft}s',
                      style: const TextStyle(
                        color: AppTheme.primaryBlue,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: Colors.white10,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primaryBlue),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

