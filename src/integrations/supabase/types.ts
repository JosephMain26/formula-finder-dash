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
      admin_seed: {
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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          company_name: string
          company_type: string[] | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          percentage: number | null
          updated_at: string
        }
        Insert: {
          company_name: string
          company_type?: string[] | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          percentage?: number | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          company_type?: string[] | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          percentage?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          name: string
        }
        Insert: {
          created_at?: string
          name: string
        }
        Update: {
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      door_centers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      install_colors: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      install_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      install_models: {
        Row: {
          colors: string[]
          created_at: string
          group_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          colors?: string[]
          created_at?: string
          group_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          colors?: string[]
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "install_models_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "install_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      install_sizes: {
        Row: {
          created_at: string
          height: string
          id: string
          label: string | null
          sort_order: number
          updated_at: string
          width: string
        }
        Insert: {
          created_at?: string
          height: string
          id?: string
          label?: string | null
          sort_order?: number
          updated_at?: string
          width: string
        }
        Update: {
          created_at?: string
          height?: string
          id?: string
          label?: string | null
          sort_order?: number
          updated_at?: string
          width?: string
        }
        Relationships: []
      }
      install_sub_items: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "install_sub_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "install_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      installers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          install_types: string[]
          name: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          install_types?: string[]
          name: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          install_types?: string[]
          name?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      job_installations: {
        Row: {
          color: string | null
          created_at: string
          group_id: string | null
          group_name: string | null
          id: string
          job_id: string
          model_id: string | null
          model_name: string | null
          notes: string | null
          parts_po: string | null
          size_id: string | null
          size_label: string | null
          sort_order: number
          sub_items: Json
          system_type: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          job_id: string
          model_id?: string | null
          model_name?: string | null
          notes?: string | null
          parts_po?: string | null
          size_id?: string | null
          size_label?: string | null
          sort_order?: number
          sub_items?: Json
          system_type?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          job_id?: string
          model_id?: string | null
          model_name?: string | null
          notes?: string | null
          parts_po?: string | null
          size_id?: string | null
          size_label?: string | null
          sort_order?: number
          sub_items?: Json
          system_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_installations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "install_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_installations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "install_models"
            referencedColumns: ["id"]
          },
        ]
      }
      job_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          address: string | null
          cc_fee: number | null
          check_no: string | null
          client_id: string | null
          co_parts: number | null
          comp_type: string | null
          company: string | null
          company_1: string | null
          company_id: string | null
          completed_at_date: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          deposit_check_no: string | null
          deposit_date: string | null
          deposit_payment_method: string | null
          deposit_received: boolean
          extra_fields: Json
          id: string
          installer_id: string | null
          installer_name: string | null
          job_date: string | null
          job_time: string | null
          job_time_end: string | null
          job_type: string | null
          manual_percentage: number | null
          maps: string | null
          marketer_collected: boolean
          marketer_fixed_amount: number
          marketer_pay_mode: string
          notes: string | null
          notified_at: string | null
          notified_lead_minutes: number[]
          notify_channels: string[]
          notify_enabled: boolean
          notify_lead_minutes: number
          notify_lead_minutes_list: number[]
          office_fixed_amount: number
          office_parts: number | null
          office_pay_mode: string
          paid: boolean | null
          parts: number | null
          payment: string | null
          phone_no: string | null
          pickup_door_center_id: string | null
          po_number: string | null
          price: number | null
          scheduled_completion_date: string | null
          status: string | null
          tech_fixed_amount: number
          tech_name: string | null
          tech_pay_mode: string
          tip: number | null
          total_marketer: number | null
          total_office: number | null
          total_tech: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cc_fee?: number | null
          check_no?: string | null
          client_id?: string | null
          co_parts?: number | null
          comp_type?: string | null
          company?: string | null
          company_1?: string | null
          company_id?: string | null
          completed_at_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_check_no?: string | null
          deposit_date?: string | null
          deposit_payment_method?: string | null
          deposit_received?: boolean
          extra_fields?: Json
          id?: string
          installer_id?: string | null
          installer_name?: string | null
          job_date?: string | null
          job_time?: string | null
          job_time_end?: string | null
          job_type?: string | null
          manual_percentage?: number | null
          maps?: string | null
          marketer_collected?: boolean
          marketer_fixed_amount?: number
          marketer_pay_mode?: string
          notes?: string | null
          notified_at?: string | null
          notified_lead_minutes?: number[]
          notify_channels?: string[]
          notify_enabled?: boolean
          notify_lead_minutes?: number
          notify_lead_minutes_list?: number[]
          office_fixed_amount?: number
          office_parts?: number | null
          office_pay_mode?: string
          paid?: boolean | null
          parts?: number | null
          payment?: string | null
          phone_no?: string | null
          pickup_door_center_id?: string | null
          po_number?: string | null
          price?: number | null
          scheduled_completion_date?: string | null
          status?: string | null
          tech_fixed_amount?: number
          tech_name?: string | null
          tech_pay_mode?: string
          tip?: number | null
          total_marketer?: number | null
          total_office?: number | null
          total_tech?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cc_fee?: number | null
          check_no?: string | null
          client_id?: string | null
          co_parts?: number | null
          comp_type?: string | null
          company?: string | null
          company_1?: string | null
          company_id?: string | null
          completed_at_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_check_no?: string | null
          deposit_date?: string | null
          deposit_payment_method?: string | null
          deposit_received?: boolean
          extra_fields?: Json
          id?: string
          installer_id?: string | null
          installer_name?: string | null
          job_date?: string | null
          job_time?: string | null
          job_time_end?: string | null
          job_type?: string | null
          manual_percentage?: number | null
          maps?: string | null
          marketer_collected?: boolean
          marketer_fixed_amount?: number
          marketer_pay_mode?: string
          notes?: string | null
          notified_at?: string | null
          notified_lead_minutes?: number[]
          notify_channels?: string[]
          notify_enabled?: boolean
          notify_lead_minutes?: number
          notify_lead_minutes_list?: number[]
          office_fixed_amount?: number
          office_parts?: number | null
          office_pay_mode?: string
          paid?: boolean | null
          parts?: number | null
          payment?: string | null
          phone_no?: string | null
          pickup_door_center_id?: string | null
          po_number?: string | null
          price?: number | null
          scheduled_completion_date?: string | null
          status?: string | null
          tech_fixed_amount?: number
          tech_name?: string | null
          tech_pay_mode?: string
          tip?: number | null
          total_marketer?: number | null
          total_office?: number | null
          total_tech?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketer_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      message_send_log: {
        Row: {
          body_rendered: string
          channel: string
          error: string | null
          id: string
          job_id: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_type: string | null
          sent_at: string
          sent_by: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          body_rendered: string
          channel: string
          error?: string | null
          id?: string
          job_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_type?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          body_rendered?: string
          channel?: string
          error?: string | null
          id?: string
          job_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_type?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          channel_default: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          recipient_type: string
          updated_at: string
        }
        Insert: {
          body: string
          channel_default?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          recipient_type: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel_default?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          recipient_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          error: string | null
          id: string
          job_id: string
          sent_at: string
          status: string
        }
        Insert: {
          channel: string
          error?: string | null
          id?: string
          job_id: string
          sent_at?: string
          status: string
        }
        Update: {
          channel?: string
          error?: string | null
          id?: string
          job_id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_charges: {
        Row: {
          amount: number
          charge_date: string | null
          created_at: string
          description: string | null
          id: string
          marketer: string
          updated_at: string
        }
        Insert: {
          amount?: number
          charge_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          marketer: string
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          marketer?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          mobile_phone: string | null
          notes: string | null
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          job_title?: string | null
          last_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_automations: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          recipients: Json
          schedule: Json
          template: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          recipients?: Json
          schedule?: Json
          template?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          recipients?: Json
          schedule?: Json
          template?: Json
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_key: string
          role_name: string
        }
        Insert: {
          created_at?: string
          permission_key: string
          role_name: string
        }
        Update: {
          created_at?: string
          permission_key?: string
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          city: string | null
          created_at: string
          id: string
          percentage: number | null
          phone_number: string | null
          pincode: string | null
          tech_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          percentage?: number | null
          phone_number?: string | null
          pincode?: string | null
          tech_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          percentage?: number | null
          phone_number?: string | null
          pincode?: string | null
          tech_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
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
      [_ in never]: never
    }
    Functions: {
      can_view_all_jobs: { Args: { _user_id: string }; Returns: boolean }
      current_user_tech_name: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_permission: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      lookup_tech_by_pincode: {
        Args: { _pin: string }
        Returns: {
          id: string
          tech_name: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "tech"
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
      app_role: ["admin", "manager", "user", "tech"],
    },
  },
} as const
