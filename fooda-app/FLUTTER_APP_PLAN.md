# Flutter Mobile Apps Implementation Plan

This document outlines the implementation plan for the Flutter mobile apps for the Fooda application, incorporating Google Maps integration and payment processing capabilities.

## App Structure

### 1. User Mobile App

#### Core Features
1. **User Authentication**
   - Email/password signup and login
   - Social login (Google, Facebook)
   - Password recovery

2. **Restaurant Discovery**
   - List view of nearby restaurants
   - Map view with restaurant locations
   - Search and filtering capabilities
   - Restaurant details and menus

3. **Order Placement**
   - Menu browsing and item selection
   - Shopping cart management
   - Special instructions and preferences
   - Delivery location selection

4. **Order Management**
   - Order history and tracking
   - Real-time order status updates
   - Reordering capability

5. **Payment Processing**
   - Credit/debit card payments
   - Digital wallet integration (Apple Pay, Google Pay)
   - Payment history and receipts

6. **User Profile**
   - Personal information management
   - Saved addresses and payment methods
   - Favorite restaurants and foods
   - Review and rating system

#### Folder Structure
```
lib/
├── main.dart
├── app/
│   ├── app.dart
│   └── routes.dart
├── core/
│   ├── constants/
│   ├── utils/
│   └── theme/
├── features/
│   ├── auth/
│   ├── home/
│   ├── restaurant/
│   ├── menu/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── profile/
│   └── map/
├── services/
│   ├── api_service.dart
│   ├── auth_service.dart
│   ├── location_service.dart
│   └── payment_service.dart
└── widgets/
    ├── custom_app_bar.dart
    ├── restaurant_card.dart
    └── custom_button.dart
```

### 2. Delivery Person App

#### Core Features
1. **Delivery Person Authentication**
   - Account registration and approval
   - Profile setup with vehicle information

2. **Order Management**
   - List of available orders
   - Order details and pickup/drop-off locations
   - Accept/decline orders

3. **Navigation and Tracking**
   - Turn-by-turn navigation
   - Real-time location sharing
   - Route optimization

4. **Order Status Updates**
   - Mark orders as picked up
   - Mark orders as delivered
   - Issue reporting

5. **Earnings and Analytics**
   - Daily/weekly earnings tracking
   - Delivery statistics
   - Payment history

#### Folder Structure
```
lib/
├── main.dart
├── app/
│   ├── app.dart
│   └── routes.dart
├── core/
│   ├── constants/
│   ├── utils/
│   └── theme/
├── features/
│   ├── auth/
│   ├── orders/
│   ├── navigation/
│   ├── earnings/
│   └── profile/
├── services/
│   ├── api_service.dart
│   ├── auth_service.dart
│   ├── location_service.dart
│   └── navigation_service.dart
└── widgets/
    ├── custom_app_bar.dart
    ├── order_card.dart
    └── custom_button.dart
```

## Google Maps Integration

### User App Implementation

#### 1. Restaurant Discovery Map
```dart
import 'package:google_maps_flutter/google_maps_flutter.dart';

class RestaurantDiscoveryMap extends StatefulWidget {
  @override
  _RestaurantDiscoveryMapState createState() => _RestaurantDiscoveryMapState();
}

class _RestaurantDiscoveryMapState extends State<RestaurantDiscoveryMap> {
  late GoogleMapController mapController;
  Set<Marker> _markers = {};

  @override
  Widget build(BuildContext context) {
    return GoogleMap(
      onMapCreated: _onMapCreated,
      initialCameraPosition: CameraPosition(
        target: LatLng(37.7749, -122.4194), // Default location
        zoom: 12.0,
      ),
      markers: _markers,
      onCameraMove: _onCameraMove,
    );
  }

  void _onMapCreated(GoogleMapController controller) {
    mapController = controller;
    _loadRestaurants();
  }

  void _loadRestaurants() async {
    // Load restaurants near current map view
    // Add markers for each restaurant
  }

  void _onCameraMove(CameraPosition position) {
    // Debounced loading of restaurants as map moves
  }
}
```

#### 2. Delivery Location Selection
```dart
class LocationSelectionScreen extends StatefulWidget {
  @override
  _LocationSelectionScreenState createState() => _LocationSelectionScreenState();
}

class _LocationSelectionScreenState extends State<LocationSelectionScreen> {
  late GoogleMapController mapController;
  LatLng? _selectedLocation;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Select Delivery Location')),
      body: GoogleMap(
        onMapCreated: (controller) => mapController = controller,
        initialCameraPosition: CameraPosition(
          target: LatLng(37.7749, -122.4194),
          zoom: 15.0,
        ),
        onTap: _onMapTap,
        markers: _selectedLocation != null
            ? {
                Marker(
                  markerId: MarkerId('selected_location'),
                  position: _selectedLocation!,
                )
              }
            : {},
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _confirmLocation,
        child: Icon(Icons.check),
      ),
    );
  }

  void _onMapTap(LatLng position) {
    setState(() {
      _selectedLocation = position;
    });
  }

  void _confirmLocation() async {
    if (_selectedLocation != null) {
      // Reverse geocode to get address
      // Save location to user profile
      Navigator.pop(context, _selectedLocation);
    }
  }
}
```

#### 3. Order Tracking
```dart
class OrderTrackingScreen extends StatefulWidget {
  final String orderId;

  OrderTrackingScreen({required this.orderId});

  @override
  _OrderTrackingScreenState createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  late GoogleMapController mapController;
  LatLng? _deliveryPersonLocation;
  LatLng? _restaurantLocation;
  LatLng? _customerLocation;

  @override
  void initState() {
    super.initState();
    _startTracking();
  }

  void _startTracking() {
    // Subscribe to real-time location updates
    // Update _deliveryPersonLocation periodically
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Order Tracking')),
      body: GoogleMap(
        onMapCreated: (controller) => mapController = controller,
        initialCameraPosition: CameraPosition(
          target: _restaurantLocation ?? LatLng(37.7749, -122.4194),
          zoom: 13.0,
        ),
        markers: {
          if (_restaurantLocation != null)
            Marker(
              markerId: MarkerId('restaurant'),
              position: _restaurantLocation!,
              icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
            ),
          if (_customerLocation != null)
            Marker(
              markerId: MarkerId('customer'),
              position: _customerLocation!,
              icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
            ),
          if (_deliveryPersonLocation != null)
            Marker(
              markerId: MarkerId('delivery_person'),
              position: _deliveryPersonLocation!,
              icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
            ),
        },
        polylines: {
          // Add route polyline from restaurant to customer
        },
      ),
    );
  }
}
```

### Delivery App Implementation

#### 1. Navigation Screen
```dart
class NavigationScreen extends StatefulWidget {
  final LatLng destination;
  final String destinationName;

  NavigationScreen({required this.destination, required this.destinationName});

  @override
  _NavigationScreenState createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  late GoogleMapController mapController;
  List<LatLng> _routePoints = [];

  @override
  void initState() {
    super.initState();
    _calculateRoute();
  }

  void _calculateRoute() async {
    // Get current location
    Position currentPosition = await Geolocator.getCurrentPosition();
    LatLng origin = LatLng(currentPosition.latitude, currentPosition.longitude);

    // Calculate route using Directions API
    // Update _routePoints with route coordinates
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.destinationName)),
      body: GoogleMap(
        onMapCreated: (controller) => mapController = controller,
        initialCameraPosition: CameraPosition(
          target: widget.destination,
          zoom: 14.0,
        ),
        polylines: {
          Polyline(
            polylineId: PolylineId('route'),
            points: _routePoints,
            color: Colors.blue,
            width: 5,
          ),
        },
        markers: {
          Marker(
            markerId: MarkerId('destination'),
            position: widget.destination,
          ),
        },
      ),
    );
  }
}
```

## Payment Processing Integration

### User App Implementation

#### 1. Payment Screen
```dart
import 'package:flutter_stripe/flutter_stripe.dart';

class PaymentScreen extends StatefulWidget {
  final double amount;
  final String orderId;

  PaymentScreen({required this.amount, required this.orderId});

  @override
  _PaymentScreenState createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  late Stripe _stripe;
  CardFieldInputDetails? _cardInputDetails;

  @override
  void initState() {
    super.initState();
    _stripe = Stripe.instance;
  }

  Future<void> _processPayment() async {
    try {
      // Create payment intent on backend
      final response = await ApiService.createPaymentIntent(
        widget.amount,
        widget.orderId,
      );

      // Confirm payment
      final paymentIntentResult = await _stripe.confirmPayment(
        response['client_secret'],
        params: PaymentMethodParams.card(
          paymentMethodData: PaymentMethodData(
            billingDetails: BillingDetails(
              name: 'Customer Name',
            ),
          ),
        ),
      );

      if (paymentIntentResult.status == PaymentIntentsStatus.succeeded) {
        // Payment successful
        Navigator.pushReplacementNamed(context, '/order_confirmation');
      }
    } catch (e) {
      // Handle error
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment failed: ${e.toString()}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Payment')),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          children: [
            Text('Amount: \$${widget.amount.toStringAsFixed(2)}'),
            SizedBox(height: 20),
            CardField(
              onCardChanged: (card) {
                setState(() {
                  _cardInputDetails = card;
                });
              },
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: _cardInputDetails?.complete == true
                  ? _processPayment
                  : null,
              child: Text('Pay Now'),
            ),
          ],
        ),
      ),
    );
  }
}
```

#### 2. Digital Wallet Integration
```dart
class DigitalWalletPayment extends StatelessWidget {
  final double amount;
  final String orderId;

  DigitalWalletPayment({required this.amount, required this.orderId});

  Future<void> _payWithApplePay() async {
    try {
      final result = await _stripe.payWithApplePay(
        params: ApplePayPaymentParams(
          countryCode: 'US',
          currencyCode: 'USD',
          items: [
            ApplePayItem(
              label: 'Fooda Order',
              amount: amount.toString(),
            ),
          ],
        ),
      );

      if (result.complete) {
        // Process payment on backend
        await ApiService.confirmApplePayPayment(
          result.paymentMethodId,
          amount,
          orderId,
        );
        
        // Complete Apple Pay
        await _stripe.completeApplePay(result, isServerComplete: true);
      }
    } catch (e) {
      // Handle error
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (Platform.isIOS)
          ApplePayButton(
            onPressed: _payWithApplePay,
            style: ApplePayButtonStyle.black,
            type: ApplePayButtonType.buy,
          ),
        if (Platform.isAndroid)
          GooglePayButton(
            onPressed: _payWithGooglePay,
            style: GooglePayButtonStyle.black,
          ),
      ],
    );
  }
}
```

## Real-time Features

### Order Status Updates
```dart
class OrderStatusListener {
  StreamSubscription? _subscription;

  void listenToOrderUpdates(String orderId, Function(Order) onUpdate) {
    _subscription = supabase
        .from('orders:id=eq.$orderId')
        .on(SupabaseEventTypes.update, (payload) {
          final order = Order.fromJson(payload.newRecord);
          onUpdate(order);
        })
        .subscribe();
  }

  void dispose() {
    _subscription?.cancel();
  }
}
```

### Location Tracking
```dart
class LocationTracker {
  StreamSubscription<Position>? _positionStream;

  void startTracking(Function(Position) onLocationUpdate) {
    _positionStream = Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Update every 10 meters
      ),
    ).listen((Position position) {
      onLocationUpdate(position);
      // Update location in backend
      ApiService.updateDeliveryPersonLocation(position);
    });
  }

  void stopTracking() {
    _positionStream?.cancel();
  }
}
```

## State Management

Using Provider for state management:

```dart
class AppState extends ChangeNotifier {
  User? _currentUser;
  List<Restaurant> _nearbyRestaurants = [];
  Cart _cart = Cart();

  User? get currentUser => _currentUser;
  List<Restaurant> get nearbyRestaurants => _nearbyRestaurants;
  Cart get cart => _cart;

  void setCurrentUser(User user) {
    _currentUser = user;
    notifyListeners();
  }

  void setNearbyRestaurants(List<Restaurant> restaurants) {
    _nearbyRestaurants = restaurants;
    notifyListeners();
  }

  void addToCart(MenuItem item, int quantity) {
    _cart.addItem(item, quantity);
    notifyListeners();
  }

  void removeFromCart(MenuItem item) {
    _cart.removeItem(item);
    notifyListeners();
  }
}
```

## Dependencies

### pubspec.yaml
```yaml
dependencies:
  flutter:
    sdk: flutter
  # State management
  provider: ^6.0.0
  
  # Networking
  http: ^0.13.0
  dio: ^4.0.0
  
  # Authentication
  firebase_auth: ^4.0.0
  google_sign_in: ^5.0.0
  
  # Maps and location
  google_maps_flutter: ^2.2.0
  geolocator: ^9.0.0
  geocoding: ^2.0.0
  
  # Payments
  flutter_stripe: ^9.0.0
  pay: ^1.0.0
  
  # UI components
  flutter_svg: ^1.0.0
  cached_network_image: ^3.0.0
  
  # Utilities
  intl: ^0.17.0
  shared_preferences: ^2.0.0
  
  # Supabase
  supabase_flutter: ^1.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0
```

## Testing Strategy

### Unit Tests
```dart
void main() {
  group('Cart', () {
    test('should add items correctly', () {
      final cart = Cart();
      final item = MenuItem(id: '1', name: 'Pizza', price: 10.0);
      
      cart.addItem(item, 2);
      
      expect(cart.items.length, 1);
      expect(cart.total, 20.0);
    });
  });
}
```

### Widget Tests
```dart
void main() {
  testWidgets('RestaurantCard displays restaurant name', (WidgetTester tester) async {
    final restaurant = Restaurant(id: '1', name: 'Pizza Palace');
    
    await tester.pumpWidget(
      MaterialApp(
        home: RestaurantCard(restaurant: restaurant),
      ),
    );
    
    expect(find.text('Pizza Palace'), findsOneWidget);
  });
}
```

## Deployment

### Building for Release
```bash
# Android
flutter build appbundle

# iOS
flutter build ios --release
```

### Environment Configuration
```dart
class AppConfig {
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const String googleMapsApiKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY');
  static const String stripePublishableKey = String.fromEnvironment('STRIPE_PUBLISHABLE_KEY');
}
```

## Performance Optimization

1. **Image Caching**: Use `cached_network_image` for restaurant and food images
2. **Lazy Loading**: Load data as needed rather than all at once
3. **Pagination**: Implement pagination for restaurant lists
4. **Background Sync**: Sync data in the background when possible
5. **Code Splitting**: Split code into separate bundles for different features

## Accessibility

1. **Screen Reader Support**: Proper semantic labels for all UI elements
2. **Color Contrast**: Ensure sufficient contrast for text and UI elements
3. **Keyboard Navigation**: Support for keyboard navigation on web
4. **Dynamic Text Sizes**: Support for larger text sizes
5. **VoiceOver/TalkBack**: Test with screen readers

## Internationalization

```dart
class AppLocalizations {
  final Locale locale;
  
  AppLocalizations(this.locale);
  
  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }
  
  static const LocalizationsDelegate<AppLocalizations> delegate = 
      _AppLocalizationsDelegate();
      
  String get hello {
    return Intl.message(
      'Hello',
      name: 'hello',
      desc: 'Greeting text',
      locale: locale.toString(),
    );
  }
}
```

This comprehensive plan covers the implementation of both Flutter mobile apps with Google Maps integration and payment processing capabilities. The apps will provide a seamless user experience for ordering food and a robust platform for delivery persons to manage their deliveries.