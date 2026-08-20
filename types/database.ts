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
        Row: { id: string; name: string; slug: string; logo_url: string | null; website_url: string | null; description: string | null; affiliate_enabled: boolean; partnership_status: string; affiliate_network: string | null; affiliate_tracking_id: string | null; tracking_params: Json; created_at: string };
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; website_url?: string | null; description?: string | null; affiliate_enabled?: boolean; partnership_status?: string; affiliate_network?: string | null; affiliate_tracking_id?: string | null; tracking_params?: Json; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; logo_url?: string | null; website_url?: string | null; description?: string | null; affiliate_enabled?: boolean; partnership_status?: string; affiliate_network?: string | null; affiliate_tracking_id?: string | null; tracking_params?: Json; created_at?: string };
        Relationships: [];
      };
      products: {
        Row: { id: string; name: string; slug: string; brand: string; category_id: string | null; description: string | null; image_url: string | null; specifications: Json; featured: boolean; status: string; merged_into: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; brand: string; category_id?: string | null; description?: string | null; image_url?: string | null; specifications?: Json; featured?: boolean; status?: string; merged_into?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; brand?: string; category_id?: string | null; description?: string | null; image_url?: string | null; specifications?: Json; featured?: boolean; status?: string; merged_into?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] }, { foreignKeyName: "products_merged_into_fkey"; columns: ["merged_into"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }];
      };
      offers: {
        Row: { id: string; product_id: string; store_id: string; external_id: string | null; price: number; previous_price: number | null; currency: string; availability: string; is_disabled: boolean; product_url: string; affiliate_url: string | null; last_checked: string; created_at: string; updated_at: string };
        Insert: { id?: string; product_id: string; store_id: string; external_id?: string | null; price: number; previous_price?: number | null; currency?: string; availability?: string; is_disabled?: boolean; product_url: string; affiliate_url?: string | null; last_checked?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; product_id?: string; store_id?: string; external_id?: string | null; price?: number; previous_price?: number | null; currency?: string; availability?: string; is_disabled?: boolean; product_url?: string; affiliate_url?: string | null; last_checked?: string; created_at?: string; updated_at?: string };
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
      analytics_events: {
        Row: { id: string; event_name: string; user_id: string | null; anonymous_id: string | null; product_id: string | null; store_id: string | null; properties: Json; created_at: string };
        Insert: { id?: string; event_name: string; user_id?: string | null; anonymous_id?: string | null; product_id?: string | null; store_id?: string | null; properties?: Json; created_at?: string };
        Update: { id?: string; event_name?: string; user_id?: string | null; anonymous_id?: string | null; product_id?: string | null; store_id?: string | null; properties?: Json; created_at?: string };
        Relationships: [
          { foreignKeyName: "analytics_events_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "analytics_events_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ];
      };
      data_quality_snapshots: {
        Row: { id: string; issue_key: string; issue_count: number; created_at: string };
        Insert: { id?: string; issue_key: string; issue_count: number; created_at?: string };
        Update: { id?: string; issue_key?: string; issue_count?: number; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      accept_product_match: { Args: { p_candidate_id: string }; Returns: void };
      reject_product_match: { Args: { p_candidate_id: string }; Returns: void };
      analytics_top_searches: { Args: { p_since: string; p_limit?: number; p_zero_results_only?: boolean }; Returns: { query: string; search_count: number }[] };
      analytics_top_products: { Args: { p_since: string; p_event_name: string; p_limit?: number }; Returns: { product_id: string; event_count: number }[] };
      analytics_top_stores: { Args: { p_since: string; p_limit?: number }; Returns: { store_id: string; click_count: number }[] };
      analytics_daily_counts: { Args: { p_since: string; p_event_name: string }; Returns: { day: string; event_count: number }[] };
      analytics_active_users: { Args: { p_since: string }; Returns: number };
      most_favorited_products: { Args: { p_limit?: number }; Returns: { product_id: string; favorite_count: number }[] };
      most_alerted_products: { Args: { p_limit?: number }; Returns: { product_id: string; alert_count: number }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
