import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Check if caller is admin
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error('Forbidden: Admin access required');
    }

    // 2. Admin Actions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action'); // 'list', 'reset_password', 'toggle_tester'

    if (req.method === 'GET' || (req.method === 'POST' && action === 'list')) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('perPage') || '20');
      
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page: page,
        perPage: perPage
      });

      if (error) throw error;
      
      // Fetch profiles for these users to get is_tester status
      const userIds = users.map(u => u.id);
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, is_tester, role')
        .in('user_id', userIds);

      // Merge data
      const enrichedUsers = users.map(u => {
        const p = profiles?.find(prof => prof.user_id === u.id);
        return {
          ...u,
          is_tester: p?.is_tester || false,
          role: p?.role || 'user'
        };
      });

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (req.method === 'POST' && action === 'reset_password') {
      const { userId, newPassword } = await req.json();
      if (!userId || !newPassword) throw new Error('Missing userId or newPassword');

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (error) throw error;

      return new Response(JSON.stringify({ message: 'Password reset successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (req.method === 'POST' && action === 'toggle_tester') {
      const { userId, isTester } = await req.json();
      if (!userId) throw new Error('Missing userId');

      // Update user_profiles
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_tester: isTester })
        .eq('user_id', userId);

      if (error) throw error;

      return new Response(JSON.stringify({ message: 'Tester status updated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error('Method not allowed or Action missing');

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
