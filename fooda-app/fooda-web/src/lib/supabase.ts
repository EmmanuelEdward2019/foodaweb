import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dukvrgupgtymxxbqpctq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1a3ZyZ3VwZ3R5bXh4YnFwY3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjY1MTQsImV4cCI6MjA4MDQ0MjUxNH0._WUj92bMmPakzdA7dltor8ADGUhOlHExSKB4DRvugcg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
