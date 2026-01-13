import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, phone, code, password, inviteCode } = await req.json();
    
    if (!phone || !code || !password || !type) {
      throw new Error('Missing required fields');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Verify SMS Code from Database
    const { data: verificationData, error: verificationError } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (verificationError || !verificationData) {
      throw new Error('验证码无效或已过期');
    }

    // Mark code as verified
    await supabaseAdmin
      .from('verification_codes')
      .update({ verified: true })
      .eq('id', verificationData.id);

    // 2. Perform Auth Action
    if (type === 'register') {
      const phoneE164 = phone.startsWith('+') ? phone : `+86${phone}`;

      const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: phoneE164,
        password: password,
        phone_confirm: true,
        user_metadata: {
          role: 'user'
        }
      });

      if (createError) {
        throw createError;
      }

      if (user.user) {
        // Check if profile exists, if not create it
        const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
          user_id: user.user.id,
          role: 'user',
        });
        
        // Ignore duplicate key error if profile already auto-created by triggers
        if (profileError && !profileError.message.includes('duplicate key')) {
          console.error('Profile creation error:', profileError);
        }
      }

      return new Response(JSON.stringify({ message: 'User registered successfully', user: user.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (type === 'reset_password') {
      const phoneE164 = phone.startsWith('+') ? phone : `+86${phone}`;
      
      // Find user by phone via listing (Note: This is not efficient for large user bases)
      // In production, consider a lookup table or Supabase RPC to get user by phone
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      // Normalize phone for comparison
      const targetUser = users.find(u => u.phone === phoneE164);
      if (!targetUser) {
        throw new Error('未找到该手机号注册的用户');
      }

      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.id,
        { password: password }
      );

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ message: 'Password reset successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error('Invalid type');

  } catch (error) {
    console.error('Auth Operation Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
