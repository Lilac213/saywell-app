import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AliyunClient } from "../_shared/aliyun.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      throw new Error('Phone number is required');
    }

    // 1. Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Store in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from('verification_codes')
      .insert({
        phone,
        code,
        type: 'register', // Or make this dynamic if needed
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      });

    if (dbError) {
      console.error('Database Error:', dbError);
      throw new Error('Failed to generate verification code');
    }

    // 3. Send SMS via Aliyun
    const accessKeyId = Deno.env.get('ALIYUN_ACCESS_KEY_ID');
    const accessKeySecret = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET');
    const signName = Deno.env.get('ALIYUN_SIGN_NAME');
    const templateCode = Deno.env.get('ALIYUN_TEMPLATE_CODE');

    if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
      throw new Error('Aliyun SMS configuration is missing (AK, SK, SignName, or TemplateCode)');
    }

    const client = new AliyunClient({
      accessKeyId,
      accessKeySecret,
    });

    const result = await client.sendSms(
      phone,
      signName,
      templateCode,
      { code } // Assuming template has variable ${code}
    );

    if (result.Code !== 'OK') {
       console.error('Aliyun SMS Error:', result);
       throw new Error(result.Message || 'Failed to send SMS');
    }

    return new Response(JSON.stringify({ success: true, message: 'Code sent' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
