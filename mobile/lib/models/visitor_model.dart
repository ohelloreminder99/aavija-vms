class VisitorModel {
  final String id;
  final String name;
  final String type;
  final DateTime entryTime;
  final String status;
  final String? vehicleNumber;
  final String? phone;
  final String? companyName;
  final String? photoUrl;
  final String? countryCode;
  final String? activeCheckinId;

  VisitorModel({
    required this.id,
    required this.name,
    required this.type,
    required this.entryTime,
    required this.status,
    this.vehicleNumber,
    this.phone,
    this.companyName,
    this.photoUrl,
    this.countryCode,
    this.activeCheckinId,
  });

  factory VisitorModel.fromJson(Map<String, dynamic> json) {
    return VisitorModel(
      id: json['id'].toString(),
      name: json['name'] ?? 'Unknown',
      type: json['type'] ?? 'Guest',
      entryTime: DateTime.parse(json['entry_time'] ?? DateTime.now().toIso8601String()),
      status: json['status'] ?? 'Pending',
      vehicleNumber: json['vehicle_number'],
      phone: json['phone'],
      companyName: json['company_name'],
      photoUrl: json['photo_url'],
      countryCode: json['country_code'],
      activeCheckinId: json['active_checkin_id'],
    );
  }
}

class HostModel {
  final String id;
  final String name;
  final String identity; // e.g., 'Flat 101'
  final String? photoUrl;
  final bool isDisabled;

  HostModel({
    required this.id,
    required this.name,
    required this.identity,
    this.photoUrl,
    this.isDisabled = false,
  });

  factory HostModel.fromJson(Map<String, dynamic> json) {
    return HostModel(
      id: json['id'].toString(),
      name: json['name'] ?? 'Unknown Host',
      identity: json['identity'] ?? 'N/A',
      photoUrl: json['photo_url'],
      isDisabled: json['is_disabled'] ?? false,
    );
  }
}
