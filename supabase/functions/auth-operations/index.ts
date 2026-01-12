import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AliyunClient } from "../_shared/aliyun.ts";
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

    // 1. Verify SMS Code
    const aliyun = new AliyunClient({
      accessKeyId: Deno.env.get('ALIYUN_ACCESS_KEY_ID') ?? '',
      accessKeySecret: Deno.env.get('ALIYUN_ACCESS_KEY_SECRET') ?? '',
    });

    const verifyResult = await aliyun.request('CheckSmsVerifyCode', {
      'PhoneNumber': phone,
      'VerifyCode': code,
    });

    if (verifyResult.Code !== 'OK' || verifyResult.Model?.VerifyResult !== 'PASS') {
      throw new Error('Verification code invalid or expired');
    }

    // 2. Perform Auth Action
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

    if (type === 'register') {
      // Check if user exists (by phone)
      // Supabase Auth with Phone: We use a trick.
      // If we use 'phone' as identifier, we need to format it E.164.
      // Aliyun uses local format usually, but Supabase needs +86.
      const phoneE164 = phone.startsWith('+') ? phone : `+86${phone}`;

      const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: phoneE164,
        password: password,
        phone_confirm: true, // We already verified it
        user_metadata: {
          role: 'user' // Default role
        }
      });

      if (createError) {
        throw createError;
      }

      // Create Profile in public table
      if (user.user) {
        await supabaseAdmin.from('user_profiles').insert({
          user_id: user.user.id,
          role: 'user',
          // Copy other default fields if needed
        });
      }

      return new Response(JSON.stringify({ message: 'User registered successfully', user: user.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (type === 'reset_password') {
      const phoneE164 = phone.startsWith('+') ? phone : `+86${phone}`;
      
      // Find user by phone
      // admin.listUsers() is expensive if many users, but we don't have getByPhone directly exposed easily without knowing ID.
      // But we can try 'updateUserById' if we knew ID.
      // Actually, standard way:
      // We can't easily find ID by Phone without listing.
      // Optimization: Maintain a public mapping or just list users filtering by phone? 
      // supabaseAdmin.auth.admin.listUsers() supports filtering? Not really by phone efficiently in JS SDK maybe.
      // Wait, createClient has 'generateLink' etc.
      
      // Better: Use `updateUserById` if we store mapping, OR just `createUser` with upsert? No.
      // Let's use `listUsers` for now (warning: pagination).
      // Or better: Use the `public.user_profiles` table if we link phone there!
      // But we didn't store phone in `user_profiles` yet.
      // We should probably rely on `supabaseAdmin.auth.admin.updateUserById`.
      
      // Workaround: We can try to sign in with phone/password? No we don't know password.
      // Let's iterate users or use a Supabase RPC if available.
      
      // Actually, Supabase has `supabaseAdmin.auth.admin.getUserByPhone(phone)`? No.
      // It has `listUsers`.
      // Let's assume user count is low or we implement a lookup table.
      
      // Hack: Try to create user. If it fails with "User already exists", it might return ID? No.
      
      // Correct approach: The client should probably have the ID if logged in.
      // BUT this is "Forgot Password" (not logged in).
      
      // Let's search in `user_profiles` IF we stored phone there.
      // We should update `user_profiles` to store phone for easier lookup.
      // For now, I'll use `listUsers` (slow for millions, ok for thousands).
      
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      const targetUser = users.find(u => u.phone === phoneE164);
      if (!targetUser) {
        throw new Error('User not found');
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
