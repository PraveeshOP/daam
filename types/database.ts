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
        Row: { id: string; name: string; slug: string; brand: string; category_id: string | null; description: string | null; image_url: string | null; specifications: Json; featured: boolean; status: string; merged_into: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; brand: string; category_id?: string | null; description?: string | null; image_url?: string | null; specifications?: Json; featured?: boolean; status?: string; merged_into?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; brand?: string; category_id?: string | null; description?: string | null; image_url?: string | null; specifications?: Json; featured?: boolean; status?: string; merged_into?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] }, { foreignKeyName: "products_merged_into_fkey"; columns: ["merged_into"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }];
      };
      offers: {
        Row: { id: string; product_id: string; store_id: string; external_id: string | null; price: number; previous_price: number | null; currency: string; availability: string; is_disabled: boolean; product_url: string; last_checked: string; created_at: string; updated_at: string };
        Insert: { id?: string; product_id: string; store_id: string; external_id?: string | null; price: number; previous_price?: number | null; currency?: string; availability?: string; is_disabled?: boolean; product_url: string; last_checked?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; product_id?: string; store_id?: string; external_id?: string | null; price?: number; previous_price?: number | null; currency?: string; availability?: string; is_disabled?: boolean; product_url?: string; last_checked?: string; created_at?: string; updated_at?: string };
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
      profiles: {
        Row: { id: string; role: string; created_at: string; updated_at: string };
        Insert: { id: string; role?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; role?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      product_match_candidates: {
        Row: { id: string; new_product_id: string; candidate_product_id: string; store_id: string | null; confidence: number; reasons: string[]; status: string; decided_by: string | null; decided_at: string | null; created_at: string };
        Insert: { id?: string; new_product_id: string; candidate_product_id: string; store_id?: string | null; confidence: number; reasons?: string[]; status?: string; decided_by?: string | null; decided_at?: string | null; created_at?: string };
        Update: { id?: string; new_product_id?: string; candidate_product_id?: string; store_id?: string | null; confidence?: number; reasons?: string[]; status?: string; decided_by?: string | null; decided_at?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "product_match_candidates_new_product_id_fkey"; columns: ["new_product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "product_match_candidates_candidate_product_id_fkey"; columns: ["candidate_product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "product_match_candidates_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ];
      };
      admin_audit_logs: {
        Row: { id: string; admin_user_id: string; action: string; entity_type: string; entity_id: string | null; metadata: Json; created_at: string };
        Insert: { id?: string; admin_user_id: string; action: string; entity_type: string; entity_id?: string | null; metadata?: Json; created_at?: string };
        Update: { id?: string; admin_user_id?: string; action?: string; entity_type?: string; entity_id?: string | null; metadata?: Json; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      accept_product_match: { Args: { p_candidate_id: string }; Returns: void };
      reject_product_match: { Args: { p_candidate_id: string }; Returns: void };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
