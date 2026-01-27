
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
      // Create new profile
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({})
        .select()
        .maybeSingle()
      
      if (error) throw error
      resultData = data

    } else if (action === 'get') {
      // Get profile by ID
      const { id } = params
      if (!id) throw new Error('Missing ID')

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        resultData = null
      } else {
        // Decrypt fields
        if (data.background_story) {
          try {
            data.background_story = await cryptoService.decrypt(data.background_story)
          } catch (e) {
            // keep raw if decrypt fails
          }
        }

        if (data.personality_traits && data.personality_traits.__encrypted) {
          try {
            const decryptedStr = await cryptoService.decrypt(data.personality_traits.__encrypted)
            data.personality_traits = JSON.parse(decryptedStr)
          } catch (e) {
            console.error('Failed to decrypt personality_traits', e)
          }
        }

        if (data.language_habits && data.language_habits.__encrypted) {
          try {
            const decryptedStr = await cryptoService.decrypt(data.language_habits.__encrypted)
            data.language_habits = JSON.parse(decryptedStr)
          } catch (e) {
            console.error('Failed to decrypt language_habits', e)
          }
        }
        resultData = data
      }

    } else if (action === 'update') {
      // Update profile
      const { id, ...updates } = params
      if (!id) throw new Error('Missing ID')

      const processedUpdates: any = { ...updates }

      // Encrypt sensitive fields
      if (processedUpdates.background_story) {
        processedUpdates.background_story = await cryptoService.encrypt(processedUpdates.background_story)
      }

      if (processedUpdates.personality_traits) {
        const jsonStr = JSON.stringify(processedUpdates.personality_traits)
        const encrypted = await cryptoService.encrypt(jsonStr)
        processedUpdates.personality_traits = { __encrypted: encrypted }
      }

      if (processedUpdates.language_habits) {
        const jsonStr = JSON.stringify(processedUpdates.language_habits)
        const encrypted = await cryptoService.encrypt(jsonStr)
        processedUpdates.language_habits = { __encrypted: encrypted }
      }
      
      processedUpdates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('user_profiles')
        .update(processedUpdates)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (error) throw error
      
      // Return merged updates so frontend sees unencrypted data
      resultData = { ...data, ...updates }

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
