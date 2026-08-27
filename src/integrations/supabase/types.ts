export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_email_allowlist: {
        Row: {
          created_at: string;
          email: string;
        };
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      banquet_item_categories: {
        Row: {
          banquet_id: string;
          capacity: number;
          description: string;
          id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          banquet_id: string;
          capacity: number;
          description?: string;
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          banquet_id?: string;
          capacity?: number;
          description?: string;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "banquet_item_categories_banquet_id_fkey";
            columns: ["banquet_id"];
            isOneToOne: false;
            referencedRelation: "banquets";
            referencedColumns: ["id"];
          },
        ];
      };
      banquet_item_signups: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          item_description: string | null;
          rsvp_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          item_description?: string | null;
          rsvp_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          item_description?: string | null;
          rsvp_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "banquet_item_signups_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "banquet_item_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "banquet_item_signups_rsvp_id_fkey";
            columns: ["rsvp_id"];
            isOneToOne: false;
            referencedRelation: "banquet_rsvps";
            referencedColumns: ["id"];
          },
        ];
      };
      banquet_rsvps: {
        Row: {
          attending: boolean;
          banquet_id: string;
          created_at: string;
          guest_count: number;
          id: string;
          parent_id: string;
          reminded_at: string | null;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          attending: boolean;
          banquet_id: string;
          created_at?: string;
          guest_count?: number;
          id?: string;
          parent_id: string;
          reminded_at?: string | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          attending?: boolean;
          banquet_id?: string;
          created_at?: string;
          guest_count?: number;
          id?: string;
          parent_id?: string;
          reminded_at?: string | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "banquet_rsvps_banquet_id_fkey";
            columns: ["banquet_id"];
            isOneToOne: false;
            referencedRelation: "banquets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "banquet_rsvps_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "banquet_rsvps_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "banquet_rsvps_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_meeting_status";
            referencedColumns: ["student_id"];
          },
        ];
      };
      banquets: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          location: string | null;
          notes: string | null;
          season_year: number;
          time: string | null;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          season_year: number;
          time?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          season_year?: number;
          time?: string | null;
        };
        Relationships: [];
      };
      buy_outs: {
        Row: {
          amount: number;
          approved: boolean;
          approved_at: string | null;
          approved_by: string | null;
          dinners: number;
          id: string;
          parent_id: string;
          requested_at: string;
          season_year: number;
          student_id: string;
        };
        Insert: {
          amount: number;
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          dinners?: number;
          id?: string;
          parent_id: string;
          requested_at?: string;
          season_year: number;
          student_id: string;
        };
        Update: {
          amount?: number;
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          dinners?: number;
          id?: string;
          parent_id?: string;
          requested_at?: string;
          season_year?: number;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buy_outs_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buy_outs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buy_outs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_meeting_status";
            referencedColumns: ["student_id"];
          },
        ];
      };
      dinner_note_votes: {
        Row: {
          created_at: string;
          note_id: string;
          parent_id: string;
        };
        Insert: {
          created_at?: string;
          note_id: string;
          parent_id: string;
        };
        Update: {
          created_at?: string;
          note_id?: string;
          parent_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dinner_note_votes_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "dinner_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dinner_note_votes_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
        ];
      };
      dinner_notes: {
        Row: {
          body: string;
          created_at: string;
          hidden_at: string | null;
          hidden_by: string | null;
          id: string;
          parent_id: string | null;
          served_count: number | null;
          source_id: string;
          total_cost: number | null;
        };
        Insert: {
          body: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          id?: string;
          parent_id?: string | null;
          served_count?: number | null;
          source_id: string;
          total_cost?: number | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          id?: string;
          parent_id?: string | null;
          served_count?: number | null;
          source_id?: string;
          total_cost?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "dinner_notes_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dinner_notes_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "dinner_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      dinner_sources: {
        Row: {
          created_at: string;
          created_by_parent_id: string | null;
          delivers: boolean | null;
          id: string;
          kind: string;
          name: string;
          order_lead_time: string | null;
          phone: string | null;
          website: string | null;
        };
        Insert: {
          created_at?: string;
          created_by_parent_id?: string | null;
          delivers?: boolean | null;
          id?: string;
          kind: string;
          name: string;
          order_lead_time?: string | null;
          phone?: string | null;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          created_by_parent_id?: string | null;
          delivers?: boolean | null;
          id?: string;
          kind?: string;
          name?: string;
          order_lead_time?: string | null;
          phone?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dinner_sources_created_by_parent_id_fkey";
            columns: ["created_by_parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
        ];
      };
      email_send_log: {
        Row: {
          id: string;
          template_key: string;
          parent_id: string;
          sent_at: string;
          triggered_by: string;
          status: string;
          error_message: string | null;
          resend_email_id: string | null;
          delivery_status: string | null;
          delivery_detail: string | null;
          delivery_updated_at: string | null;
        };
        Insert: {
          id?: string;
          template_key: string;
          parent_id: string;
          sent_at?: string;
          triggered_by: string;
          status?: string;
          error_message?: string | null;
          resend_email_id?: string | null;
          delivery_status?: string | null;
          delivery_detail?: string | null;
          delivery_updated_at?: string | null;
        };
        Update: {
          id?: string;
          template_key?: string;
          parent_id?: string;
          sent_at?: string;
          triggered_by?: string;
          status?: string;
          error_message?: string | null;
          resend_email_id?: string | null;
          delivery_status?: string | null;
          delivery_detail?: string | null;
          delivery_updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_send_log_template_key_fkey";
            columns: ["template_key"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "email_send_log_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          audience_type: string | null;
          available_variables: string[];
          description: string;
          key: string;
          markdown_body: string;
          name: string;
          reminder_days_before: number | null;
          follow_up_days_after: number | null;
          schedule_cron: string | null;
          schedule_enabled: boolean;
          schedule_last_run_at: string | null;
          schedule_next_run_at: string | null;
          subject: string;
          template_type: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          audience_type?: string | null;
          available_variables?: string[];
          description?: string;
          key: string;
          markdown_body: string;
          name: string;
          reminder_days_before?: number | null;
          follow_up_days_after?: number | null;
          schedule_cron?: string | null;
          schedule_enabled?: boolean;
          schedule_last_run_at?: string | null;
          schedule_next_run_at?: string | null;
          subject: string;
          template_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          audience_type?: string | null;
          available_variables?: string[];
          description?: string;
          key?: string;
          markdown_body?: string;
          name?: string;
          reminder_days_before?: number | null;
          follow_up_days_after?: number | null;
          schedule_cron?: string | null;
          schedule_enabled?: boolean;
          schedule_last_run_at?: string | null;
          schedule_next_run_at?: string | null;
          subject?: string;
          template_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      meetings: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          season_year: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          notes?: string | null;
          season_year: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          season_year?: number;
        };
        Relationships: [];
      };
      parents: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          student_id: string;
          unique_guid: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          student_id: string;
          unique_guid?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          student_id?: string;
          unique_guid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parents_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parents_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_meeting_status";
            referencedColumns: ["student_id"];
          },
        ];
      };
      settings: {
        Row: {
          app_url: string;
          buyout_price: number;
          dinner_guidance: string;
          dinner_guidance_short: string;
          default_dinners_required: number;
          id: number;
          season_end: string | null;
          season_start: string | null;
          updated_at: string;
        };
        Insert: {
          app_url?: string;
          buyout_price?: number;
          dinner_guidance?: string;
          dinner_guidance_short?: string;
          default_dinners_required?: number;
          id?: number;
          season_end?: string | null;
          season_start?: string | null;
          updated_at?: string;
        };
        Update: {
          app_url?: string;
          buyout_price?: number;
          dinner_guidance?: string;
          dinner_guidance_short?: string;
          default_dinners_required?: number;
          id?: number;
          season_end?: string | null;
          season_start?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sign_ups: {
        Row: {
          cancelled_at: string | null;
          created_at: string;
          dinner: string | null;
          followed_up_at: string | null;
          id: string;
          meeting_id: string;
          parent_id: string;
          reminded_at: string | null;
          student_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          created_at?: string;
          dinner?: string | null;
          followed_up_at?: string | null;
          id?: string;
          meeting_id: string;
          parent_id: string;
          reminded_at?: string | null;
          student_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          created_at?: string;
          dinner?: string | null;
          followed_up_at?: string | null;
          id?: string;
          meeting_id?: string;
          parent_id?: string;
          reminded_at?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sign_ups_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sign_ups_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "v_meeting_status";
            referencedColumns: ["meeting_id"];
          },
          {
            foreignKeyName: "sign_ups_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sign_ups_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sign_ups_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_meeting_status";
            referencedColumns: ["student_id"];
          },
        ];
      };
      students: {
        Row: {
          created_at: string;
          dinners_required: number | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          dinners_required?: number | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          dinners_required?: number | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_meeting_status: {
        Row: {
          date: string | null;
          dinner: string | null;
          household_name: string | null;
          meeting_id: string | null;
          notes: string | null;
          season_year: number | null;
          student_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_banquet_item: {
        Args: {
          _category_id: string;
          _item_description: string | null;
          _rsvp_id: string;
        };
        Returns: string;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      household_progress: {
        Args: { _season: number; _student_id: string };
        Returns: {
          approved_buyouts: number;
          pending_buyouts: number;
          provided: number;
          required: number;
          signed_up: number;
        }[];
      };
      household_progress_all: {
        Args: { _season: number };
        Returns: {
          approved_buyouts: number;
          pending_buyouts: number;
          provided: number;
          required: number;
          signed_up: number;
          student_id: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const;
