
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

    if (action === 'create') {
      const {
        chat_session_id,
        generated_replies,
        selected_reply,
        selection_index
      } = params

      if (!chat_session_id) throw new Error('chat_session_id is required')

      const encryptedSelectedReply = await cryptoService.encrypt(selected_reply)

      let encryptedGeneratedReplies = []
      if (Array.isArray(generated_replies)) {
        encryptedGeneratedReplies = await Promise.all(generated_replies.map(async (reply) => {
          return {
            ...reply,
            text: await cryptoService.encrypt(reply.text),
            reasoning: await cryptoService.encrypt(reply.reasoning)
          }
        }))
      }

      const { data, error } = await supabase
        .from('reply_selections')
        .insert({
          chat_session_id,
          generated_replies: encryptedGeneratedReplies,
          selected_reply: encryptedSelectedReply,
          selection_index
        })
        .select()
        .single()

      if (error) throw error
      resultData = data

    } else if (action === 'get') {
      const { chat_session_id } = params
      if (!chat_session_id) throw new Error('Missing chat_session_id')

      const { data, error } = await supabase
        .from('reply_selections')
        .select('*')
        .eq('chat_session_id', chat_session_id)
        .maybeSingle()

      if (error) throw error
      
      if (data) {
        if (data.generated_replies && Array.isArray(data.generated_replies)) {
          try {
            data.generated_replies = await Promise.all(
              data.generated_replies.map(async (r: any) => {
                 if (typeof r === 'object' && r !== null) {
                    const newR = { ...r }
                    if (newR.text) newR.text = await cryptoService.decrypt(newR.text)
                    if (newR.reasoning) newR.reasoning = await cryptoService.decrypt(newR.reasoning)
                    return newR
                 }
                 if (typeof r === 'string') {
                   return cryptoService.decrypt(r)
                 }
                 return r
              })
            )
          } catch (e) {
            console.warn('Failed to decrypt generated_replies', e)
          }
        }

        if (data.selected_reply) {
          try {
            data.selected_reply = await cryptoService.decrypt(data.selected_reply)
          } catch (e) {
            console.warn('Failed to decrypt selected_reply', e)
          }
        }
      }
      resultData = data

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
