-- Sample data for the Fooda multivendor food ordering app

-- Insert sample users
INSERT INTO users (id, email, phone, full_name, role) VALUES
('c7d8b8f4-7d2e-4b3a-9f7a-1b8e4f7d2e4b', 'admin@fooda.com', '+1234567890', 'Admin User', 'admin'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vendor@fooda.com', '+1234567891', 'Vendor Owner', 'vendor'),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'customer@fooda.com', '+1234567892', 'Customer User', 'customer'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'delivery@fooda.com', '+1234567893', 'Delivery Person', 'delivery_person');

-- Insert sample vendors
INSERT INTO vendors (id, owner_id, name, description, address, phone, email) VALUES
('d4e5f6a7-b8c9-0123-de45-678901234567', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Pizza Palace', 'Best pizzas in town', '{"street": "123 Main St", "city": "Foodville", "state": "CA", "zip": "12345"}', '+1234567891', 'info@pizzapalace.com'),
('e5f6a7b8-c9d0-1234-ef56-789012345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Burger Barn', 'Juicy burgers and fries', '{"street": "456 Oak Ave", "city": "Foodville", "state": "CA", "zip": "12345"}', '+1234567894', 'info@burgerbarn.com');

-- Insert sample menu categories
INSERT INTO menu_categories (vendor_id, name, description) VALUES
('d4e5f6a7-b8c9-0123-de45-678901234567', 'Pizzas', 'Our delicious pizza selection'),
('d4e5f6a7-b8c9-0123-de45-678901234567', 'Sides', 'Perfect accompaniments to your pizza'),
('d4e5f6a7-b8c9-0123-de45-678901234567', 'Drinks', 'Refreshing beverages'),
('e5f6a7b8-c9d0-1234-ef56-789012345678', 'Burgers', 'Our signature burger creations'),
('e5f6a7b8-c9d0-1234-ef56-789012345678', 'Sides', 'Tasty sides to complement your meal'),
('e5f6a7b8-c9d0-1234-ef56-789012345678', 'Drinks', 'Cold drinks and shakes');

-- Insert sample menu items for Pizza Palace
INSERT INTO menu_items (vendor_id, category_id, name, description, price, is_vegetarian) VALUES
-- Pizzas
((SELECT id FROM vendors WHERE name = 'Pizza Palace'), (SELECT id FROM menu_categories WHERE name = 'Pizzas' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Pizza Palace')), 'Margherita Pizza', 'Classic pizza with tomato sauce and mozzarella', 12.99, true),
((SELECT id FROM vendors WHERE name = 'Pizza Palace'), (SELECT id FROM menu_categories WHERE name = 'Pizzas' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Pizza Palace')), 'Pepperoni Pizza', 'Pizza topped with pepperoni slices', 14.99, false),
((SELECT id FROM vendors WHERE name = 'Pizza Palace'), (SELECT id FROM menu_categories WHERE name = 'Pizzas' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Pizza Palace')), 'Vegetarian Supreme', 'Loaded with fresh vegetables', 15.99, true),
-- Sides
((SELECT id FROM vendors WHERE name = 'Pizza Palace'), (SELECT id FROM menu_categories WHERE name = 'Sides' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Pizza Palace')), 'Garlic Bread', 'Toasted bread with garlic butter', 4.99, true),
((SELECT id FROM vendors WHERE name = 'Pizza Palace'), (SELECT id FROM menu_categories WHERE name = 'Sides' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Pizza Palace')), 'Caesar Salad', 'Fresh romaine lettuce with Caesar dressing', 6.99, true),
-- Drinks
((SELECT id FROM vendors WHERE name = 'Pizza Palace'), (SELECT id FROM menu_categories WHERE name = 'Drinks' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Pizza Palace')), 'Soda', 'Choice of cola, lemon-lime, or orange', 2.99, true),
((SELECT id FROM vendors WHERE name = 'Pizza Palace'), (SELECT id FROM menu_categories WHERE name = 'Drinks' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Pizza Palace')), 'Bottled Water', 'Refreshing purified water', 1.99, true);

-- Insert sample menu items for Burger Barn
INSERT INTO menu_items (vendor_id, category_id, name, description, price, is_vegetarian) VALUES
-- Burgers
((SELECT id FROM vendors WHERE name = 'Burger Barn'), (SELECT id FROM menu_categories WHERE name = 'Burgers' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Burger Barn')), 'Classic Cheeseburger', 'Beef patty with cheese, lettuce, and tomato', 9.99, false),
((SELECT id FROM vendors WHERE name = 'Burger Barn'), (SELECT id FROM menu_categories WHERE name = 'Burgers' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Burger Barn')), 'Bacon BBQ Burger', 'Beef patty with bacon and BBQ sauce', 11.99, false),
((SELECT id FROM vendors WHERE name = 'Burger Barn'), (SELECT id FROM menu_categories WHERE name = 'Burgers' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Burger Barn')), 'Veggie Burger', 'Plant-based patty with fresh vegetables', 10.99, true),
-- Sides
((SELECT id FROM vendors WHERE name = 'Burger Barn'), (SELECT id FROM menu_categories WHERE name = 'Sides' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Burger Barn')), 'French Fries', 'Crispy golden fries', 3.99, true),
((SELECT id FROM vendors WHERE name = 'Burger Barn'), (SELECT id FROM menu_categories WHERE name = 'Sides' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Burger Barn')), 'Onion Rings', 'Crispy battered onion rings', 4.99, true),
-- Drinks
((SELECT id FROM vendors WHERE name = 'Burger Barn'), (SELECT id FROM menu_categories WHERE name = 'Drinks' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Burger Barn')), 'Milkshake', 'Choice of vanilla, chocolate, or strawberry', 4.99, true),
((SELECT id FROM vendors WHERE name = 'Burger Barn'), (SELECT id FROM menu_categories WHERE name = 'Drinks' AND vendor_id = (SELECT id FROM vendors WHERE name = 'Burger Barn')), 'Iced Tea', 'Freshly brewed iced tea', 2.99, true);

-- Insert sample customer addresses
INSERT INTO user_addresses (user_id, title, address_line1, city, state, postal_code, country, latitude, longitude, is_default) VALUES
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Home', '789 Elm Street', 'Foodville', 'CA', '12345', 'USA', 34.0522, -118.2437, true),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Work', '456 Business Blvd', 'Foodville', 'CA', '12345', 'USA', 34.0522, -118.2437, false);

-- Insert sample delivery person
INSERT INTO delivery_persons (user_id, vehicle_type, license_plate) VALUES
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'motorcycle', 'DEL123');