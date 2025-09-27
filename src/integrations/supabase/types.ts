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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      burns: {
        Row: {
          bim_amount: number
          burn_type: string
          created_at: string | null
          id: string
          jetton_burn_hash: string
          payout_processed: boolean | null
          penalty_amount: number | null
          processed_at: string | null
          ton_amount: number
          ton_payout_hash: string | null
          user_id: string
        }
        Insert: {
          bim_amount: number
          burn_type?: string
          created_at?: string | null
          id?: string
          jetton_burn_hash: string
          payout_processed?: boolean | null
          penalty_amount?: number | null
          processed_at?: string | null
          ton_amount: number
          ton_payout_hash?: string | null
          user_id: string
        }
        Update: {
          bim_amount?: number
          burn_type?: string
          created_at?: string | null
          id?: string
          jetton_burn_hash?: string
          payout_processed?: boolean | null
          penalty_amount?: number | null
          processed_at?: string | null
          ton_amount?: number
          ton_payout_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "burns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          bim_amount: number
          created_at: string | null
          deposit_comment: string
          deposit_hash: string | null
          deposit_type: string
          id: string
          jetton_mint_hash: string | null
          oba_reward: number | null
          processed_at: string | null
          source_type: string
          status: Database["public"]["Enums"]["deposit_status"] | null
          ton_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bim_amount: number
          created_at?: string | null
          deposit_comment: string
          deposit_hash?: string | null
          deposit_type?: string
          id?: string
          jetton_mint_hash?: string | null
          oba_reward?: number | null
          processed_at?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["deposit_status"] | null
          ton_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bim_amount?: number
          created_at?: string | null
          deposit_comment?: string
          deposit_hash?: string | null
          deposit_type?: string
          id?: string
          jetton_mint_hash?: string | null
          oba_reward?: number | null
          processed_at?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["deposit_status"] | null
          ton_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_sessions: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          end_time: string | null
          id: string
          oba_earned: number | null
          start_time: string
          status: Database["public"]["Enums"]["mining_status"] | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          oba_earned?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["mining_status"] | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          oba_earned?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["mining_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          first_deposit_id: string | null
          id: string
          referee_id: string
          referrer_id: string
          reward_amount: number | null
          status: Database["public"]["Enums"]["referral_status"] | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          first_deposit_id?: string | null
          id?: string
          referee_id: string
          referrer_id: string
          reward_amount?: number | null
          status?: Database["public"]["Enums"]["referral_status"] | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          first_deposit_id?: string | null
          id?: string
          referee_id?: string
          referrer_id?: string
          reward_amount?: number | null
          status?: Database["public"]["Enums"]["referral_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_first_deposit_id_fkey"
            columns: ["first_deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_verification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          success: boolean
          task_id: string
          user_id: string
          verification_attempt: Json
          verification_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          success?: boolean
          task_id: string
          user_id: string
          verification_attempt?: Json
          verification_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          success?: boolean
          task_id?: string
          user_id?: string
          verification_attempt?: Json
          verification_type?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completion_timeout: number | null
          created_at: string | null
          daily_limit: number | null
          description: string
          external_url: string | null
          id: string
          is_active: boolean | null
          reward_amount: number
          task_type: string
          title: string
          updated_at: string | null
          verification_data: Json | null
          verification_type: string | null
        }
        Insert: {
          completion_timeout?: number | null
          created_at?: string | null
          daily_limit?: number | null
          description: string
          external_url?: string | null
          id?: string
          is_active?: boolean | null
          reward_amount: number
          task_type: string
          title: string
          updated_at?: string | null
          verification_data?: Json | null
          verification_type?: string | null
        }
        Update: {
          completion_timeout?: number | null
          created_at?: string | null
          daily_limit?: number | null
          description?: string
          external_url?: string | null
          id?: string
          is_active?: boolean | null
          reward_amount?: number
          task_type?: string
          title?: string
          updated_at?: string | null
          verification_data?: Json | null
          verification_type?: string | null
        }
        Relationships: []
      }
      user_tasks: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          reward_earned: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          user_id: string
          verification_data: Json | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          reward_earned?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_id: string
          user_id: string
          verification_data?: Json | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          reward_earned?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string
          user_id?: string
          verification_data?: Json | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          bim_balance: number
          created_at: string | null
          deposit_bim_balance: number
          earned_bim_balance: number
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          oba_balance: number
          referral_code: string | null
          referred_by: string | null
          total_deposited: number
          total_earned_from_referrals: number
          total_earned_from_tasks: number
          total_mined: number
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          bim_balance?: number
          created_at?: string | null
          deposit_bim_balance?: number
          earned_bim_balance?: number
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          oba_balance?: number
          referral_code?: string | null
          referred_by?: string | null
          total_deposited?: number
          total_earned_from_referrals?: number
          total_earned_from_tasks?: number
          total_mined?: number
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          bim_balance?: number
          created_at?: string | null
          deposit_bim_balance?: number
          earned_bim_balance?: number
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          oba_balance?: number
          referral_code?: string | null
          referred_by?: string | null
          total_deposited?: number
          total_earned_from_referrals?: number
          total_earned_from_tasks?: number
          total_mined?: number
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_deposit_bim: {
        Args: { user_uuid: string }
        Returns: number
      }
      get_public_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          bim_balance: number
          total_deposited: number
          wallet_address: string
        }[]
      }
      get_user_by_wallet: {
        Args: { wallet_addr: string }
        Returns: {
          bim_balance: number
          created_at: string
          deposit_bim_balance: number
          earned_bim_balance: number
          id: string
          is_active: boolean
          last_activity_at: string
          oba_balance: number
          referral_code: string
          referred_by: string
          total_deposited: number
          total_earned_from_referrals: number
          total_earned_from_tasks: number
          total_mined: number
          updated_at: string
          wallet_address: string
        }[]
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      deposit_status: "pending" | "confirmed" | "failed"
      mining_status: "active" | "completed" | "claimed"
      referral_status: "pending" | "completed"
      task_status: "available" | "completed" | "claimed"
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
      deposit_status: ["pending", "confirmed", "failed"],
      mining_status: ["active", "completed", "claimed"],
      referral_status: ["pending", "completed"],
      task_status: ["available", "completed", "claimed"],
    },
  },
} as const
