
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
        user_profile_id,
        screenshot_url,
        extracted_text,
        context_analysis,
        intent_analysis,
        emotion_analysis,
        relationship,
        chat_remark,
        user_style_observation
      } = params

      if (!user_profile_id) throw new Error('user_profile_id is required')

      // Encrypt Data
      const encryptedScreenshotUrl = await cryptoService.encrypt(screenshot_url)
      const encryptedExtractedText = await cryptoService.encrypt(extracted_text)
      
      // Encrypt context fields
      const contextData = {
        context_analysis: await cryptoService.encrypt(context_analysis),
        intent_analysis: await cryptoService.encrypt(intent_analysis),
        emotion_analysis: await cryptoService.encrypt(emotion_analysis),
        relationship: await cryptoService.encrypt(relationship),
        chat_remark: await cryptoService.encrypt(chat_remark)
      }

      const encryptedUserStyleObservation = await cryptoService.encrypt(user_style_observation)

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_profile_id,
          screenshot_url: encryptedScreenshotUrl,
          extracted_text: encryptedExtractedText,
          context: contextData,
          user_style_observation: encryptedUserStyleObservation
        })
        .select()
        .single()

      if (error) throw error
      resultData = data

    } else if (action === 'get') {
      const { id } = params
      if (!id) throw new Error('Missing ID')

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      
      if (data) {
        // Decrypt logic
        if (data.screenshot_url) {
          try { data.screenshot_url = await cryptoService.decrypt(data.screenshot_url) } catch (e) {}
        }
        if (data.extracted_text) {
          try { data.extracted_text = await cryptoService.decrypt(data.extracted_text) } catch (e) {}
        }
        if (data.context) {
          if (data.context.__encrypted) {
            try {
              const decryptedContextStr = await cryptoService.decrypt(data.context.__encrypted)
              data.context = JSON.parse(decryptedContextStr)
            } catch (e) {}
          } else {
            const contextFields = ['context_analysis', 'intent_analysis', 'emotion_analysis', 'relationship', 'chat_remark'];
            await Promise.all(contextFields.map(async (field) => {
              if (data.context[field]) {
                try { data.context[field] = await cryptoService.decrypt(data.context[field]) } catch (e) {}
              }
            }));
          }
        }
      }
      resultData = data

    } else if (action === 'update') {
      const {
        id,
        screenshot_url,
        extracted_text,
        context_analysis,
        intent_analysis,
        emotion_analysis,
        relationship,
        chat_remark,
        user_style_observation
      } = params

      if (!id) throw new Error('id is required')

      const updates: any = {}

      if (screenshot_url) updates.screenshot_url = await cryptoService.encrypt(screenshot_url)
      if (extracted_text) updates.extracted_text = await cryptoService.encrypt(extracted_text)
      if (user_style_observation) updates.user_style_observation = await cryptoService.encrypt(user_style_observation)

      const contextFields = { context_analysis, intent_analysis, emotion_analysis, relationship, chat_remark }
      const hasContextUpdates = Object.values(contextFields).some(v => v !== undefined)
      
      if (hasContextUpdates) {
         const { data: existingSession, error: fetchError } = await supabase
           .from('chat_sessions')
           .select('context')
           .eq('id', id)
           .single()
           
         if (fetchError) throw fetchError
         
         const currentContext = existingSession.context || {}
         const newContext = { ...currentContext }
         
         if (context_analysis) newContext.context_analysis = await cryptoService.encrypt(context_analysis)
         if (intent_analysis) newContext.intent_analysis = await cryptoService.encrypt(intent_analysis)
         if (emotion_analysis) newContext.emotion_analysis = await cryptoService.encrypt(emotion_analysis)
         if (relationship) newContext.relationship = await cryptoService.encrypt(relationship)
         if (chat_remark) newContext.chat_remark = await cryptoService.encrypt(chat_remark)
         
         updates.context = newContext
      }

      const { data, error } = await supabase
        .from('chat_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      resultData = data

    } else if (action === 'list') {
      const { user_profile_id, limit = 20 } = params
      if (!user_profile_id) throw new Error('Missing user_profile_id')

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_profile_id', user_profile_id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      // Decrypt list
      resultData = await Promise.all((data || []).map(async (item) => {
        const newItem = { ...item }
        if (newItem.screenshot_url) {
          try { newItem.screenshot_url = await cryptoService.decrypt(newItem.screenshot_url) } catch (e) {}
        }
        if (newItem.extracted_text) {
          try { newItem.extracted_text = await cryptoService.decrypt(newItem.extracted_text) } catch (e) {}
        }
        if (newItem.context) {
          if (newItem.context.__encrypted) {
            try {
              const decryptedContextStr = await cryptoService.decrypt(newItem.context.__encrypted)
              newItem.context = JSON.parse(decryptedContextStr)
            } catch (e) {}
          } else {
             const contextFields = ['context_analysis', 'intent_analysis', 'emotion_analysis', 'relationship', 'chat_remark'];
             await Promise.all(contextFields.map(async (field) => {
               if (newItem.context[field]) {
                 try { newItem.context[field] = await cryptoService.decrypt(newItem.context[field]) } catch (e) {}
               }
             }));
          }
        }
        return newItem
      }))

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
