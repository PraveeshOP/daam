export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { id: string; name: string; slug: string; image_url: string | null; created_at: string };
        Insert: { id?: string; name: string; slug: string; image_url?: string | null; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; image_url?: string | null; created_at?: string };
        Relationships: [];
      };
      stores: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; website_url: string | null; description: string | null; created_at: string };
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; website_url?: string | null; description?: string | null; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; logo_url?: string | null; website_url?: string | null; description?: string | null; created_at?: string };
        Relationships: [];
      };
      products: {
        Row: { id: string; name: string; slug: string; brand: string; category_id: string | null; description: string | null; image_url: string | null; specifications: Json; featured: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; brand: string; category_id?: string | null; description?: string | null; image_url?: string | null; specifications?: Json; featured?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; brand?: string; category_id?: string | null; description?: string | null; image_url?: string | null; specifications?: Json; featured?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] }];
      };
      offers: {
        Row: { id: string; product_id: string; store_id: string; external_id: string | null; price: number; previous_price: number | null; currency: string; availability: string; product_url: string; last_checked: string; created_at: string; updated_at: string };
        Insert: { id?: string; product_id: string; store_id: string; external_id?: string | null; price: number; previous_price?: number | null; currency?: string; availability?: string; product_url: string; last_checked?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; product_id?: string; store_id?: string; external_id?: string | null; price?: number; previous_price?: number | null; currency?: string; availability?: string; product_url?: string; last_checked?: string; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "offers_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }, { foreignKeyName: "offers_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] }];
      };
      price_history: {
        Row: { id: string; product_id: string; store_id: string | null; price: number; recorded_at: string };
        Insert: { id?: string; product_id: string; store_id?: string | null; price: number; recorded_at?: string };
        Update: { id?: string; product_id?: string; store_id?: string | null; price?: number; recorded_at?: string };
        Relationships: [{ foreignKeyName: "price_history_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }, { foreignKeyName: "price_history_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] }];
      };
      favorites: {
        Row: { id: string; user_id: string; product_id: string; created_at: string };
        Insert: { id?: string; user_id: string; product_id: string; created_at?: string };
        Update: { id?: string; user_id?: string; product_id?: string; created_at?: string };
        Relationships: [{ foreignKeyName: "favorites_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }];
      };
      price_alerts: {
        Row: { id: string; user_id: string; product_id: string; target_price: number; currency: string; is_active: boolean; triggered_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; product_id: string; target_price: number; currency?: string; is_active?: boolean; triggered_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; product_id?: string; target_price?: number; currency?: string; is_active?: boolean; triggered_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "price_alerts_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
