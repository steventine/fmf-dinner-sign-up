export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_email_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      buy_outs: {
        Row: {
          amount: number
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          dinners: number
          id: string
          parent_id: string
          requested_at: string
          season_year: number
          student_id: string
        }
        Insert: {
          amount: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          dinners?: number
          id?: string
          parent_id: string
          requested_at?: string
          season_year: number
          student_id: string
        }
        Update: {
          amount?: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          dinners?: number
          id?: string
          parent_id?: string
          requested_at?: string
          season_year?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_outs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_outs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_outs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_meeting_status"
            referencedColumns: ["student_id"]
          },
        ]
      }
      email_templates: {
        Row: {
          available_variables: string[]
          description: string
          html_body: string
          key: string
          name: string
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available_variables?: string[]
          description?: string
          html_body: string
          key: string
          name: string
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available_variables?: string[]
          description?: string
          html_body?: string
          key?: string
          name?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          season_year: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          season_year: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          season_year?: number
        }
        Relationships: []
      }
      parents: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          student_id: string
          unique_guid: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          student_id: string
          unique_guid?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          student_id?: string
          unique_guid?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_meeting_status"
            referencedColumns: ["student_id"]
          },
        ]
      }
      settings: {
        Row: {
          buyout_price: number
          default_dinners_required: number
          id: number
          updated_at: string
        }
        Insert: {
          buyout_price?: number
          default_dinners_required?: number
          id?: number
          updated_at?: string
        }
        Update: {
          buyout_price?: number
          default_dinners_required?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      sign_ups: {
        Row: {
          cancelled_at: string | null
          created_at: string
          dinner: string | null
          id: string
          meeting_id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          dinner?: string | null
          id?: string
          meeting_id: string
          parent_id: string
          student_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          dinner?: string | null
          id?: string
          meeting_id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sign_ups_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sign_ups_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "v_meeting_status"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "sign_ups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sign_ups_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sign_ups_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_meeting_status"
            referencedColumns: ["student_id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          dinners_required: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          dinners_required?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          dinners_required?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_meeting_status: {
        Row: {
          date: string | null
          dinner: string | null
          household_name: string | null
          meeting_id: string | null
          notes: string | null
          season_year: number | null
          student_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      household_progress: {
        Args: { _season: number; _student_id: string }
        Returns: {
          approved_buyouts: number
          pending_buyouts: number
          provided: number
          required: number
          signed_up: number
        }[]
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
