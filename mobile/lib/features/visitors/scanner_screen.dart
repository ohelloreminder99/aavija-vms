import 'dart:io';
import 'package:flutter/material.dart';
import 'package:qr_code_scanner_plus/qr_code_scanner_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/app_theme.dart';
import '../../services/qr_verification_service.dart';
import '../../services/visit_checkout_service.dart';
import '../../models/visitor_model.dart';
import '../../providers/auth_provider.dart';

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key});

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen> {
  final GlobalKey qrKey = GlobalKey(debugLabel: 'QR');
  QRViewController? controller;
  bool _isProcessing = false;

  @override
  void reassemble() {
    super.reassemble();
    if (Platform.isAndroid) {
      controller?.pauseCamera();
    }
    controller?.resumeCamera();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gatekeeper Scanner'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Stack(
        children: [
          _buildQrView(context),
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'Scan Visitor Passport QRCode',
                  style: TextStyle(color: Colors.white),
                ),
              ),
            ),
          ),
          if (_isProcessing)
            Container(
              color: Colors.black45,
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildQrView(BuildContext context) {
    var scanArea = (MediaQuery.of(context).size.width < 400 ||
            MediaQuery.of(context).size.height < 400)
        ? 250.0
        : 300.0;
    
    return QRView(
      key: qrKey,
      onQRViewCreated: _onQRViewCreated,
      overlay: QrScannerOverlayShape(
          borderColor: AppTheme.primaryBlue,
          borderRadius: 10,
          borderLength: 30,
          borderWidth: 10,
          cutOutSize: scanArea),
      onPermissionSet: (ctrl, p) => _onPermissionSet(context, ctrl, p),
    );
  }

  void _onQRViewCreated(QRViewController controller) {
    setState(() {
      this.controller = controller;
    });
    controller.scannedDataStream.listen((scanData) async {
      if (_isProcessing || scanData.code == null) return;

      setState(() {
        _isProcessing = true;
      });
      controller.pauseCamera();

      final result = await QrVerificationService.processScannedToken(scanData.code!);

      if (mounted) {
        if (result != null) {
          final visitor = result['visitor'] as VisitorModel;
          final token = result['token'] as Map<String, dynamic>;
          
          // Fetch hosts temporarily using a dummy premise ID or getting it from the gatekeeper context
          final hosts = await QrVerificationService.getHostsForPremise('dummy-premise-id');
          _showVerificationProfile(visitor, hosts, token['id']);
        } else {
          _showError('Invalid QR Code');
        }
      }
    });
  }

  void _showVerificationProfile(VisitorModel visitor, List<HostModel> hosts, String tokenId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.darkBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) {
        return _ProfileVerificationSheet(
          visitor: visitor,
          hosts: hosts,
          tokenId: tokenId,
          onComplete: () {
            Navigator.pop(context);
            setState(() => _isProcessing = false);
            controller?.resumeCamera();
          },
          onCancel: () {
            Navigator.pop(context);
            setState(() => _isProcessing = false);
            controller?.resumeCamera();
          },
        );
      },
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
    setState(() => _isProcessing = false);
    controller?.resumeCamera();
  }

  void _onPermissionSet(BuildContext context, QRViewController ctrl, bool p) {
    if (!p) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No camera permission')),
      );
    }
  }

  @override
  void dispose() {
    super.dispose();
  }
}

class _ProfileVerificationSheet extends ConsumerStatefulWidget {
  final VisitorModel visitor;
  final List<HostModel> hosts;
  final String tokenId;
  final VoidCallback onComplete;
  final VoidCallback onCancel;

  const _ProfileVerificationSheet({
    required this.visitor,
    required this.hosts,
    required this.tokenId,
    required this.onComplete,
    required this.onCancel,
  });

  @override
  ConsumerState<_ProfileVerificationSheet> createState() => __ProfileVerificationSheetState();
}

class __ProfileVerificationSheetState extends ConsumerState<_ProfileVerificationSheet> {
  HostModel? selectedHost;
  String searchTerm = '';
  bool isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    final filteredHosts = widget.hosts.where((h) => 
      h.name.toLowerCase().contains(searchTerm.toLowerCase()) || 
      h.identity.toLowerCase().contains(searchTerm.toLowerCase())
    ).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: AppTheme.cardBg,
                backgroundImage: widget.visitor.photoUrl != null 
                    ? NetworkImage(widget.visitor.photoUrl!) 
                    : null,
                child: widget.visitor.photoUrl == null 
                    ? const Icon(Icons.person, size: 40, color: Colors.white24) 
                    : null,
              ),
              const SizedBox(width: 20),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.visitor.name,
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      widget.visitor.companyName ?? 'Independent Visitor',
                      style: const TextStyle(color: Colors.white54),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Divider(color: Colors.white10),
          const SizedBox(height: 16),
          _buildInfoRow(Icons.phone_outlined, 'Contact', widget.visitor.phone ?? 'Not provided'),
          _buildInfoRow(Icons.directions_car_outlined, 'Vehicle', widget.visitor.vehicleNumber ?? 'No Vehicle'),
          const SizedBox(height: 24),
          const Text(
            'Select Destination Host',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          if (widget.visitor.activeCheckinId != null)
             Container(
               margin: const EdgeInsets.symmetric(vertical: 12),
               padding: const EdgeInsets.all(12),
               decoration: BoxDecoration(
                 color: Colors.orange.withValues(alpha: 0.1),
                 borderRadius: BorderRadius.circular(12),
                 border: Border.all(color: Colors.orange.withValues(alpha: 0.2)),
               ),
               child: const Row(
                 children: [
                   Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 20),
                   SizedBox(width: 12),
                   Expanded(child: Text('Visitor is currently inside. Proceed to checkout?', style: TextStyle(color: Colors.orange, fontSize: 13))),
                 ],
               ),
             ),
          const SizedBox(height: 12),
          TextField(
            onChanged: (v) => setState(() => searchTerm = v),
            decoration: InputDecoration(
              hintText: widget.visitor.activeCheckinId != null ? 'Checking out...' : 'Search by Host or Flat...',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: AppTheme.cardBg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(15),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              itemCount: filteredHosts.length,
              itemBuilder: (context, index) {
                final host = filteredHosts[index];
                final isSelected = selectedHost?.id == host.id;
                return GestureDetector(
                  onTap: () => setState(() => selectedHost = host),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primaryBlue.withValues(alpha: 0.1) : AppTheme.cardBg,
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(
                        color: isSelected ? AppTheme.primaryBlue : Colors.transparent,
                      ),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: Colors.white10,
                          child: Text(host.identity.substring(0, 1)),
                        ),
                        const SizedBox(width: 16),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(host.identity, style: const TextStyle(fontWeight: FontWeight.bold)),
                            Text(host.name, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                          ],
                        ),
                        const Spacer(),
                        if (isSelected) const Icon(Icons.check_circle, color: AppTheme.primaryBlue),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (isSubmitting || (widget.visitor.activeCheckinId == null && selectedHost == null)) 
                  ? null 
                  : (widget.visitor.activeCheckinId != null ? _handleCheckout : _handleCheckin),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: widget.visitor.activeCheckinId != null ? Colors.orange : AppTheme.primaryBlue,
              ),
              child: isSubmitting 
                  ? const CircularProgressIndicator(color: Colors.white) 
                  : Text(
                      widget.visitor.activeCheckinId != null ? 'Confirm Check-out' : 'Confirm Check-in', 
                      style: const TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold)
                    ),
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: TextButton(
              onPressed: widget.onCancel,
              child: const Text('Cancel Verification', style: TextStyle(color: Colors.redAccent)),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppTheme.primaryBlue),
          const SizedBox(width: 12),
          Text('$label: ', style: const TextStyle(color: Colors.white54)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Future<void> _handleCheckin() async {
    setState(() => isSubmitting = true);
    
    final gatekeeper = ref.read(currentUserProvider);
    if (gatekeeper == null || selectedHost == null) return;

    final success = await QrVerificationService.finalizeCheckin(
      tokenId: widget.tokenId,
      visitorId: widget.visitor.id,
      hostId: selectedHost!.id,
      premiseId: 'dummy-premise-id', // In production, get from gatekeeper's profile
      gatekeeperId: gatekeeper.id,
    );

    if (success && mounted) {
      widget.onComplete();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check-in Successful!'), backgroundColor: Colors.green),
      );
    } else if (mounted) {
      setState(() => isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to complete check-in'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _handleCheckout() async {
    setState(() => isSubmitting = true);
    final gatekeeper = ref.read(currentUserProvider);
    if (gatekeeper == null || widget.visitor.activeCheckinId == null) return;

    final success = await VisitCheckoutService.checkoutVisitor(
      visitId: widget.visitor.activeCheckinId!,
      visitorId: widget.visitor.id,
      premiseId: null, // Gatekeeper context
      gatekeeperId: gatekeeper.id,
    );

    if (success && mounted) {
      widget.onComplete();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check-out Successful!'), backgroundColor: Colors.green),
      );
    } else if (mounted) {
      setState(() => isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to complete check-out'), backgroundColor: Colors.red),
      );
    }
  }
}
