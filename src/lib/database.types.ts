export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_collaborator_id: string | null
          actor_label: string
          actor_type: Database['public']['Enums']['actor_type']
          actor_user_id: string | null
          collaborator_id: string | null
          details: NonNullable<Json>
          from_status: string | null
          id: number
          number: number | null
          occurred_at: string
          raffle_id: string
          request_id: string | null
          result: string
          sale_id: string | null
          to_status: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_collaborator_id?: string | null
          actor_label: string
          actor_type: Database['public']['Enums']['actor_type']
          actor_user_id?: string | null
          collaborator_id?: string | null
          details?: NonNullable<Json>
          from_status?: string | null
          id?: never
          number?: number | null
          occurred_at?: string
          raffle_id: string
          request_id?: string | null
          result?: string
          sale_id?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_collaborator_id?: string | null
          actor_label?: string
          actor_type?: Database['public']['Enums']['actor_type']
          actor_user_id?: string | null
          collaborator_id?: string | null
          details?: NonNullable<Json>
          from_status?: string | null
          id?: never
          number?: number | null
          occurred_at?: string
          raffle_id?: string
          request_id?: string | null
          result?: string
          sale_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_events_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
        ]
      }
      collaborator_sessions: {
        Row: {
          auth_user_id: string
          collaborator_id: string
          created_at: string
          id: string
          last_seen_at: string
          raffle_id: string
          revoked_at: string | null
          revoked_reason: string | null
        }
        ComputedFields: never
        Insert: {
          auth_user_id: string
          collaborator_id: string
          created_at?: string
          id?: string
          last_seen_at?: string
          raffle_id: string
          revoked_at?: string | null
          revoked_reason?: string | null
        }
        Update: {
          auth_user_id?: string
          collaborator_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          raffle_id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'collaborator_sessions_raffle_id_collaborator_id_fkey'
            columns: ['raffle_id', 'collaborator_id']
            isOneToOne: false
            referencedRelation: 'collaborators'
            referencedColumns: ['raffle_id', 'id']
          },
        ]
      }
      collaborators: {
        Row: {
          created_at: string
          display_name: string
          first_activated_at: string | null
          id: string
          is_paused: boolean
          last_activity_at: string | null
          phone_e164: string | null
          pin_enabled: boolean
          position: number
          raffle_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          display_name: string
          first_activated_at?: string | null
          id?: string
          is_paused?: boolean
          last_activity_at?: string | null
          phone_e164?: string | null
          pin_enabled?: boolean
          position: number
          raffle_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          first_activated_at?: string | null
          id?: string
          is_paused?: boolean
          last_activity_at?: string | null
          phone_e164?: string | null
          pin_enabled?: boolean
          position?: number
          raffle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'collaborators_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
        ]
      }
      daily_digests: {
        Row: {
          attempts: number
          created_at: string
          digest_date: string
          last_error: string | null
          locked_until: string | null
          next_attempt_at: string
          provider_message_id: string | null
          sent_at: string | null
          status: Database['public']['Enums']['digest_status']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          created_at?: string
          digest_date: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database['public']['Enums']['digest_status']
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          digest_date?: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database['public']['Enums']['digest_status']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'daily_digests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          digest_enabled: boolean
          digest_include_phone: boolean
          display_name: string
          id: string
          time_zone: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          digest_enabled?: boolean
          digest_include_phone?: boolean
          display_name?: string
          id: string
          time_zone?: string
        }
        Update: {
          created_at?: string
          digest_enabled?: boolean
          digest_include_phone?: boolean
          display_name?: string
          id?: string
          time_zone?: string
        }
        Relationships: []
      }
      raffle_numbers: {
        Row: {
          collaborator_id: string
          current_sale_id: string | null
          number: number
          raffle_id: string
          status: Database['public']['Enums']['number_status']
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          collaborator_id: string
          current_sale_id?: string | null
          number: number
          raffle_id: string
          status?: Database['public']['Enums']['number_status']
          updated_at?: string
          version?: number
        }
        Update: {
          collaborator_id?: string
          current_sale_id?: string | null
          number?: number
          raffle_id?: string
          status?: Database['public']['Enums']['number_status']
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'raffle_numbers_current_sale_fk'
            columns: ['current_sale_id', 'raffle_id', 'number']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id', 'raffle_id', 'number']
          },
          {
            foreignKeyName: 'raffle_numbers_raffle_id_collaborator_id_fkey'
            columns: ['raffle_id', 'collaborator_id']
            isOneToOne: false
            referencedRelation: 'collaborators'
            referencedColumns: ['raffle_id', 'id']
          },
          {
            foreignKeyName: 'raffle_numbers_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
        ]
      }
      raffles: {
        Row: {
          activated_at: string | null
          closed_at: string | null
          created_at: string
          currency: string
          description: string | null
          distribution_confirmed_at: string | null
          distribution_method: Database['public']['Enums']['distribution_method'] | null
          draw_date: string
          id: string
          name: string
          number_count: number
          owner_id: string
          payment_deadline: string
          price_minor: number
          reminder_template: string | null
          show_collaborator_names: boolean
          status: Database['public']['Enums']['raffle_status']
          time_zone: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          currency: string
          description?: string | null
          distribution_confirmed_at?: string | null
          distribution_method?: Database['public']['Enums']['distribution_method'] | null
          draw_date: string
          id?: string
          name: string
          number_count?: number
          owner_id: string
          payment_deadline: string
          price_minor: number
          reminder_template?: string | null
          show_collaborator_names?: boolean
          status?: Database['public']['Enums']['raffle_status']
          time_zone?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          distribution_confirmed_at?: string | null
          distribution_method?: Database['public']['Enums']['distribution_method'] | null
          draw_date?: string
          id?: string
          name?: string
          number_count?: number
          owner_id?: string
          payment_deadline?: string
          price_minor?: number
          reminder_template?: string | null
          show_collaborator_names?: boolean
          status?: Database['public']['Enums']['raffle_status']
          time_zone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'raffles_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          buyer_alias: string | null
          buyer_name: string
          buyer_phone_e164: string
          collaborator_id: string
          committed_at: string | null
          created_at: string
          created_by_actor: Database['public']['Enums']['actor_type']
          created_by_user_id: string | null
          currency: string
          end_reason: string | null
          ended_at: string | null
          id: string
          note: string | null
          number: number
          paid_at: string | null
          paid_late: boolean
          price_minor: number
          raffle_id: string
          reserved_at: string | null
          status: Database['public']['Enums']['sale_status']
        }
        ComputedFields: never
        Insert: {
          buyer_alias?: string | null
          buyer_name: string
          buyer_phone_e164: string
          collaborator_id: string
          committed_at?: string | null
          created_at?: string
          created_by_actor: Database['public']['Enums']['actor_type']
          created_by_user_id?: string | null
          currency: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          note?: string | null
          number: number
          paid_at?: string | null
          paid_late?: boolean
          price_minor: number
          raffle_id: string
          reserved_at?: string | null
          status: Database['public']['Enums']['sale_status']
        }
        Update: {
          buyer_alias?: string | null
          buyer_name?: string
          buyer_phone_e164?: string
          collaborator_id?: string
          committed_at?: string | null
          created_at?: string
          created_by_actor?: Database['public']['Enums']['actor_type']
          created_by_user_id?: string | null
          currency?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          note?: string | null
          number?: number
          paid_at?: string | null
          paid_late?: boolean
          price_minor?: number
          raffle_id?: string
          reserved_at?: string | null
          status?: Database['public']['Enums']['sale_status']
        }
        Relationships: [
          {
            foreignKeyName: 'sales_raffle_id_number_collaborator_id_fkey'
            columns: ['raffle_id', 'number', 'collaborator_id']
            isOneToOne: false
            referencedRelation: 'raffle_numbers'
            referencedColumns: ['raffle_id', 'number', 'collaborator_id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_access: { Args: { p_pin?: string; p_token: string }; Returns: Json }
      change_sale_status: {
        Args: {
          p_action: string
          p_expected_version: number
          p_number: number
          p_raffle_id: string
          p_reason?: string
          p_request_id: string
        }
        Returns: Json
      }
      claim_daily_digests: {
        Args: { p_limit?: number }
        Returns: {
          digest_date: string
          email: string
          user_id: string
        }[]
      }
      close_raffle: { Args: { p_raffle_id: string }; Returns: undefined }
      complete_daily_digest: {
        Args: {
          p_date: string
          p_error?: string
          p_outcome: string
          p_provider_message_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      confirm_distribution: { Args: { p_raffle_id: string }; Returns: undefined }
      create_raffle: {
        Args: {
          p_currency: string
          p_description?: string
          p_draw_date: string
          p_name: string
          p_payment_deadline: string
          p_price_minor: number
          p_reminder_template?: string
          p_show_collaborator_names?: boolean
          p_time_zone?: string
        }
        Returns: string
      }
      delete_raffle: {
        Args: { p_confirmation_name: string; p_raffle_id: string }
        Returns: undefined
      }
      digest_content_for: { Args: { p_date: string; p_user_id: string }; Returns: Json }
      get_access_credentials: { Args: { p_collaborator_id: string }; Returns: Json }
      get_collaborator_home: { Args: { p_raffle_id: string }; Returns: Json }
      get_daily_digest: { Args: { p_date: string }; Returns: Json }
      get_distribution_summary: { Args: { p_raffle_id: string }; Returns: Json }
      get_invitation_preview: { Args: { p_token: string }; Returns: Json }
      preview_distribution: {
        Args: { p_method: Database['public']['Enums']['distribution_method']; p_raffle_id: string }
        Returns: Json
      }
      regenerate_access: { Args: { p_collaborator_id: string }; Returns: undefined }
      register_sale: {
        Args: {
          p_buyer_alias?: string
          p_buyer_name: string
          p_buyer_phone_e164: string
          p_expected_version: number
          p_note?: string
          p_number: number
          p_raffle_id: string
          p_request_id: string
          p_status: Database['public']['Enums']['sale_status']
        }
        Returns: Json
      }
      set_collaborator_paused: {
        Args: { p_collaborator_id: string; p_paused: boolean }
        Returns: undefined
      }
      set_collaborators: {
        Args: { p_collaborators: Json; p_raffle_id: string }
        Returns: undefined
      }
      update_buyer: {
        Args: {
          p_buyer_alias?: string
          p_buyer_name: string
          p_buyer_phone_e164: string
          p_expected_version: number
          p_note?: string
          p_number: number
          p_raffle_id: string
          p_request_id: string
        }
        Returns: Json
      }
      update_collaborator: {
        Args: { p_collaborator_id: string; p_display_name: string; p_phone_e164: string }
        Returns: undefined
      }
      update_profile: {
        Args: {
          p_digest_enabled: boolean
          p_digest_include_phone: boolean
          p_display_name: string
          p_time_zone: string
        }
        Returns: undefined
      }
      update_raffle: { Args: { p_changes: Json; p_raffle_id: string }; Returns: undefined }
    }
    Enums: {
      actor_type: 'creator' | 'collaborator' | 'system'
      digest_status: 'pending' | 'sending' | 'sent' | 'empty' | 'failed'
      distribution_method: 'ordered' | 'random'
      number_status: 'available' | 'reserved' | 'pending_payment' | 'paid' | 'overdue'
      raffle_status: 'draft' | 'active' | 'closed'
      sale_status: 'reserved' | 'pending_payment' | 'paid' | 'overdue' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actor_type: ['creator', 'collaborator', 'system'],
      digest_status: ['pending', 'sending', 'sent', 'empty', 'failed'],
      distribution_method: ['ordered', 'random'],
      number_status: ['available', 'reserved', 'pending_payment', 'paid', 'overdue'],
      raffle_status: ['draft', 'active', 'closed'],
      sale_status: ['reserved', 'pending_payment', 'paid', 'overdue', 'cancelled'],
    },
  },
} as const
