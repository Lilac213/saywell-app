import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    const client = new AliyunClient({
      accessKeyId: Deno.env.get('ALIYUN_ACCESS_KEY_ID') ?? '',
      accessKeySecret: Deno.env.get('ALIYUN_ACCESS_KEY_SECRET') ?? '',
    });

    // Note: SceneCode needs to be configured in your Aliyun Console for "Verify Code"
    // We assume a default or env var
    // const result = await client.sendSmsVerifyCode(phone);
    
    // For now, since we don't have the exact SceneCode, we might need to use generic SendSms if VerifyCode fails or is not set up.
    // But let's stick to the request.
    // If using generic SendSms (Dysmsapi), we would generate code here.
    // Let's assume we use SendSmsVerifyCode (Dypnsapi).
    
    // However, Dypnsapi usually requires a SceneCode.
    // Let's check if user provided it. No.
    // We will try to call it.
    
    // Actually, to be safe and standard, I'll implement the logic to GENERATE code here and use generic SendSms if available,
    // OR use the Dypnsapi as requested.
    // Given the ambiguity, I'll stick to the "Phone Number Verification Service" path but warn about SceneCode.
    
    // WAIT: The user linked `dypnsapi` but said "SMS Verification Service".
    // If I use `dypnsapi`, I don't need to generate code.
    // If I use `dysmsapi`, I DO need to generate code.
    // I'll assume `dypnsapi` (Number Auth) as per link.
    
    const result = await client.request('SendSmsVerifyCode', {
      'PhoneNumber': phone,
      'SceneCode': Deno.env.get('ALIYUN_SCENE_CODE') || 'Register_Login_Test', // Default or Env
    });

    if (result.Code !== 'OK') {
       console.error('Aliyun Error:', result);
       throw new Error(result.Message || 'Failed to send SMS');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
