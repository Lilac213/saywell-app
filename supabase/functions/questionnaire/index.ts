
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { cryptoService } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    
    if (!action) {
      throw new Error('Missing action parameter')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let resultData;

    if (action === 'createBatch') {
      const { user_profile_id, responses } = params
      
      if (!user_profile_id || !responses || !Array.isArray(responses)) {
        throw new Error('Missing required fields or invalid responses format')
      }

      // Process responses to encrypt answers
      const encryptedResponses = await Promise.all(
        responses.map(async (r: any) => ({
          user_profile_id,
          question: r.question,
          answer: await cryptoService.encrypt(r.answer),
          question_order: r.question_order
        }))
      )

      const { data, error } = await supabase
        .from('questionnaire_responses')
        .insert(encryptedResponses)
        .select()

      if (error) throw error

      // Return original data (unencrypted) with structure
      resultData = data.map((item, index) => ({
        ...item,
        answer: responses[index].answer
      }))

    } else if (action === 'get') {
      const { user_profile_id } = params
      if (!user_profile_id) throw new Error('Missing user_profile_id')

      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('*')
        .eq('user_profile_id', user_profile_id)
        .order('question_order', { ascending: true })

      if (error) throw error

      // Decrypt answers
      resultData = await Promise.all(
        (data || []).map(async (item) => {
          const newItem = { ...item }
          if (newItem.answer) {
            try {
              newItem.answer = await cryptoService.decrypt(newItem.answer)
            } catch (e) {
              // keep raw
            }
          }
          return newItem
        })
      )

    } else {
      throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(resultData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
