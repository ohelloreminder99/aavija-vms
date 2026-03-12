import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../services/supabase_service.dart';
import '../../core/app_theme.dart';

class GstDetailsScreen extends ConsumerStatefulWidget {
  const GstDetailsScreen({super.key});

  @override
  ConsumerState<GstDetailsScreen> createState() => _GstDetailsScreenState();
}

class _GstDetailsScreenState extends ConsumerState<GstDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _legalNameController = TextEditingController();
  final _gstNumberController = TextEditingController();
  final _billingAddressController = TextEditingController();
  final _billingStateController = TextEditingController();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  void _loadInitialData() {
    final profile = ref.read(userProfileProvider).value;
    if (profile != null) {
      _legalNameController.text = profile['legalName'] ?? '';
      _gstNumberController.text = profile['gstNumber'] ?? '';
      _billingAddressController.text = profile['billingAddress'] ?? '';
      _billingStateController.text = profile['billingState'] ?? '';
    }
  }

  @override
  void dispose() {
    _legalNameController.dispose();
    _gstNumberController.dispose();
    _billingAddressController.dispose();
    _billingStateController.dispose();
    super.dispose();
  }

  Future<void> _saveDetails() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final user = ref.read(currentUserProvider);

    try {
      await SupabaseService.client.from('users').update({
        'legalName': _legalNameController.text.trim(),
        'gstNumber': _gstNumberController.text.trim().toUpperCase(),
        'billingAddress': _billingAddressController.text.trim(),
        'billingState': _billingStateController.text.trim(),
      }).eq('id', user!.id);

      ref.invalidate(userProfileProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('GST details updated successfully')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        title: const Text('GST & Billing Details', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Update your legal information for invoices and tax purposes.',
                style: TextStyle(color: Colors.white38, fontSize: 14),
              ),
              const SizedBox(height: 32),
              _buildTextField('Legal Name', _legalNameController, Icons.business),
              const SizedBox(height: 20),
              _buildTextField('GST Number', _gstNumberController, Icons.confirmation_number_outlined),
              const SizedBox(height: 20),
              _buildTextField('Billing Address', _billingAddressController, Icons.location_on_outlined, maxLines: 3),
              const SizedBox(height: 20),
              _buildTextField('Billing State', _billingStateController, Icons.map_outlined),
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _saveDetails,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryBlue,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: _isSaving
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Save Billing Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField(String label, TextEditingController controller, IconData icon, {int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: const TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.1)),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          maxLines: maxLines,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppTheme.primaryBlue, size: 20),
            filled: true,
            fillColor: const Color(0xFF0F172A),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.05)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.05)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: AppTheme.primaryBlue),
            ),
          ),
        ),
      ],
    );
  }
}
