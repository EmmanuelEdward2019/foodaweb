# Flutter Mobile Apps - Implementation Guide & Best Practices

## Table of Contents
1. [Flutter User App Implementation](#1-flutter-user-app-implementation)
2. [Flutter Delivery App Implementation](#2-flutter-delivery-app-implementation)
3. [Security Best Practices](#3-security-best-practices)
4. [Performance Optimizations](#4-performance-optimizations)
5. [Scalability Improvements](#5-scalability-improvements)

---

## 1. Flutter User App Implementation

### 1.1 Project Setup

#### Dependencies (pubspec.yaml)
```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Supabase
  supabase_flutter: ^2.0.0
  
  # State Management
  flutter_riverpod: ^2.4.0  # or provider, bloc
  
  # Storage
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.0
  
  # HTTP & Network
  dio: ^5.4.0
  connectivity_plus: ^5.0.0
  
  # UI & Navigation
  go_router: ^13.0.0
  cached_network_image: ^3.3.0
  flutter_svg: ^2.0.0
  
  # Maps & Location
  google_maps_flutter: ^2.5.0
  geolocator: ^10.1.0
  geocoding: ^2.1.0
  
  # Payments
  flutter_paystack: ^1.0.7
  
  # Push Notifications
  firebase_messaging: ^14.7.0
  firebase_core: ^2.24.0
  
  # Utils
  intl: ^0.18.0
  uuid: ^4.0.0
  image_picker: ^1.0.0
```

---

### 1.2 Authentication Flow

#### Step 1: Initialize Supabase

```dart
// lib/core/services/supabase_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static Future<void> initialize() async {
    await Supabase.initialize(
      url: 'https://dukvrgupgtymxxbqpctq.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
      realtimeClientOptions: const RealtimeClientOptions(
        logLevel: RealtimeLogLevel.info,
      ),
    );
  }
  
  static SupabaseClient get client => Supabase.instance.client;
}
```

#### Step 2: Authentication Service

```dart
// lib/core/services/auth_service.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  final SupabaseClient _supabase = Supabase.instance.client;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  
  // Keys for secure storage
  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userIdKey = 'user_id';
  static const String _userRoleKey = 'user_role';
  
  /// Sign Up (Customer)
  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    try {
      final response = await _supabase.auth.signUp(
        email: email,
        password: password,
        data: {
          'role': 'customer',
          'full_name': fullName,
          'phone': phone,
        },
      );
      
      if (response.user != null) {
        await _saveTokens(response.session!);
      }
      
      return response;
    } on AuthException catch (e) {
      throw AuthException(e.message);
    } catch (e) {
      throw Exception('Sign up failed: $e');
    }
  }
  
  /// Sign In
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      
      if (response.session != null) {
        await _saveTokens(response.session!);
      }
      
      return response;
    } on AuthException catch (e) {
      throw AuthException(e.message);
    } catch (e) {
      throw Exception('Sign in failed: $e');
    }
  }
  
  /// Sign Out
  Future<void> signOut() async {
    try {
      await _supabase.auth.signOut();
      await _clearTokens();
    } catch (e) {
      throw Exception('Sign out failed: $e');
    }
  }
  
  /// Get Current User
  User? get currentUser => _supabase.auth.currentUser;
  
  /// Get User Role
  String? get userRole => currentUser?.userMetadata?['role'];
  
  /// Check if User is Authenticated
  bool get isAuthenticated => currentUser != null;
  
  /// Save Tokens Securely
  Future<void> _saveTokens(Session session) async {
    await _secureStorage.write(
      key: _accessTokenKey,
      value: session.accessToken,
    );
    await _secureStorage.write(
      key: _refreshTokenKey,
      value: session.refreshToken,
    );
    await _secureStorage.write(
      key: _userIdKey,
      value: session.user.id,
    );
    await _secureStorage.write(
      key: _userRoleKey,
      value: session.user.userMetadata?['role'] ?? '',
    );
  }
  
  /// Clear Tokens
  Future<void> _clearTokens() async {
    await _secureStorage.deleteAll();
  }
  
  /// Get Stored Access Token
  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _accessTokenKey);
  }
  
  /// Refresh Session
  Future<void> refreshSession() async {
    try {
      final refreshToken = await _secureStorage.read(key: _refreshTokenKey);
      if (refreshToken != null) {
        final response = await _supabase.auth.refreshSession();
        if (response.session != null) {
          await _saveTokens(response.session!);
        }
      }
    } catch (e) {
      throw Exception('Session refresh failed: $e');
    }
  }
  
  /// Listen to Auth State Changes
  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;
}
```

#### Step 3: Auth State Provider (Riverpod)

```dart
// lib/features/auth/providers/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authServiceProvider = Provider((ref) => AuthService());

final authStateProvider = StreamProvider<AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.authStateChanges;
});

final currentUserProvider = Provider<User?>((ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.currentUser;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.isAuthenticated;
});
```

---

### 1.3 API Service Layer

#### Base API Service

```dart
// lib/core/services/api_service.dart
import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ApiService {
  final SupabaseClient _supabase = Supabase.instance.client;
  late final Dio _dio;
  
  ApiService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: 'https://dukvrgupgtymxxbqpctq.supabase.co/rest/v1',
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      ),
    );
    
    // Add interceptors
    _dio.interceptors.add(_AuthInterceptor(_supabase));
    _dio.interceptors.add(_ErrorInterceptor());
    _dio.interceptors.add(_LoggingInterceptor());
  }
  
  Dio get dio => _dio;
  SupabaseClient get supabase => _supabase;
}

/// Auth Interceptor - Adds JWT token to requests
class _AuthInterceptor extends Interceptor {
  final SupabaseClient _supabase;
  
  _AuthInterceptor(this._supabase);
  
  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final session = _supabase.auth.currentSession;
    if (session != null) {
      options.headers['Authorization'] = 'Bearer ${session.accessToken}';
    }
    handler.next(options);
  }
}

/// Error Interceptor - Handles API errors
class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final error = _handleError(err);
    handler.reject(DioException(
      requestOptions: err.requestOptions,
      error: error,
      type: err.type,
    ));
  }
  
  ApiException _handleError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          message: 'Connection timeout. Please check your internet.',
          code: 'TIMEOUT',
        );
        
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final data = error.response?.data;
        
        switch (statusCode) {
          case 400:
            return ApiException(
              message: data?['message'] ?? 'Bad request',
              code: 'BAD_REQUEST',
            );
          case 401:
            return ApiException(
              message: 'Unauthorized. Please login again.',
              code: 'UNAUTHORIZED',
            );
          case 403:
            return ApiException(
              message: 'Access forbidden',
              code: 'FORBIDDEN',
            );
          case 404:
            return ApiException(
              message: 'Resource not found',
              code: 'NOT_FOUND',
            );
          case 500:
            return ApiException(
              message: 'Server error. Please try again later.',
              code: 'SERVER_ERROR',
            );
          default:
            return ApiException(
              message: data?['message'] ?? 'An error occurred',
              code: 'UNKNOWN',
            );
        }
        
      case DioExceptionType.cancel:
        return ApiException(
          message: 'Request cancelled',
          code: 'CANCELLED',
        );
        
      default:
        return ApiException(
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR',
        );
    }
  }
}

/// Logging Interceptor - Logs requests and responses
class _LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    print('REQUEST[${options.method}] => PATH: ${options.path}');
    handler.next(options);
  }
  
  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    print('RESPONSE[${response.statusCode}] => DATA: ${response.data}');
    handler.next(response);
  }
  
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    print('ERROR[${err.response?.statusCode}] => MESSAGE: ${err.message}');
    handler.next(err);
  }
}

/// Custom API Exception
class ApiException implements Exception {
  final String message;
  final String code;
  
  ApiException({required this.message, required this.code});
  
  @override
  String toString() => message;
}
```

---

### 1.4 Vendor Service Example

```dart
// lib/features/vendors/services/vendor_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class VendorService {
  final SupabaseClient _supabase = Supabase.instance.client;
  
  /// Get All Active Vendors
  Future<List<Vendor>> getVendors({
    int limit = 20,
    int offset = 0,
  }) async {
    try {
      final response = await _supabase
          .from('vendors')
          .select()
          .eq('is_active', true)
          .order('name')
          .range(offset, offset + limit - 1);
      
      return (response as List)
          .map((json) => Vendor.fromJson(json))
          .toList();
    } on PostgrestException catch (e) {
      throw ApiException(
        message: 'Failed to load vendors: ${e.message}',
        code: e.code ?? 'VENDOR_FETCH_ERROR',
      );
    } catch (e) {
      throw ApiException(
        message: 'Unexpected error: $e',
        code: 'UNKNOWN',
      );
    }
  }
  
  /// Search Vendors
  Future<List<Vendor>> searchVendors(String query) async {
    try {
      final response = await _supabase
          .from('vendors')
          .select()
          .ilike('name', '%$query%')
          .eq('is_active', true)
          .limit(20);
      
      return (response as List)
          .map((json) => Vendor.fromJson(json))
          .toList();
    } catch (e) {
      throw ApiException(
        message: 'Search failed: $e',
        code: 'SEARCH_ERROR',
      );
    }
  }
  
  /// Get Vendor Details
  Future<Vendor> getVendorById(String vendorId) async {
    try {
      final response = await _supabase
          .from('vendors')
          .select()
          .eq('id', vendorId)
          .single();
      
      return Vendor.fromJson(response);
    } on PostgrestException catch (e) {
      if (e.code == 'PGRST116') {
        throw ApiException(
          message: 'Vendor not found',
          code: 'NOT_FOUND',
        );
      }
      throw ApiException(
        message: 'Failed to load vendor: ${e.message}',
        code: e.code ?? 'VENDOR_FETCH_ERROR',
      );
    }
  }
  
  /// Get Vendor Menu
  Future<List<MenuItem>> getVendorMenu(String vendorId) async {
    try {
      final response = await _supabase
          .from('menu_items')
          .select('*, menu_categories(*), menu_item_addons(*)')
          .eq('vendor_id', vendorId)
          .eq('is_available', true)
          .order('sort_order');
      
      return (response as List)
          .map((json) => MenuItem.fromJson(json))
          .toList();
    } catch (e) {
      throw ApiException(
        message: 'Failed to load menu: $e',
        code: 'MENU_FETCH_ERROR',
      );
    }
  }
}
```

---

### 1.5 Order Service Example

```dart
// lib/features/orders/services/order_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class OrderService {
  final SupabaseClient _supabase = Supabase.instance.client;
  
  /// Create Order
  Future<Order> createOrder({
    required String vendorId,
    required List<OrderItem> items,
    required Map<String, dynamic> deliveryAddress,
    required double deliveryLatitude,
    required double deliveryLongitude,
    String? notes,
  }) async {
    try {
      final userId = _supabase.auth.currentUser!.id;
      
      // Calculate totals
      final subtotal = items.fold<double>(
        0,
        (sum, item) => sum + (item.price * item.quantity),
      );
      final taxAmount = subtotal * 0.075; // 7.5% tax
      const deliveryFee = 500.0;
      final totalAmount = subtotal + taxAmount + deliveryFee;
      
      // Create order
      final orderResponse = await _supabase
          .from('orders')
          .insert({
            'customer_id': userId,
            'vendor_id': vendorId,
            'order_number': 'ORD-${DateTime.now().millisecondsSinceEpoch}',
            'status': 'pending',
            'subtotal': subtotal,
            'tax_amount': taxAmount,
            'delivery_fee': deliveryFee,
            'total_amount': totalAmount,
            'payment_method': 'card',
            'payment_status': 'pending',
            'delivery_address': deliveryAddress,
            'delivery_latitude': deliveryLatitude,
            'delivery_longitude': deliveryLongitude,
            'notes': notes,
          })
          .select()
          .single();
      
      final orderId = orderResponse['id'];
      
      // Create order items
      await _supabase.from('order_items').insert(
            items
                .map((item) => {
                      'order_id': orderId,
                      'menu_item_id': item.menuItemId,
                      'quantity': item.quantity,
                      'price_per_unit': item.price,
                      'total_price': item.price * item.quantity,
                      'special_instructions': item.specialInstructions,
                    })
                .toList(),
          );
      
      return Order.fromJson(orderResponse);
    } on PostgrestException catch (e) {
      throw ApiException(
        message: 'Failed to create order: ${e.message}',
        code: e.code ?? 'ORDER_CREATE_ERROR',
      );
    } catch (e) {
      throw ApiException(
        message: 'Unexpected error: $e',
        code: 'UNKNOWN',
      );
    }
  }
  
  /// Get Customer Orders
  Future<List<Order>> getCustomerOrders() async {
    try {
      final userId = _supabase.auth.currentUser!.id;
      
      final response = await _supabase
          .from('orders')
          .select('*, order_items(*, menu_items(*)), vendors(*)')
          .eq('customer_id', userId)
          .order('created_at', ascending: false)
          .limit(50);
      
      return (response as List)
          .map((json) => Order.fromJson(json))
          .toList();
    } catch (e) {
      throw ApiException(
        message: 'Failed to load orders: $e',
        code: 'ORDER_FETCH_ERROR',
      );
    }
  }
  
  /// Get Order Details
  Future<Order> getOrderById(String orderId) async {
    try {
      final response = await _supabase
          .from('orders')
          .select('''
            *,
            order_items(*, menu_items(*)),
            vendors(*),
            delivery_riders(*)
          ''')
          .eq('id', orderId)
          .single();
      
      return Order.fromJson(response);
    } catch (e) {
      throw ApiException(
        message: 'Failed to load order: $e',
        code: 'ORDER_FETCH_ERROR',
      );
    }
  }
  
  /// Track Order (Real-time)
  Stream<Order> trackOrder(String orderId) {
    return _supabase
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('id', orderId)
        .map((data) => Order.fromJson(data.first));
  }
  
  /// Cancel Order
  Future<void> cancelOrder(String orderId, String reason) async {
    try {
      await _supabase
          .from('orders')
          .update({
            'status': 'cancelled',
            'cancellation_reason': reason,
          })
          .eq('id', orderId);
    } catch (e) {
      throw ApiException(
        message: 'Failed to cancel order: $e',
        code: 'ORDER_CANCEL_ERROR',
      );
    }
  }
}
```

---

### 1.6 State Management (Riverpod Example)

```dart
// lib/features/vendors/providers/vendor_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

final vendorServiceProvider = Provider((ref) => VendorService());

final vendorsProvider = FutureProvider<List<Vendor>>((ref) async {
  final vendorService = ref.watch(vendorServiceProvider);
  return await vendorService.getVendors();
});

final vendorDetailProvider = FutureProvider.family<Vendor, String>(
  (ref, vendorId) async {
    final vendorService = ref.watch(vendorServiceProvider);
    return await vendorService.getVendorById(vendorId);
  },
);

final vendorMenuProvider = FutureProvider.family<List<MenuItem>, String>(
  (ref, vendorId) async {
    final vendorService = ref.watch(vendorServiceProvider);
    return await vendorService.getVendorMenu(vendorId);
  },
);

// Search provider with debouncing
final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<Vendor>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.isEmpty) return [];
  
  // Debounce
  await Future.delayed(const Duration(milliseconds: 500));
  
  final vendorService = ref.watch(vendorServiceProvider);
  return await vendorService.searchVendors(query);
});
```

---

### 1.7 Error Handling Strategy

```dart
// lib/core/widgets/error_handler.dart
import 'package:flutter/material.dart';

class ErrorHandler {
  static void showError(BuildContext context, dynamic error) {
    String message = 'An error occurred';
    
    if (error is ApiException) {
      message = error.message;
    } else if (error is AuthException) {
      message = error.message;
    } else if (error is PostgrestException) {
      message = error.message;
    }
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        action: SnackBarAction(
          label: 'Dismiss',
          textColor: Colors.white,
          onPressed: () {},
        ),
      ),
    );
  }
  
  static Widget buildErrorWidget(dynamic error, VoidCallback onRetry) {
    String message = 'Something went wrong';
    
    if (error is ApiException) {
      message = error.message;
    }
    
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.red),
          const SizedBox(height: 16),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
```

---

### 1.8 UI Example - Vendors List

```dart
// lib/features/vendors/screens/vendors_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class VendorsScreen extends ConsumerWidget {
  const VendorsScreen({super.key});
  
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vendorsAsync = ref.watch(vendorsProvider);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Restaurants'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // Navigate to search screen
            },
          ),
        ],
      ),
      body: vendorsAsync.when(
        data: (vendors) {
          if (vendors.isEmpty) {
            return const Center(
              child: Text('No restaurants available'),
            );
          }
          
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(vendorsProvider);
            },
            child: ListView.builder(
              itemCount: vendors.length,
              itemBuilder: (context, index) {
                final vendor = vendors[index];
                return VendorCard(vendor: vendor);
              },
            ),
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(),
        ),
        error: (error, stack) => ErrorHandler.buildErrorWidget(
          error,
          () => ref.invalidate(vendorsProvider),
        ),
      ),
    );
  }
}
```

---

## 2. Flutter Delivery App Implementation

### 2.1 Delivery Rider Authentication

```dart
// lib/features/auth/services/rider_auth_service.dart
class RiderAuthService extends AuthService {
  /// Sign Up as Rider
  Future<AuthResponse> signUpRider({
    required String email,
    required String password,
    required String fullName,
    required String phone,
    required String vehicleType,
    required String vehicleNumber,
  }) async {
    try {
      final response = await _supabase.auth.signUp(
        email: email,
        password: password,
        data: {
          'role': 'rider',
          'full_name': fullName,
          'phone': phone,
          'vehicle_type': vehicleType,
          'vehicle_number': vehicleNumber,
        },
      );
      
      if (response.user != null) {
        await _saveTokens(response.session!);
        await _createRiderProfile(response.user!.id);
      }
      
      return response;
    } catch (e) {
      throw Exception('Rider sign up failed: $e');
    }
  }
  
  /// Create Rider Profile
  Future<void> _createRiderProfile(String userId) async {
    await _supabase.from('delivery_riders').insert({
      'user_id': userId,
      'is_available': false,
      'is_verified': false,
    });
  }
}
```

---

### 2.2 Delivery Service

```dart
// lib/features/delivery/services/delivery_service.dart
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class DeliveryService {
  final SupabaseClient _supabase = Supabase.instance.client;
  
  /// Get Assigned Deliveries
  Future<List<Order>> getAssignedDeliveries() async {
    try {
      final riderId = _supabase.auth.currentUser!.id;
      
      final response = await _supabase
          .from('orders')
          .select('''
            *,
            vendors(name, phone, address, latitude, longitude),
            users(full_name, phone)
          ''')
          .eq('rider_id', riderId)
          .in_('status', ['picked_up', 'in_transit'])
          .order('created_at');
      
      return (response as List)
          .map((json) => Order.fromJson(json))
          .toList();
    } catch (e) {
      throw ApiException(
        message: 'Failed to load deliveries: $e',
        code: 'DELIVERY_FETCH_ERROR',
      );
    }
  }
  
  /// Accept Delivery
  Future<void> acceptDelivery(String orderId) async {
    try {
      final riderId = _supabase.auth.currentUser!.id;
      
      await _supabase
          .from('orders')
          .update({
            'rider_id': riderId,
            'status': 'picked_up',
          })
          .eq('id', orderId);
    } catch (e) {
      throw ApiException(
        message: 'Failed to accept delivery: $e',
        code: 'DELIVERY_ACCEPT_ERROR',
      );
    }
  }
  
  /// Update Delivery Status
  Future<void> updateDeliveryStatus(
    String orderId,
    String status,
  ) async {
    try {
      await _supabase
          .from('orders')
          .update({'status': status})
          .eq('id', orderId);
    } catch (e) {
      throw ApiException(
        message: 'Failed to update status: $e',
        code: 'STATUS_UPDATE_ERROR',
      );
    }
  }
  
  /// Update Rider Location
  Future<void> updateLocation(Position position) async {
    try {
      final riderId = _supabase.auth.currentUser!.id;
      
      await _supabase
          .from('delivery_riders')
          .update({
            'current_latitude': position.latitude,
            'current_longitude': position.longitude,
            'last_location_update': DateTime.now().toIso8601String(),
          })
          .eq('user_id', riderId);
    } catch (e) {
      // Silent fail - location updates shouldn't block UI
      print('Location update failed: $e');
    }
  }
  
  /// Start Location Tracking
  Stream<Position> startLocationTracking() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Update every 10 meters
      ),
    );
  }
  
  /// Complete Delivery
  Future<void> completeDelivery(
    String orderId,
    String? proofUrl,
  ) async {
    try {
      await _supabase
          .from('orders')
          .update({
            'status': 'delivered',
            'actual_delivery_time': DateTime.now().toIso8601String(),
            'delivery_proof_url': proofUrl,
          })
          .eq('id', orderId);
    } catch (e) {
      throw ApiException(
        message: 'Failed to complete delivery: $e',
        code: 'DELIVERY_COMPLETE_ERROR',
      );
    }
  }
}
```

---

### 2.3 Location Tracking Provider

```dart
// lib/features/delivery/providers/location_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

final deliveryServiceProvider = Provider((ref) => DeliveryService());

final locationStreamProvider = StreamProvider<Position>((ref) {
  final deliveryService = ref.watch(deliveryServiceProvider);
  return deliveryService.startLocationTracking();
});

final currentLocationProvider = StateProvider<Position?>((ref) {
  ref.listen(locationStreamProvider, (previous, next) {
    next.whenData((position) async {
      // Update rider location in database
      final deliveryService = ref.read(deliveryServiceProvider);
      await deliveryService.updateLocation(position);
    });
  });
  
  return null;
});
```

---

## 3. Security Best Practices

### 3.1 Row Level Security (RLS) Policies

#### Current Issues & Recommendations

**Problem**: Infinite recursion in RLS policies when checking user roles.

**Solution**: Use simpler policies without self-referencing queries.

```sql
-- ✅ GOOD: Simple policy
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- ❌ BAD: Causes infinite recursion
CREATE POLICY "admins_select_all" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

**Recommended RLS Policies**:

```sql
-- Users table
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Vendors table
CREATE POLICY "vendors_select_public" ON vendors
  FOR SELECT USING (is_active = true OR owner_id = auth.uid());

CREATE POLICY "vendors_manage_own" ON vendors
  FOR ALL USING (owner_id = auth.uid());

-- Orders table
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM delivery_riders WHERE user_id = auth.uid() AND id = rider_id)
  );

CREATE POLICY "customers_create_orders" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "vendors_update_orders" ON orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );
```

---

### 3.2 API Security Best Practices

#### 1. Token Management

```dart
// ✅ DO: Store tokens securely
final secureStorage = FlutterSecureStorage();
await secureStorage.write(key: 'access_token', value: token);

// ❌ DON'T: Store in SharedPreferences (not encrypted)
final prefs = await SharedPreferences.getInstance();
prefs.setString('access_token', token); // INSECURE!
```

#### 2. Automatic Token Refresh

```dart
class TokenRefreshInterceptor extends Interceptor {
  final SupabaseClient _supabase;
  
  TokenRefreshInterceptor(this._supabase);
  
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      try {
        // Refresh token
        final response = await _supabase.auth.refreshSession();
        
        if (response.session != null) {
          // Retry original request with new token
          final options = err.requestOptions;
          options.headers['Authorization'] = 
            'Bearer ${response.session!.accessToken}';
          
          final retryResponse = await Dio().fetch(options);
          return handler.resolve(retryResponse);
        }
      } catch (e) {
        // Refresh failed - logout user
        await _supabase.auth.signOut();
      }
    }
    
    handler.next(err);
  }
}
```

#### 3. Input Validation

```dart
class OrderValidator {
  static String? validateOrderItems(List<OrderItem> items) {
    if (items.isEmpty) {
      return 'Cart is empty';
    }
    
    for (final item in items) {
      if (item.quantity <= 0) {
        return 'Invalid quantity for ${item.name}';
      }
      if (item.price <= 0) {
        return 'Invalid price for ${item.name}';
      }
    }
    
    return null; // Valid
  }
  
  static String? validateAddress(Map<String, dynamic> address) {
    if (address['street'] == null || address['street'].isEmpty) {
      return 'Street address is required';
    }
    if (address['city'] == null || address['city'].isEmpty) {
      return 'City is required';
    }
    
    return null; // Valid
  }
}
```

#### 4. SQL Injection Prevention

**Supabase automatically prevents SQL injection** through parameterized queries. Always use the query builder:

```dart
// ✅ SAFE: Using query builder
await supabase
  .from('vendors')
  .select()
  .ilike('name', '%$searchQuery%');

// ❌ UNSAFE: Raw SQL (don't do this)
await supabase.rpc('raw_query', params: {
  'query': "SELECT * FROM vendors WHERE name LIKE '%$searchQuery%'"
});
```

---

### 3.3 Rate Limiting

#### Client-Side Rate Limiting

```dart
class RateLimiter {
  final Map<String, DateTime> _lastRequestTime = {};
  final Duration minInterval;
  
  RateLimiter({this.minInterval = const Duration(seconds: 1)});
  
  bool canMakeRequest(String key) {
    final lastTime = _lastRequestTime[key];
    final now = DateTime.now();
    
    if (lastTime == null || now.difference(lastTime) >= minInterval) {
      _lastRequestTime[key] = now;
      return true;
    }
    
    return false;
  }
}

// Usage
final rateLimiter = RateLimiter(minInterval: Duration(seconds: 2));

Future<void> searchVendors(String query) async {
  if (!rateLimiter.canMakeRequest('search')) {
    return; // Skip request
  }
  
  // Make API call
  await vendorService.searchVendors(query);
}
```

#### Server-Side Rate Limiting (Supabase)

Supabase has built-in rate limiting. Configure in Supabase Dashboard:

```
Settings → API → Rate Limiting
- Anonymous requests: 100/minute
- Authenticated requests: 200/minute
```

---

### 3.4 Data Encryption

#### Encrypt Sensitive Data Before Storage

```dart
import 'package:encrypt/encrypt.dart';

class EncryptionService {
  static final _key = Key.fromLength(32);
  static final _iv = IV.fromLength(16);
  static final _encrypter = Encrypter(AES(_key));
  
  static String encrypt(String plainText) {
    return _encrypter.encrypt(plainText, iv: _iv).base64;
  }
  
  static String decrypt(String encrypted) {
    return _encrypter.decrypt64(encrypted, iv: _iv);
  }
}

// Usage
final encryptedCard = EncryptionService.encrypt(cardNumber);
await secureStorage.write(key: 'card', value: encryptedCard);
```

---

## 4. Performance Optimizations

### 4.1 Caching Strategy

#### In-Memory Cache

```dart
class CacheService {
  final Map<String, CacheEntry> _cache = {};
  final Duration defaultTTL;
  
  CacheService({this.defaultTTL = const Duration(minutes: 5)});
  
  T? get<T>(String key) {
    final entry = _cache[key];
    if (entry == null) return null;
    
    if (entry.isExpired) {
      _cache.remove(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  void set<T>(String key, T data, {Duration? ttl}) {
    _cache[key] = CacheEntry(
      data: data,
      expiresAt: DateTime.now().add(ttl ?? defaultTTL),
    );
  }
  
  void clear() => _cache.clear();
}

class CacheEntry {
  final dynamic data;
  final DateTime expiresAt;
  
  CacheEntry({required this.data, required this.expiresAt});
  
  bool get isExpired => DateTime.now().isAfter(expiresAt);
}
```

#### Cached Vendor Service

```dart
class CachedVendorService extends VendorService {
  final CacheService _cache = CacheService();
  
  @override
  Future<List<Vendor>> getVendors({int limit = 20, int offset = 0}) async {
    final cacheKey = 'vendors_$limit\_$offset';
    
    // Check cache first
    final cached = _cache.get<List<Vendor>>(cacheKey);
    if (cached != null) {
      return cached;
    }
    
    // Fetch from API
    final vendors = await super.getVendors(limit: limit, offset: offset);
    
    // Cache result
    _cache.set(cacheKey, vendors);
    
    return vendors;
  }
}
```

---

### 4.2 Image Optimization

```dart
// Use cached_network_image for automatic caching
CachedNetworkImage(
  imageUrl: vendor.imageUrl,
  placeholder: (context, url) => const CircularProgressIndicator(),
  errorWidget: (context, url, error) => const Icon(Icons.error),
  memCacheWidth: 400, // Resize for memory efficiency
  memCacheHeight: 300,
)
```

---

### 4.3 Pagination

```dart
class PaginatedVendorProvider extends StateNotifier<AsyncValue<List<Vendor>>> {
  final VendorService _vendorService;
  int _currentPage = 0;
  static const _pageSize = 20;
  bool _hasMore = true;
  
  PaginatedVendorProvider(this._vendorService) : super(const AsyncValue.loading()) {
    loadMore();
  }
  
  Future<void> loadMore() async {
    if (!_hasMore) return;
    
    try {
      final newVendors = await _vendorService.getVendors(
        limit: _pageSize,
        offset: _currentPage * _pageSize,
      );
      
      if (newVendors.length < _pageSize) {
        _hasMore = false;
      }
      
      state = state.whenData((current) => [...current, ...newVendors]);
      _currentPage++;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
  
  void refresh() {
    _currentPage = 0;
    _hasMore = true;
    state = const AsyncValue.loading();
    loadMore();
  }
}
```

---

### 4.4 Debouncing Search

```dart
import 'dart:async';

class DebouncedSearch {
  Timer? _debounce;
  final Duration delay;
  
  DebouncedSearch({this.delay = const Duration(milliseconds: 500)});
  
  void call(VoidCallback callback) {
    _debounce?.cancel();
    _debounce = Timer(delay, callback);
  }
  
  void dispose() {
    _debounce?.cancel();
  }
}

// Usage in search field
final _debouncer = DebouncedSearch();

TextField(
  onChanged: (query) {
    _debouncer(() {
      ref.read(searchQueryProvider.notifier).state = query;
    });
  },
)
```

---

### 4.5 Offline Support

```dart
class OfflineService {
  final Connectivity _connectivity = Connectivity();
  
  Stream<bool> get isOnline => _connectivity.onConnectivityChanged.map(
    (result) => result != ConnectivityResult.none,
  );
  
  Future<bool> checkConnection() async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }
}

// Usage
class OfflineAwareVendorService extends VendorService {
  final OfflineService _offlineService;
  final LocalDatabase _localDb;
  
  @override
  Future<List<Vendor>> getVendors() async {
    final isOnline = await _offlineService.checkConnection();
    
    if (isOnline) {
      // Fetch from API and cache locally
      final vendors = await super.getVendors();
      await _localDb.saveVendors(vendors);
      return vendors;
    } else {
      // Return cached data
      return await _localDb.getVendors();
    }
  }
}
```

---

## 5. Scalability Improvements

### 5.1 Database Indexing

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_vendors_active ON vendors(is_active);
CREATE INDEX idx_vendors_name ON vendors(name);
CREATE INDEX idx_menu_items_vendor ON menu_items(vendor_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_vendor ON orders(vendor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_menu_items_vendor_available 
  ON menu_items(vendor_id, is_available);
  
CREATE INDEX idx_orders_customer_status 
  ON orders(customer_id, status);
```

---

### 5.2 Query Optimization

```dart
// ❌ BAD: N+1 query problem
for (final order in orders) {
  final vendor = await getVendor(order.vendorId);
  final items = await getOrderItems(order.id);
}

// ✅ GOOD: Single query with joins
final orders = await supabase
  .from('orders')
  .select('*, vendors(*), order_items(*, menu_items(*))')
  .eq('customer_id', userId);
```

---

### 5.3 Connection Pooling

Supabase handles connection pooling automatically. Configure in Supabase Dashboard:

```
Settings → Database → Connection Pooling
- Pool Mode: Transaction
- Pool Size: 15
```

---

### 5.4 CDN for Static Assets

```dart
// Use CDN URLs for images
const String cdnBaseUrl = 'https://cdn.fooda.com';

String getCdnUrl(String path) {
  return '$cdnBaseUrl/$path';
}

// Usage
CachedNetworkImage(
  imageUrl: getCdnUrl(vendor.imageUrl),
)
```

---

### 5.5 Monitoring & Analytics

```dart
// Firebase Analytics
import 'package:firebase_analytics/firebase_analytics.dart';

class AnalyticsService {
  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  
  Future<void> logEvent(String name, Map<String, dynamic>? parameters) async {
    await _analytics.logEvent(name: name, parameters: parameters);
  }
  
  Future<void> logOrderPlaced(Order order) async {
    await _analytics.logEvent(
      name: 'order_placed',
      parameters: {
        'order_id': order.id,
        'vendor_id': order.vendorId,
        'total_amount': order.totalAmount,
        'payment_method': order.paymentMethod,
      },
    );
  }
}
```

---

## Summary

### Key Takeaways

#### User App
✅ Use Supabase Flutter SDK for seamless integration  
✅ Implement secure token storage with FlutterSecureStorage  
✅ Use Riverpod/Provider for state management  
✅ Implement caching to reduce API calls  
✅ Add offline support for better UX  
✅ Use pagination for large datasets  
✅ Implement proper error handling  

#### Delivery App
✅ Real-time location tracking with Geolocator  
✅ Background location updates  
✅ Stream-based order tracking  
✅ Optimistic UI updates  

#### Security
✅ Simple RLS policies (avoid recursion)  
✅ Secure token storage  
✅ Input validation  
✅ Rate limiting  
✅ HTTPS only  

#### Performance
✅ In-memory caching  
✅ Image optimization  
✅ Debounced search  
✅ Pagination  
✅ Database indexing  
✅ Query optimization  

---

**End of Guide**

*Last Updated: 2024-01-03*
