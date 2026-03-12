import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import 'supabase_service.dart';

class NotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    try {
      // 1. Request permissions
      NotificationSettings settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        provisional: false,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        debugPrint('User granted notification permissions');
        
        // 2. Get FCM token and save to Supabase
        String? token = await _messaging.getToken();
        if (token != null) {
          await _updateFcmToken(token);
        }

        // 3. Listen for token refreshes
        _messaging.onTokenRefresh.listen(_updateFcmToken);

        // 4. Initialize local notifications for foreground alerts
        const AndroidInitializationSettings androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
        const DarwinInitializationSettings iosSettings = DarwinInitializationSettings();
        const InitializationSettings initSettings = InitializationSettings(android: androidSettings, iOS: iosSettings);
        
        await _localNotifications.initialize(initSettings);

        // 5. Handle foreground messages
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint('Got a message whilst in the foreground!');
          if (message.notification != null) {
            _showLocalNotification(message);
          }
        });
      }
    } catch (e) {
      debugPrint('Notification Service Initialization Error (May be missing google-services.json): $e');
    }
  }

  static Future<void> _updateFcmToken(String token) async {
    try {
      final user = SupabaseService.client.auth.currentUser;
      if (user != null) {
        await SupabaseService.client
            .from('users')
            .update({'fcm_token': token})
            .eq('id', user.id);
        debugPrint('FCM Token updated: $token');
      }
    } catch (e) {
      debugPrint('Error updating FCM token in Supabase: $e');
    }
  }

  static Future<void> _showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'aavija_vms_channel',
      'Aavija VMS Notifications',
      importance: Importance.max,
      priority: Priority.high,
    );
    const NotificationDetails platformDetails = NotificationDetails(android: androidDetails);
    
    await _localNotifications.show(
      message.hashCode,
      message.notification?.title,
      message.notification?.body,
      platformDetails,
    );
  }
}
